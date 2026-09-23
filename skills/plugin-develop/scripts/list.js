#!/usr/bin/env node
// 获取插件审核列表
// 用法: node list.js [status] [page_num]
//   status: 审核状态过滤，逗号分隔，默认 "1,2"（人工审核中：1=合规已通过，2=合规未通过需复审）
//   其他状态: 0=合规审核中, 3=已发布, 4=审核未通过
const { cookieHeader } = require('./mg-auth');

const status = process.argv[2] || '1,2';
const pageNum = process.argv[3] || '1';
const BASE = 'https://mastergo.com/admin/community/api/plugin/audit';

(async () => {
  try {
    const r = await fetch(`${BASE}/list?status=${status}&page_num=${pageNum}&page_size=15`, {
      headers: { Cookie: cookieHeader() }
    });
    const j = await r.json();
    if (j.code !== 'OK') {
      console.error('请求失败:', JSON.stringify(j));
      process.exit(1);
    }
    const rows = j.data || [];
    console.log(`共 ${rows.length} 条（status=${status}）:`);
    for (const p of rows) {
      const tag = p.status === 1 ? '合规通过' : p.status === 2 ? '合规未通过' : `status=${p.status}`;
      console.log(`  [${p.plugin_id}] ${p.plugin_name} | ${tag}${p.audit_reason ? ' | 理由: ' + p.audit_reason : ''} | 作者: ${p.author_name}`);
    }
  } catch (e) {
    console.error('错误:', e.message);
    process.exit(1);
  }
})();
