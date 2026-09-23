#!/usr/bin/env node
// 执行插件审核操作（通过/拒绝）
// 用法:
//   node audit.js <plugin_id> pass            # 审核通过（发布至插件社区）
//   node audit.js <plugin_id> reject "<原因>"  # 审核不通过（需写明原因）
const { cookieHeader } = require('./mg-auth');

const pluginId = process.argv[2];
const action = process.argv[3];
if (!pluginId || !['pass', 'reject'].includes(action || '')) {
  console.error('用法: node audit.js <plugin_id> pass|reject ["不通过原因"]');
  process.exit(1);
}
const auditMsg = process.argv[4] || '';

(async () => {
  const body = { plugin_id: Number(pluginId), status: action === 'pass' ? 3 : 4 };
  if (action === 'reject') {
    if (!auditMsg) {
      console.error('审核不通过必须写明原因');
      process.exit(1);
    }
    body.audit_msg = auditMsg;
  }
  console.log('请求体:', JSON.stringify(body));
  const r = await fetch('https://mastergo.com/admin/community/api/plugin/audit', {
    method: 'POST',
    headers: { Cookie: cookieHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const j = await r.json();
  if (j.code === 'OK') {
    console.log('操作成功:', action === 'pass' ? '已审核通过并发布' : '已审核不通过');
  } else {
    console.error('操作失败:', JSON.stringify(j));
    process.exit(1);
  }
})();
