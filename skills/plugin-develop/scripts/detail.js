#!/usr/bin/env node
// 获取插件审核详情
// 用法: node detail.js <plugin_id> [--raw]
const { cookieHeader } = require('./mg-auth');

const pluginId = process.argv[2];
if (!pluginId) {
  console.error('用法: node detail.js <plugin_id> [--raw]');
  process.exit(1);
}
const raw = process.argv.includes('--raw');

(async () => {
  try {
    const r = await fetch(
      `https://mastergo.com/admin/community/api/plugin/audit/detail?plugin_id=${pluginId}`,
      { headers: { Cookie: cookieHeader() } }
    );
    const j = await r.json();
    if (j.code !== 'OK') {
      console.error('请求失败:', JSON.stringify(j));
      process.exit(1);
    }
    const d = j.data;
    if (raw) {
      console.log(JSON.stringify(d, null, 2));
      return;
    }
    console.log(`插件名称 : ${d.plugin_name}`);
    console.log(`插件 ID   : ${d.plugin_id}`);
    console.log(`版本      : v${d.plugin_version}${d.version_desc ? ' (' + d.version_desc + ')' : ''}`);
    console.log(`状态      : ${d.status} (1=人工审核中/合规通过, 2=需复审, 3=已发布, 4=未通过)`);
    console.log(`作者      : ${d.author_name} (${d.author_id})`);
    console.log(`分类      : ${(d.plugin_cata || []).join(', ')}`);
    console.log(`编辑器类型: ${d.editor_type}`);
    console.log(`联系方式  : ${d.contact}`);
    console.log(`审核次数  : ${d.audit_counter}`);
    if (d.audit_reason) console.log(`合规理由  : ${d.audit_reason}`);
    console.log(`--- 插件描述 ---`);
    console.log(d.plugin_desc);
    console.log(`--- manifest ---`);
    try { console.log(JSON.stringify(JSON.parse(d.plugin_manifest), null, 2)); }
    catch { console.log(d.plugin_manifest); }
    console.log(`--- 审核备注 ---`);
    console.log(d.audit_comment || '(无)');
    console.log(`--- 资源 ---`);
    console.log(`plugin_url : ${d.plugin_url}`);
    console.log(`logo       : ${d.plugin_logo}`);
    console.log(`cover      : ${d.plugin_cover_url}`);
  } catch (e) {
    console.error('错误:', e.message);
    process.exit(1);
  }
})();
