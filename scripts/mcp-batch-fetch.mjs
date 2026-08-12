#!/usr/bin/env node
/**
 * mcp-batch-fetch.mjs —— 纯 key 认证的 MasterGo 批量拉取脚本（零浏览器操作）
 *
 * 输入：画板清单 JSON（page-exporter 插件导出，或手写的 [{id, name}] 数组）
 * 输出：每个画板的 section DSL 落盘到 <outDir>/<layerId sanitized>/section-N.json
 *       + 汇总 index.json（画板清单、拉取状态、文本预览）
 *
 * 用法：
 *   export MG_MCP_TOKEN=mg_xxx
 *   node mcp-batch-fetch.mjs --file 115835509271418 --frames page-export-808-150160.json --out ./dump
 *   node mcp-batch-fetch.mjs --file 115835509271418 --ids 5771:91198,5771:92001 --out ./dump
 *
 * 说明：
 * - 走 magic-mcp 服务端 REST（/mcp/design-sections），与 MCP 工具同源；
 * - 认证头 x-mg-useraccesstoken（也接受环境变量 MASTERGO_TOKEN）；
 * - 串行 + 限速（默认 300ms 间隔），失败画板记录后继续，不中断整批；
 * - 幂等：已存在的 section 文件跳过，重跑只补缺的。
 */

import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.MG_API_BASE || 'https://mastergo.com';
const TOKEN = process.env.MG_MCP_TOKEN || process.env.MASTERGO_TOKEN || '';
const INTERVAL_MS = Number(process.env.MCP_FETCH_INTERVAL_MS || 300);

function parseArgs() {
    const args = process.argv.slice(2);
    const opt = { out: './mg-dump', concurrencyDelay: INTERVAL_MS };
    for (let i = 0; i < args.length; i += 2) {
        const key = args[i].replace(/^--/, '');
        opt[key] = args[i + 1];
    }
    if (!opt.file) throw new Error('缺少 --file <fileId>');
    if (!opt.frames && !opt.ids) throw new Error('缺少 --frames <清单.json> 或 --ids <id1,id2,...>');
    if (!TOKEN) throw new Error('缺少 token：export MG_MCP_TOKEN=mg_xxx');
    return opt;
}

async function getJson(url) {
    const res = await fetch(url, { headers: { 'x-mg-useraccesstoken': TOKEN } });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return res.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const sanitize = (id) => id.replace(/[:/]/g, '-');

async function fetchFrame(fileId, layerId, outDir) {
    const dir = path.join(outDir, sanitize(layerId));
    await mkdir(dir, { recursive: true });

    const listUrl = `${BASE}/mcp/design-sections?fileId=${fileId}&layerId=${encodeURIComponent(layerId)}`;
    const overview = await getJson(listUrl);
    const total = overview.totalSections ?? 0;
    if (!total) return { layerId, sections: 0, skipped: true, note: '空分区（可能不是有效画板 layerId）' };

    let fetched = 0;
    for (let i = 0; i < total; i++) {
        const fp = path.join(dir, `section-${i}.json`);
        try {
            await access(fp); // 幂等：已存在则跳过
            fetched++;
            continue;
        } catch { /* 不存在，拉取 */ }
        const sec = await getJson(`${listUrl}&sectionIndex=${i}`);
        await writeFile(fp, JSON.stringify(sec, null, 2));
        fetched++;
        await sleep(INTERVAL_MS);
    }
    return {
        layerId,
        sections: total,
        fetched,
        allTexts: overview.rootMetadata?.allTexts || [],
        bbox: overview.rootMetadata ? { width: overview.rootMetadata.width, height: overview.rootMetadata.height } : undefined,
    };
}

async function main() {
    const opt = parseArgs();
    let frames = [];
    if (opt.ids) {
        frames = opt.ids.split(',').map((s) => s.trim()).filter(Boolean).map((id) => ({ id }));
    } else {
        const list = JSON.parse(await readFile(opt.frames, 'utf8'));
        frames = (list.frames || list).map((f) => ({ id: f.id, name: f.name }));
    }

    await mkdir(opt.out, { recursive: true });
    const results = [];
    for (const [idx, frame] of frames.entries()) {
        try {
            const r = await fetchFrame(opt.file, frame.id, opt.out);
            results.push({ name: frame.name, ...r });
            console.log(`[${idx + 1}/${frames.length}] ${frame.name || frame.id}: ${r.sections} sections ${r.skipped ? '(跳过)' : 'OK'}`);
        } catch (e) {
            results.push({ name: frame.name, layerId: frame.id, error: String(e.message || e) });
            console.error(`[${idx + 1}/${frames.length}] ${frame.name || frame.id}: 失败 ${e.message}`);
        }
        await sleep(INTERVAL_MS);
    }
    await writeFile(path.join(opt.out, 'index.json'), JSON.stringify({ fileId: opt.file, fetchedAt: new Date().toISOString(), results }, null, 2));
    const ok = results.filter((r) => !r.error && !r.skipped).length;
    console.log(`\n完成：${ok}/${frames.length} 个画板成功，输出目录 ${opt.out}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
