#!/usr/bin/env node
// 下载插件包并做静态代码审查扫描
// 用法: node scan.js <plugin_url> [输出目录]
// 扫描内容：
//   - 外部域名引用（排除 mastergo 官方域、常见开源许可文档域）
//   - 危险模式：eval / new Function / document.cookie / localStorage /
//     fetch / XMLHttpRequest / indexedDB / sendBeacon / WebSocket
//   - mg.* 插件 API 使用统计
//   - 中文 UI 文本抽取（用于排查广告/违规内容）
const fs = require('fs');
const path = require('path');

const url = process.argv[2];
if (!url) {
  console.error('用法: node scan.js <plugin_url> [输出目录]');
  process.exit(1);
}
const outDir = process.argv[3] || path.join(process.cwd(), 'plugin-scan');

const ALLOWED_DOMAINS = [
  'mastergo.com', 'static.mastergo.com', 'image-resource.mastergo.com',
  'w3.org', 'vuejs.org', 'github.com', 'schema.org', 'localhost',
  'opensource.org', 'apache.org', 'apple.com', 'mozilla.org',
];

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, 'bundle');
  const r = await fetch(url);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(out, buf);
  const code = buf.toString('utf8');
  const size = buf.length;
  const first = buf.subarray(0, 4).toString('latin1');
  const isZip = first === 'PK\x03\x04';

  console.log(`文件大小: ${size} bytes (${isZip ? 'ZIP 压缩包' : 'HTML/JS 单文件'})`);

  if (isZip) {
    console.log('检测到 ZIP 包，请先解压后对源码逐文件扫描。');
    fs.writeFileSync(out, buf);
    return;
  }

  console.log('\n=== 外部域名引用 ===');
  const urls = new Set();
  const re = /https?:\/\/[a-zA-Z0-9._-]+/g;
  let m;
  while ((m = re.exec(code))) urls.add(m[0]);
  let extCount = 0;
  for (const u of urls) {
    if (!ALLOWED_DOMAINS.some(a => u.includes(a))) {
      console.log('  EXTERNAL:', u);
      extCount++;
    }
  }
  if (extCount === 0) console.log('  (无)');

  console.log('\n=== 危险模式计数 ===');
  const patterns = {
    'eval(': /eval\(/g,
    'new Function': /new Function/g,
    'document.cookie': /document\.cookie/g,
    'localStorage': /localStorage/g,
    'fetch(': /fetch\(/g,
    'XMLHttpRequest': /XMLHttpRequest/g,
    'indexedDB': /indexedDB/g,
    'sendBeacon': /sendBeacon/g,
    'new WebSocket': /new WebSocket/g,
  };
  let risk = 0;
  for (const [name, re2] of Object.entries(patterns)) {
    const n = (code.match(re2) || []).length;
    if (n > 0) {
      console.log(`  ${name}: ${n}`);
      if (['document.cookie', 'sendBeacon', 'indexedDB'].includes(name)) risk++;
    }
  }
  const mgCount = (code.match(/mg\./g) || []).length;
  console.log(`  mg.* 插件 API 调用: ${mgCount}`);
  console.log(`  document.cookie 写入/读取（高风险）: ${(code.match(/document\.cookie\s*=/g) || []).length}`);

  console.log('\n=== 中文 UI 文本（抽样，用于排查违规内容）===');
  const texts = new Set();
  const textRe = /["']([^"']{2,60})["']/g;
  while ((m = textRe.exec(code))) {
    const t = m[1];
    if (/[\u4e00-\u9fff]/.test(t) && !/\\\\/.test(t) && !/^[a-zA-Z0-9_.\-/@:]+$/.test(t)) {
      texts.add(t.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))));
    }
  }
  const arr = [...texts].sort();
  console.log(`共 ${arr.length} 条，前 30 条:`);
  arr.slice(0, 30).forEach(t => console.log('  -', t.slice(0, 80)));

  console.log('\n=== 审查建议 ===');
  if (extCount === 0 && risk === 0) console.log('未发现外部连接和数据外泄模式，可通过。');
  else console.log('存在外部连接或敏感模式，需结合上下文人工确认是否违规。');
}

main().catch(e => { console.error('错误:', e.message); process.exit(1); });
