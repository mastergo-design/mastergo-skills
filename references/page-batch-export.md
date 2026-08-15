# 整页枚举与批量导出（Page Batch Export）

> 适用场景：设计文件的一整个页面包含几十~上百个画板（流程图、弹窗集合、带跳转标注的
> 原型），需要把「全部画板 + 文字说明」一次性交给 AI（或脚本）批量消费。

## 0. 结论（2026-08 实测）

**纯 token 认证即可完成整页画板枚举，不需要安装任何插件。**
magic-mcp **v0.2.8** 新增了 `GET /mcp/page-layers` 端点（对应 MCP 工具 `getPageLayers`），
接受 **page_id** 直接返回整页图层清单。

唯一前提：**该页面曾在 MasterGo 中被打开过一次**。page-layers 读的是服务端缓存 ——
画布加载完成时客户端会自动上报图层树。未上报过的页面返回：

```json
{ "totalLayers": 0, "layers": [], "needsCanvasVisit": true, "guidance": "Layer data not cached..." }
```

注意这是「缓存未命中」，不是权限或参数问题。关于这个前提，实测要点：

- **缓存持久有效**：实测隔天再拉仍 `source: "cache"` 命中，所以同一页面**一辈子只需打开一次**，
  不必赶时间、也无需每次拉取前重开；
- **无法绕过**：已逐项验证 —— 传图层级 id 给 page-layers 只能拿到该图层子树（且该图层必须
  属于已缓存页面）；`/openapi/v1/*`、`/api/v1/*`、`/mcp/pages`、`/mcp/file-pages` 全部 404；
  `design-sections` / `dsl` 对未缓存页面返回空。**没有任何纯 token 路径能预热缓存**；
- **减少摩擦的做法**：用脚本的 `--wait`（原地轮询，打开页面后自动继续，免去「打开 → 重跑」
  的往返），以及 `--page a,b` 一次跑多页 —— 把「开页面」压缩成整个流程里唯一的一次人工动作。

各通道能力对照：

| 通道 | 认证 | 能否枚举页面画板 | 说明 |
|------|------|------------------|------|
| `getPageLayers` / `/mcp/page-layers` | ✅ 纯 token | ✅ | **首选**。传 page_id，返回全页扁平图层清单；需页面曾被打开过（缓存） |
| `getDesignSections` / `/mcp/design-sections` | ✅ 纯 token | ❌ | 只认**图层级 layerId**；传 page_id 返回 `{sections:[],totalSections:0}` **且不报错**（最易踩的坑，加 `fromPageParam=true` 也一样） |
| `getDsl` / `/mcp/dsl` | ✅ 纯 token | ❌ | 同上，只认图层级 layerId；整层 DSL 很大，慎用 |
| 官方 REST API（内测） | ✅ 纯 token | ❌ | developers.mastergo.com/rest-api 只有团队/项目/文件**管理**接口，无设计节点树 |
| D2C（`getD2c`） | ✅ 纯 token | ❌ | 按 contentId 出码；文件需**企业版权限**，否则报 `10013 禁止访问` |
| Vibe MCP（vibe-mcp） | 桌面客户端会话 | ✅（读选区等） | 需桌面客户端运行 + 文件打开 + MCP 已连接，适合「边看边取」交互场景 |
| 插件（editor 内 `mg.currentPage.children`） | 编辑器会话 | ✅ | 兜底手段，v0.2.8 后已无必要 |

## 1. MCP REST 底层接口（逆向自 @mastergo/magic-mcp v0.2.8）

> ⚠️ 非官方公开 API，是 magic-mcp 的服务端实现细节，**可能随版本变动**。
> 优先走 MCP 工具；REST 直调用于脚本化批处理。

- Base URL：`https://mastergo.com`（`MG_API_BASE` / `API_BASE_URL` 可覆盖）
- 认证：请求头 `X-MG-UserAccessToken: mg_xxx`
  （magic-mcp 取自环境变量 `MG_MCP_TOKEN` 或 `MASTERGO_API_TOKEN`）

| 端点 | 对应 MCP 工具 | 说明 |
|------|--------------|------|
| `GET /mcp/page-layers?fileId=&layerId=<pageId>` | getPageLayers | **整页图层清单**（见第 2 节）；服务端 60s 内存缓存 |
| `GET /mcp/design-sections?fileId=&layerId=[&sectionIndex=N]` | getDesignSections | 不传 sectionIndex 返回分区目录（含 `rootMetadata.allTexts` 文本白名单、splitContainers 坐标），传了返回单区 DSL |
| `GET /mcp/dsl?fileId=&layerId=&format=json\|yaml\|tree` | getDsl | 整层 DSL（大，慎用） |
| `GET /mcp/extract-svg?fileId=&layerId=[&page=&pageSize=]` | extractSvg | 提取 PATH 节点 SVG |
| `GET /mcp/meta?fileId=&layerId=` | getMeta | 站点级 meta/action（需设计师在文件里配置，否则空） |
| `GET /mcp/style?fileId=&layerId=` | （组件样式） | getComponentStyleJson 用 |
| `GET /mcp/d2c/events?contentId=&documentId=` | getD2c | D2C 出码 |
| `POST /mcp/c2d` | C2d | 代码转设计 |
| `POST /mcp/apply-design` | applyDesign | 占位符替换后落盘 |

要点重申：除 page-layers 外，**其余端点的 layerId 必须是图层 ID，不是 page_id**；
传 page_id 会返回空结果**且 HTTP 200 不报错**。

## 2. page-layers 返回结构与画板筛选

```json
{
  "fileId": "115835509271418",
  "pageLayerId": "808:150160",
  "totalLayers": 3153,
  "layers": [
    { "id": "1365:60274", "name": "弹窗", "type": "FRAME", "depth": 0, "childrenCount": 3 },
    { "id": "1365:60274/808:152750", "name": "Left Icon", "type": "FRAME", "depth": 0,
      "parentId": "1365:60274", "childrenCount": 1 }
  ],
  "source": "cache",
  "nextAction": "STOP. This is a layer LIST — ..."
}
```

字段只有 `id / name / type / depth / parentId / childrenCount`（**没有 width/height/x/y**，
工具描述里若声称有请以实测为准；`depth` 实测恒为 0，不可用于筛选）。

**筛「顶层画板」的正确判据（实测）**：

1. `parentId` 为空 —— 页面直接子节点（示例：3153 层里 210 个）；
2. `id` 不含 `/` —— 形如 `1365:60274/808:152750` 的路径式 id 是组件实例内部子层，排除；
3. `type` 在白名单内 —— `SECTION` / `FRAME` / `COMPONENT` / `INSTANCE`，以及 `9`（GROUP，
   流程图里常见的成组画板）。`type` 可能是字符串枚举名，也可能是数字码
   （已见：`9`=GROUP、`10`=直线、`12`=椭圆、`13`=矩形、`25`=TEXT、`33`=PATH/Vector、`37`=连接线）；
4. `childrenCount >= 1` —— 过滤零散文本、连接线等非画板节点。

按此规则，示例页面 3153 层 → 88 个可出码画板。

## 3. 一条命令拉全页（`scripts/mcp-batch-fetch.mjs`）

脚本已内置枚举 + 批量拉取两步，纯 token 无人值守：

```bash
export MG_MCP_TOKEN=mg_xxx
# 最省事：直接粘 MasterGo 链接，自动解出 fileId + page_id
node scripts/mcp-batch-fetch.mjs --url 'https://mastergo.com/file/1158...?page_id=808%3A150160' --out ./mg-dump
# 整页
node scripts/mcp-batch-fetch.mjs --file 115835509271418 --page 808:150160 --out ./mg-dump
# 多页一次跑完（各自落到 <out>/page-<id>/，某页未缓存只跳过该页不中断）
node scripts/mcp-batch-fetch.mjs --file 1158... --page 808:150160,5496:96753 --out ./mg-dump
# 页面还没打开过：--wait 原地等，你在浏览器打开后脚本自动继续
node scripts/mcp-batch-fetch.mjs --file 1158... --page 5496:96753 --wait --out ./mg-dump
# 先看清单不落盘
node scripts/mcp-batch-fetch.mjs --file 1158... --page 808:150160 --list-only
# 指定画板
node scripts/mcp-batch-fetch.mjs --file 1158... --ids 5771:91198,5771:92001 --out ./mg-dump
```

可选参数：`--url <长链>`（不支持 `/goto/` 短链）、`--wait [秒]`（默认 300）、
`--min-children N`（默认 1）、`--types A,B`（覆盖类型白名单）、`--limit N`（调试取前 N 个）。

特性：

- 串行限速（默认 300ms 间隔，`MCP_FETCH_INTERVAL_MS` 可调），失败单个记录不中断整批；
- **429/5xx 指数退避重试**（`MCP_FETCH_MAX_RETRIES=5`、`MCP_FETCH_RETRY_BASE_MS=2000`，
  服务端给 `Retry-After` 时优先采用）。实测整页 88 个画板跑到第 80 个必撞 429，
  间隔建议 800ms 起；
- **幂等**：已存在的 section 文件跳过，重跑只补缺的（撞限流后直接重跑即可补齐）；
- 页面未缓存时给出明确指引（打开哪个 URL、为什么、缓存持久），不静默产出空结果；
- 输出：
  - `<out>/frames.json` —— 画板清单
  - `<out>/<layerId>/sections-index.json` —— 分区目录（含 allTexts、splitContainers）
  - `<out>/<layerId>/section-N.json` —— 各分区 DSL
  - `<out>/index.json` —— 汇总（每画板 sections 数、allTexts、bbox、错误）

## 4. 批量消费工作流（AI 生成代码场景）

1. `--list-only` 拿清单，人工过一眼画板名（`弹窗`/`smile` 这类重复名很多，靠 id 区分）；
2. 批量拉 DSL 落盘；
3. `allTexts` 是该画板全部真实可见文本的**白名单**，既作需求上下文，也用于生成后自校验防幻觉
   （任何不在 allTexts 里的可见文案 = 占位符或幻觉）；
4. AI 逐个画板出码，**一个画板 = 一个独立 standalone HTML 文件**，不要合并；
5. 同构画板（分区目录里 `structureHash` 相同）只拉首个、其余复用结构换文案。

跳转关系（原型交互 `reactions`）不在 page-layers / design-sections 的返回里。如需页面跳转
地图，只能靠编辑器内插件读节点 `reactions`（`mg.currentPage` 全树扫描，跳转常挂在按钮等
内层节点上），或让设计师导出交互说明。

## 5. 给上游的能力缺口建议（feature request）

1. **（最关键）page-layers 依赖「页面被打开过」的缓存，冷启动时纯 token 流程必须有人去点一次
   浏览器。** 已验证无任何绕过路径。建议服务端在缓存未命中时**直接解析文件**
   （design-sections 已具备整文件解析能力），或提供 `POST /mcp/page-layers/warmup` 预热端点。
   顺带：文件的**页面列表**也没有任何接口可取（`/mcp/pages`、`/openapi/v1/files/:id/pages` 均 404），
   page_id 只能靠人从 URL 复制；
2. layers 清单缺 `x/y/width/height`，无法在不逐个请求的前提下按画布位置排序 / 还原流程图布局；
3. `depth` 字段恒为 0，形同废字段，建议修正为真实层级；
4. 清单里没有 `reactions`，跳转逻辑无法纯 token 获取。
