#!/usr/bin/env node
/**
 * mcp-batch-fetch.mjs —— 纯 token 认证的 MasterGo 整页枚举 + 批量拉取（零插件、零浏览器操作）
 *
 * 两步全自动：
 *   1) GET /mcp/page-layers   —— 用 page_id 枚举整页图层，筛出顶层画板；
 *   2) GET /mcp/dsl           —— 逐画板拉整层 DSL 落盘（每画板 dsl.json + texts.json）。
 *
 * 用法：
 *   export MG_MCP_TOKEN=mg_xxx
 *   # 最省事：直接粘 MasterGo 链接（自动解出 fileId + page_id）
 *   node mcp-batch-fetch.mjs --url 'https://mastergo.com/file/1158...?page_id=808%3A150160' --out ./dump
 *   # 整页：
 *   node mcp-batch-fetch.mjs --file 115835509271418 --page 808:150160 --out ./dump
 *   # 多页一次跑完（各自落到 <out>/page-<id>/）：
 *   node mcp-batch-fetch.mjs --file 1158... --page 808:150160,5496:96753 --out ./dump
 *   # 页面还没打开过？加 --wait，脚本原地等你打开后自动继续：
 *   node mcp-batch-fetch.mjs --file 1158... --page 5496:96753 --wait --out ./dump
 *   # 只看清单不落盘：
 *   node mcp-batch-fetch.mjs --file 1158... --page 808:150160 --list-only
 *   # 指定画板 / 从清单 JSON：
 *   node mcp-batch-fetch.mjs --file 1158... --ids 5771:91198,5771:92001 --out ./dump
 *   node mcp-batch-fetch.mjs --file 1158... --frames frames.json --out ./dump
 *
 * 可选参数：
 *   --url <链接>      粘贴 MasterGo 长链，自动解析 fileId / page_id / layer_id（不支持 /goto/ 短链）
 *   --wait [秒]       页面未缓存时原地轮询等待（默认 300s），打开页面后自动继续
 *   --min-children N  顶层节点至少 N 个子节点才算画板（默认 1，过滤零散文本/连接线）
 *   --types A,B       覆盖画板类型白名单（默认 SECTION,FRAME,COMPONENT,INSTANCE,9）
 *   --limit N         只取前 N 个画板（调试用）
 *
 * 说明：
 * - 走 magic-mcp 服务端 REST，与 MCP 工具同源；认证头 X-MG-UserAccessToken；
 * - page-layers 读服务端缓存：该页面必须**曾在 MasterGo 中打开过**（画布加载完自动上报图层），
 *   否则返回 totalLayers:0 + needsCanvasVisit:true。缓存**持久有效**（实测隔天仍命中），
 *   同一页面只需开一次；用 --wait 可让脚本原地等待，避免「打开→重跑」的往返；
 * - 串行 + 限速（默认 300ms，MCP_FETCH_INTERVAL_MS 可调），单个画板失败记录后继续；
 * - 429/5xx 指数退避重试（MCP_FETCH_MAX_RETRIES=5、MCP_FETCH_RETRY_BASE_MS=2000，
 *   服务端给 Retry-After 时优先采用）；整页几十个画板必会撞限流，别把间隔调太小；
 * - 幂等：已存在的 dsl.json 文件跳过，重跑只补缺的。
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.MG_API_BASE || 'https://mastergo.com';
const TOKEN = process.env.MG_MCP_TOKEN || process.env.MASTERGO_API_TOKEN || process.env.MASTERGO_TOKEN || '';
const INTERVAL_MS = Number(process.env.MCP_FETCH_INTERVAL_MS || 300);
const MAX_RETRIES = Number(process.env.MCP_FETCH_MAX_RETRIES || 5);
const RETRY_BASE_MS = Number(process.env.MCP_FETCH_RETRY_BASE_MS || 2000);

/** 可作为「画板」独立出码的节点类型（9 = GROUP，流程图里常见的成组画板） */
const DEFAULT_FRAME_TYPES = ['SECTION', 'FRAME', 'COMPONENT', 'INSTANCE', '9'];

function parseArgs() {
    const args = process.argv.slice(2);
    const opt = { out: './mg-dump' };
    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (!a.startsWith('--')) continue;
        const key = a.replace(/^--/, '');
        const next = args[i + 1];
        if (next === undefined || next.startsWith('--')) {
            opt[key] = true; // 布尔开关，如 --list-only
        } else {
            opt[key] = next;
            i++;
        }
    }
    // --url 可直接粘贴 MasterGo 链接，自动解出 fileId + page/layer，免去手剥 id
    if (opt.url) {
        const parsed = parseMgUrl(String(opt.url));
        opt.file = opt.file || parsed.fileId;
        if (parsed.pageId && !opt.page) opt.page = parsed.pageId;
        if (parsed.layerId && !opt.ids && !opt.page) opt.ids = parsed.layerId;
    }
    if (!opt.file) throw new Error('缺少 --file <fileId>（或用 --url 粘贴 MasterGo 链接）');
    if (!opt.page && !opt.frames && !opt.ids) {
        throw new Error('缺少 --page <pageId> / --url <链接> / --frames <清单.json> / --ids <id1,id2,...>');
    }
    if (!TOKEN) throw new Error('缺少 token：export MG_MCP_TOKEN=mg_xxx');
    return opt;
}

/**
 * 解析 MasterGo 链接：https://mastergo.com/file/<fileId>?page_id=x:y&layer_id=a:b
 * 不支持 /goto/ 短链（需跟随重定向，直接给长链即可）。
 */
function parseMgUrl(raw) {
    if (raw.includes('/goto/')) {
        throw new Error('不支持 /goto/ 短链，请在 MasterGo 里复制完整链接（含 file/<id> 与 page_id）');
    }
    let u;
    try {
        u = new URL(raw);
    } catch {
        throw new Error(`无法解析链接：${raw}`);
    }
    const fileId = u.pathname.split('/').find((s) => /^\d+$/.test(s));
    if (!fileId) throw new Error(`链接里找不到 fileId：${raw}`);
    const q = u.searchParams;
    return { fileId, pageId: q.get('page_id') || undefined, layerId: q.get('layer_id') || undefined };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 带指数退避的 GET：429/5xx 自动重试（限流是整页拉取的常态） */
async function getJson(url, attempt = 0) {
    const res = await fetch(url, { headers: { 'X-MG-UserAccessToken': TOKEN } });
    if (res.ok) return res.json();
    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < MAX_RETRIES) {
        const retryAfter = Number(res.headers.get('retry-after')) * 1000;
        const wait = retryAfter > 0 ? retryAfter : RETRY_BASE_MS * 2 ** attempt;
        console.warn(`  HTTP ${res.status}，${Math.round(wait / 1000)}s 后重试（${attempt + 1}/${MAX_RETRIES}）`);
        await sleep(wait);
        return getJson(url, attempt + 1);
    }
    throw new Error(`HTTP ${res.status} ${url}`);
}
const sanitize = (id) => id.replace(/[:/]/g, '-');

/** 第一步：枚举整页图层，筛出顶层画板 */
async function listPageFrames(fileId, pageId, opt) {
    const url = `${BASE}/mcp/page-layers?fileId=${fileId}&layerId=${encodeURIComponent(pageId)}`;
    const openUrl = `https://mastergo.com/file/${fileId}?page_id=${encodeURIComponent(pageId)}`;
    let data = await getJson(url);

    // 缓存未命中：--wait 则原地轮询，用户打开页面后自动继续，不必重跑整条命令
    if (!data.totalLayers && opt.wait) {
        const timeoutMs = Number(opt.wait === true ? 300 : opt.wait) * 1000;
        const deadline = Date.now() + timeoutMs;
        console.log(`⏳ 页面 ${pageId} 未缓存。请在浏览器打开并切到该页面（等画布加载完）：\n   ${openUrl}`);
        console.log(`   已进入等待模式，每 5s 自动重试，最长 ${Math.round(timeoutMs / 1000)}s……`);
        while (!data.totalLayers && Date.now() < deadline) {
            await sleep(5000);
            data = await getJson(url);
            if (data.totalLayers) console.log(`✅ 检测到图层数据（${data.totalLayers} 层），继续拉取`);
        }
    }

    if (!data.totalLayers) {
        throw new Error(
            `页面 ${pageId} 无图层数据（needsCanvasVisit=${!!data.needsCanvasVisit}）。\n`
            + '  page-layers 读服务端缓存，需要该页面曾在 MasterGo 中打开过一次（画布加载完会自动上报图层，\n'
            + '  缓存持久有效，同一页面只需开一次，之后随时可纯 token 拉取）。\n'
            + `  请打开并切到该页面：${openUrl}\n`
            + '  然后重跑本脚本；或加 --wait 让脚本原地等你打开（默认等 300s）。',
        );
    }

    const types = opt.types ? String(opt.types).split(',').map((s) => s.trim()) : DEFAULT_FRAME_TYPES;
    const minChildren = Number(opt['min-children'] ?? 1);

    // 顶层 = parentId 为空；id 形如 "a:1/b:2" 的路径式 id 是组件内部子层，一律排除
    let frames = data.layers
        .filter((l) => !l.parentId && !l.id.includes('/'))
        .filter((l) => types.includes(String(l.type)))
        .filter((l) => (l.childrenCount ?? 0) >= minChildren)
        .map((l) => ({ id: l.id, name: l.name, type: l.type, childrenCount: l.childrenCount }));

    if (opt.limit) frames = frames.slice(0, Number(opt.limit));
    console.log(`页面 ${pageId}：共 ${data.totalLayers} 层，筛出 ${frames.length} 个顶层画板`);
    return frames;
}

/** 递归收集 DSL 中的全部真实文本（含组件定义），作为生成后防幻觉白名单 */
function collectDslTexts(node, acc = new Set()) {
    if (node?.text && Array.isArray(node.text)) {
        for (const t of node.text) {
            if (t?.text) acc.add(t.text);
        }
    }
    if (Array.isArray(node?.children)) {
        for (const child of node.children) collectDslTexts(child, acc);
    }
    return acc;
}

/** 第二步：拉单个画板的整层 DSL（/mcp/dsl），写入 dsl.json + texts.json */
async function fetchFrame(fileId, layerId, outDir) {
    const dir = path.join(outDir, sanitize(layerId));
    const url = `${BASE}/mcp/dsl?fileId=${fileId}&layerId=${encodeURIComponent(layerId)}`;
    const dsl = await getJson(url);

    // /mcp/dsl 只认图层级 layerId；空节点或已走 section 流程会拿到 skipped 标记。
    const nodes = Array.isArray(dsl?.nodes) ? dsl.nodes : [];
    if (dsl?.skipped || nodes.length === 0) {
        return { layerId, nodes: nodes.length, skipped: true, note: '空 DSL（可能不是可出码画板）' };
    }

    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'dsl.json'), JSON.stringify(dsl, null, 2));

    const texts = new Set();
    for (const node of nodes) collectDslTexts(node, texts);
    for (const component of dsl.components ?? []) collectDslTexts(component, texts);
    const allTexts = [...texts];
    await writeFile(path.join(dir, 'texts.json'), JSON.stringify(allTexts, null, 2));

    return {
        layerId,
        nodes: nodes.length,
        components: dsl.components?.length ?? 0,
        styleCount: dsl.styles ? Object.keys(dsl.styles).length : 0,
        allTexts,
    };
}

/** 拉一个页面/一组画板，落盘到 outDir，返回统计 */
async function runOne(opt, outDir, pageId, frames) {
    if (opt['list-only']) {
        console.log(JSON.stringify({ fileId: opt.file, page: pageId, frames }, null, 2));
        return { ok: 0, total: frames.length, listOnly: true };
    }

    await mkdir(outDir, { recursive: true });
    await writeFile(
        path.join(outDir, 'frames.json'),
        JSON.stringify({ fileId: opt.file, page: pageId, frames }, null, 2),
    );

    const results = [];
    for (const [idx, frame] of frames.entries()) {
        const label = `[${idx + 1}/${frames.length}] ${frame.name || frame.id}`;
        try {
            const r = await fetchFrame(opt.file, frame.id, outDir);
            results.push({ name: frame.name, ...r });
            console.log(`${label}: ${r.nodes} nodes ${r.skipped ? '(跳过)' : 'OK'}`);
        } catch (e) {
            results.push({ name: frame.name, layerId: frame.id, error: String(e.message || e) });
            console.error(`${label}: 失败 ${e.message}`);
        }
        await sleep(INTERVAL_MS);
    }
    await writeFile(
        path.join(outDir, 'index.json'),
        JSON.stringify({ fileId: opt.file, page: pageId, fetchedAt: new Date().toISOString(), results }, null, 2),
    );
    const ok = results.filter((r) => !r.error && !r.skipped).length;
    console.log(`完成：${ok}/${frames.length} 个画板成功，输出目录 ${outDir}\n`);
    return { ok, total: frames.length };
}

async function main() {
    const opt = parseArgs();

    // --page 支持逗号分隔的多个页面，各自落到 <out>/page-<id>/ 子目录
    if (opt.page) {
        const pages = String(opt.page).split(',').map((s) => s.trim()).filter(Boolean);
        const multi = pages.length > 1;
        const summary = [];
        for (const pageId of pages) {
            console.log(`${multi ? `\n=== 页面 ${pageId} ===` : ''}`);
            const outDir = multi ? path.join(opt.out, `page-${sanitize(pageId)}`) : opt.out;
            try {
                const frames = await listPageFrames(opt.file, pageId, opt);
                const r = await runOne(opt, outDir, pageId, frames);
                summary.push({ pageId, ...r });
            } catch (e) {
                console.error(`页面 ${pageId} 跳过：${e.message}\n`);
                summary.push({ pageId, error: String(e.message || e) });
            }
        }
        if (multi) {
            console.log('=== 汇总 ===');
            for (const s of summary) {
                console.log(s.error ? `  ${s.pageId}: 失败` : `  ${s.pageId}: ${s.ok}/${s.total} 画板`);
            }
        }
        return;
    }

    let frames = [];
    if (opt.ids) {
        frames = String(opt.ids).split(',').map((s) => s.trim()).filter(Boolean).map((id) => ({ id }));
    } else {
        const list = JSON.parse(await readFile(opt.frames, 'utf8'));
        frames = (list.frames || list).map((f) => ({ id: f.id, name: f.name }));
    }
    await runOne(opt, opt.out, undefined, frames);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
