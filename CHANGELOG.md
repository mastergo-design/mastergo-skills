# Changelog

## [2026-08-15] v1.0.0
- **仓库重命名**：`plugin-develop-skill` → `mastergo-skills`，作为 MasterGo 各 skill 的集合仓库（`skills/<skill-name>/` 目录约定，与内部 skills 模板一致）
- **拆分两个 skill**：
  - `skills/plugin-develop/`：原插件开发 skill（场景 A 插件开发 + 场景 B API 变更同步），更名为 `mastergo-plugin-develop`，v0.8.1 → v0.9.0
  - `skills/dsl-to-code/`：新增 skill（场景 A DSL 获取 + 场景 B DSL → html/vue/react/flutter 代码转换），v0.1.0
- **迁移**：`references/page-batch-export.md` + `scripts/mcp-batch-fetch.mjs` 从 plugin-develop 迁入 dsl-to-code（原场景 C 代码部分）
- **调研沉淀**：盘点 mcp server / dsl transfer 链路（master-dsl-tansfer / frontend-mcp-server / mastergo-magic-mcp），
  结论：用户只拿 DSL 时，纯 skill 的转换路径 = LLM 直接基于 DSL 生成代码；DSL 数据结构、硬性生成规则（token 变量化 / SVG 原样 / 防幻觉）、各框架映射要点写入 dsl-to-code/SKILL.md

## [2026-08-12] v0.8.1
- `mcp-batch-fetch.mjs` 易用性：新增 `--url`（粘 MasterGo 长链自动解析 fileId/page_id/layer_id）、`--wait [秒]`（页面未缓存时原地轮询，用户打开后自动继续，免去「打开→重跑」往返）、`--page a,b` 多页一次跑完（各自落 `<out>/page-<id>/`，单页失败不中断）
- 新增 429/5xx 指数退避重试（优先采用 `Retry-After`）——实测整页 88 画板跑到第 80 个必撞限流
- 实测补充：缓存**持久有效**（隔天仍命中，同页只需开一次）；并逐项验证**无任何纯 token 路径可绕过/预热缓存**（`/openapi/v1/*`、`/api/v1/*`、`/mcp/pages`、`/mcp/file-pages` 均 404；传图层 id 只返回已缓存页面内的子树）。文件页面列表同样无接口可取，已写入上游 feature request


## [2026-08-12] v0.8.0
- 场景 C 整页批量导出改为**纯 token 免插件**：magic-mcp v0.2.8 新增 `GET /mcp/page-layers`（MCP 工具 `getPageLayers`）支持传 page_id 枚举整页图层，实测 3153 层 → 88 个顶层画板
- `scripts/mcp-batch-fetch.mjs` 内置枚举，新增 `--page/--list-only/--min-children/--types/--limit`，一条命令完成整页枚举 + 批量拉 DSL（端到端已实测，含幂等重跑与未缓存页面的明确指引）
- 移除 `assets/page-exporter/` 插件及相关说明；修正 v0.7.0 的错误结论（当时基于 v0.2.7 判定「纯 token 无解」）
- `references/page-batch-export.md` 重写：补 page-layers 返回结构、画板筛选判据（parentId 为空 + id 不含 `/` + 类型白名单 + childrenCount）、缓存机制（needsCanvasVisit）、完整 REST 端点清单与 type 数字码对照


## [2026-08-11] v0.7.0
- 新增场景 C「整页批量导出」：`references/page-batch-export.md`（官方通道能力边界矩阵——纯 token 页面枚举目前无解的逐项验证结论、MCP REST 底层接口清单、两段式工作流）+ 现成插件 `assets/page-exporter/`（画板枚举、文字/批注、跳转逻辑 reactions 导出）+ `scripts/mcp-batch-fetch.mjs`（纯 key 批量拉 DSL，幂等/限速/断点续拉，已实测）


## [2026-07-31] v0.6.0
- 新增开发指南补遗：插件发布流程、网络请求注意事项、Vue/React 模板、动画、Drop 事件、图片数据处理


## [2026-07-31] v0.5.0
- 新增智能容器节点 (IntelligentContainerNode/GLSL shader) 和文本子图层节点 (TextSublayerNode) API 章节


## [2026-07-30] v0.4.0
- 新增 mg.variables 变量系统、mg.WebSocket 通信、原型交互类型 (Reaction/Trigger/Action/Transition/Easing) 三个核心 API 章节


## [2026-06-17] v0.3.0
- Init: chore: consolidate mastergo plugin skills + update mcp oncall

<details>
<summary>History (3 commits)</summary>

3f5a2a8 sync: update mastergo-plugin, fund-valuation, loop-agent from local
e60e2f4 update mastergo-plugin skill
dc9298c chore: consolidate mastergo plugin skills + update mcp oncall

</details>
