#!/usr/bin/env node
// 生成"运行线上插件"需要的插件 JSON，并在 dev 环境驱动运行验证。
//
// 背景：SOP 要求把审核平台的插件复制到 dev 画布，通过「运行线上插件」流程
// （顶栏插件入口 → 运行线上插件 → 粘贴插件 JSON → 失焦 → 左下角插件图标 → 点击运行）
// 实际运行待审核插件，运行结果须与插件描述一致才算通过。
//
// 用法:
//   node run-online.js <plugin_id> --prepare
//     从审核接口拉取插件行对象，输出 JSON.stringify(row)。
//     该内容即审核平台「复制插件」按钮复制的插件信息 JSON，可手动粘贴到 dev 画布。
//   node run-online.js <plugin_id> --run [--out <截图路径>] [--cli <mastergo-cli 入口>] [--wait <ms>]
//     拉取插件 JSON → 调用 mastergo-cli `plugin run-online` 驱动 dev 画布自动运行，
//     输出运行验证结果（trigger / pluginFrame / console / screenshot），不自行审核。
//
// 前置条件（run 模式）：
//   1. 本地 Chrome 已开 CDP（默认 9222，可用 MG_CDP_ENDPOINT 覆盖）且已打开
//      dev.mastergo.com/file/:id 并登录。复用 mastergo-web-automation skill
//      「无浏览器 MCP 时自起 Chrome + CDP + cookie 注入」章节启动。
//   2. mastergo-cli 已构建（默认 ~/ZCodeProject/mastergo-cli/dist/cli.js，
//      可用环境变量 MG_CLI 或 --cli 覆盖）。
const { cookieHeader } = require('./mg-auth');

const pluginId = process.argv[2];
if (!pluginId) {
  console.error('用法: node run-online.js <plugin_id> --prepare|--run [--out <截图>] [--cli <入口>]');
  process.exit(1);
}
const mode = process.argv.includes('--prepare') ? 'prepare' : process.argv.includes('--run') ? 'run' : null;
if (!mode) {
  console.error('必须指定 --prepare 或 --run');
  process.exit(1);
}

// mastergo-cli 入口，需显式指定（可用 --cli 覆盖），不内置任何本机绝对路径
const DEFAULT_CLI = process.env.MG_CLI_PATH || '';
function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

async function getRow() {
  const r = await fetch(
    `https://mastergo.com/admin/community/api/plugin/audit/detail?plugin_id=${pluginId}`,
    { headers: { Cookie: cookieHeader() } }
  );
  const j = await r.json();
  if (j.code !== 'OK') throw new Error('detail 请求失败: ' + JSON.stringify(j));
  return j.data;
}

async function main() {
  const row = await getRow();
  if (!row) {
    console.error(`未找到插件 ${pluginId}`);
    process.exit(1);
  }
  const json = JSON.stringify(row);

  if (mode === 'prepare') {
    // 输出即「复制插件」内容，可直接粘贴到 dev 画布「运行线上插件」输入框
    console.log(json);
    return;
  }

  // run 模式：调用 mastergo-cli 驱动 dev 画布自动运行
  const cli = process.env.MG_CLI || argValue('--cli') || DEFAULT_CLI;
  if (!cli) {
    console.error('未指定 mastergo-cli 路径：请设置 MG_CLI_PATH 或传 --cli <path/to/cli.js>');
    process.exit(1);
  }
  const out = argValue('--out') || `plugin-${pluginId}-run.png`;
  const wait = argValue('--wait') || '8000';

  const { spawnSync } = require('node:child_process');
  const r = spawnSync(
    process.execPath,
    [cli, 'plugin', 'run-online', '-', '--console', '--screenshot', out, '--wait', wait],
    { input: json, encoding: 'utf8', timeout: 120000 }
  );
  if (r.error) {
    console.error('调用 mastergo-cli 失败:', r.error.message);
    process.exit(1);
  }
  if (r.status !== 0) {
    console.error('mastergo-cli 退出码', r.status);
    if (r.stderr) console.error(r.stderr);
    process.exit(r.status || 1);
  }

  let parsed;
  try {
    parsed = JSON.parse(r.stdout);
  } catch {
    console.error('mastergo-cli 输出不是 JSON:\n' + r.stdout);
    process.exit(1);
  }

  // 输出结构化运行验证结果（不判通过/不通过，交给审核人）
  const trigger = parsed.trigger || {};
  const result = {
    plugin_id: Number(pluginId),
    plugin_name: row.plugin_name,
    run_step: trigger.step ?? null,
    run_ok: trigger.ok ?? false,
    run_msg: trigger.msg ?? null,
    plugin_frame: parsed.pluginFrame ?? null,
    screenshot: parsed.screenshot ?? null,
  };
  if (Array.isArray(parsed.console) && parsed.console.length) {
    result.console_errors = parsed.console.filter((c) => ['error', 'warning'].includes(c.type)).slice(0, 20);
  }
  if (parsed.screenshotError) result.screenshot_error = parsed.screenshotError;
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error('错误:', e.message);
  process.exit(1);
});
