---
name: mastergo-dsl-to-code
description: MasterGo 设计 DSL → 代码转换 skill。覆盖两类场景：(A) DSL 获取——纯 token 免插件的页面级画板枚举(getPageLayers)、按画板批量拉取 /mcp/dsl 落盘、按单图层 id 队列拉取(getDslByLayerIds 脚本队列)、allTexts 文本白名单防幻觉；(B) DSL → 代码——优先用 getDsl 拿真实 path[].data 的整层 DSL，把 DSL 转换为 html / vue / react / flutter 等目标代码；getDesignSections + applyDesign 仅作为整层 DSL 过大或需要分区分发的兜底。触发词：mastergo dsl、dsl to code、dsl 转代码、设计转代码、整页导出、页面画板枚举、批量拉取、getDslByLayerIds、跳转逻辑导出、reactions 导出、mg.codegen、getDSL、getCodeByDSL。
version: 0.1.2
---

# MasterGo DSL 获取与代码转换

本 skill 负责 MasterGo 设计数据的「获取」与「转换」两个环节：先把设计稿（页面/画板）批量拉成
结构化 DSL，再把 DSL 交给 LLM 生成 html / vue / react / flutter 等目标代码。

## 场景路由

- **场景 A：获取 DSL**（纯 token 免插件：页面级画板枚举 / 按画板批量拉 `/mcp/dsl` / 文本白名单防幻觉）
  → 见 `references/page-batch-export.md` + 一体化脚本 `scripts/mcp-batch-fetch.mjs`
- **场景 B：DSL → 代码**（拿到 DSL 后按目标框架生成 html / vue / react / flutter 代码）
  → 见下方「# DSL → 代码转换」

> 辅助资料：`references/page-batch-export.md`（通道能力对照 / 画板筛选判据 / REST 端点清单）、
> `references/dsl-schema.md`（MCP `Dsl` 结构契约）、`references/codegen-rules.md`（生成硬规则与
> 各框架映射）、`scripts/mcp-batch-fetch.mjs`（整页枚举 + 批量拉取脚本）按需读取。

---

<!-- ==================== 场景 A：获取 DSL ==================== -->

# 整页枚举与批量导出（Page Batch Export）

> 适用场景：设计文件的一整个页面包含几十~上百个画板（流程图、弹窗集合、带跳转标注的
> 原型），需要把「全部画板 + 文字说明」一次性交给 AI（或脚本）批量消费。

## 结论（2026-08 实测）

**纯 token 认证即可完成整页画板枚举，不需要安装任何插件。**
magic-mcp **v0.2.8** 新增了 `GET /mcp/page-layers` 端点（对应 MCP 工具 `getPageLayers`），
接受 **page_id** 直接返回整页图层清单。

唯一前提：**该页面曾在 MasterGo 中被打开过一次**。page-layers 读的是服务端缓存 ——
画布加载完成时客户端会自动上报图层树。未上报过的页面返回：

```json
{ "totalLayers": 0, "layers": [], "needsCanvasVisit": true, "guidance": "Layer data not cached..." }
```

注意这是「缓存未命中」，不是权限或参数问题。实测要点：

- **缓存持久有效**：实测隔天再拉仍 `source: "cache"` 命中，同一页面**一辈子只需打开一次**；
- **无法绕过**：`/openapi/v1/*`、`/api/v1/*`、`/mcp/pages`、`/mcp/file-pages` 全部 404；
  `design-sections` / `dsl` 对未缓存页面返回空。**没有任何纯 token 路径能预热缓存**；
- **减少摩擦**：用脚本的 `--wait`（原地轮询，打开页面后自动继续），以及 `--page a,b` 一次跑多页。

各通道能力对照：

| 通道 | 认证 | 能否枚举页面画板 | 说明 |
|------|------|------------------|------|
| `getPageLayers` / `/mcp/page-layers` | ✅ 纯 token | ✅ | **首选**。传 page_id，返回全页扁平图层清单；需页面曾被打开过（缓存） |
| `getDsl` / `/mcp/dsl` | ✅ 纯 token | ❌ | 只认**图层级 layerId**；传 page_id 返回空且 HTTP 200 不报错 |
| `getDesignSections` / `/mcp/design-sections` | ✅ 纯 token | ❌ | 只认**图层级 layerId**；传 page_id 返回 `{sections:[],totalSections:0}` **且不报错**（最易踩的坑） |
| 官方 REST API（内测） | ✅ 纯 token | ❌ | developers.mastergo.com/rest-api 只有团队/项目/文件**管理**接口，无设计节点树 |
| D2C（`getD2c`） | ✅ 纯 token | ❌ | 按 contentId 出码；文件需**企业版权限**，否则报 `10013 禁止访问` |
| Vibe MCP（vibe-mcp） | 桌面客户端会话 | ✅（读选区等） | 需桌面客户端运行 + 文件打开 + MCP 已连接，适合「边看边取」交互场景 |
| 插件（editor 内 `mg.currentPage.children`） | 编辑器会话 | ✅ | 兜底手段，v0.2.8 后已无必要 |

## MCP REST 底层接口（逆向自 @mastergo/magic-mcp v0.2.8）

> ⚠️ 非官方公开 API，是 magic-mcp 的服务端实现细节，**可能随版本变动**。
> 优先走 MCP 工具；REST 直调用于脚本化批处理。

- Base URL：`https://mastergo.com`（`MG_API_BASE` / `API_BASE_URL` 可覆盖）
- 认证：请求头 `X-MG-UserAccessToken: mg_xxx`（magic-mcp 取自 `MG_MCP_TOKEN` 或 `MASTERGO_API_TOKEN`）

| 端点 | 对应 MCP 工具 | 说明 |
|------|--------------|------|
| `GET /mcp/page-layers?fileId=&layerId=<pageId>` | getPageLayers | **整页图层清单**；服务端 60s 内存缓存 |
| `GET /mcp/dsl?fileId=&layerId=&format=json\|yaml\|tree` | getDsl | **本 skill 主路径**。返回 `Dsl { styles, nodes, components }`，PATH 节点带真实 `path[].data`，无需 applyDesign |
| `GET /mcp/design-sections?fileId=&layerId=[&sectionIndex=N]` | getDesignSections | **兜底路径**。不传 sectionIndex 返回分区目录（含 `rootMetadata.allTexts` 文本白名单、splitContainers 坐标），传了返回单区 DSL |
| `GET /mcp/extract-svg?fileId=&layerId=[&page=&pageSize=]` | extractSvg | 提取 PATH 节点 SVG |
| `GET /mcp/meta?fileId=&layerId=` | getMeta | 站点级 meta/action（需设计师在文件里配置，否则空） |
| `GET /mcp/style?fileId=&layerId=` | （组件样式） | getComponentStyleJson 用 |
| `GET /mcp/d2c/events?contentId=&documentId=` | getD2c | D2C 出码 |
| `POST /mcp/c2d` | C2d | 代码转设计 |
| `POST /mcp/apply-design` | applyDesign | section DSL 占位符替换后落盘（仅兜底流程需要） |

要点重申：除 page-layers 外，**其余端点的 layerId 必须是图层 ID，不是 page_id**；
传 page_id 会返回空结果**且 HTTP 200 不报错**。

## 一条命令拉全页（`scripts/mcp-batch-fetch.mjs`）

脚本已内置枚举 + 批量拉取两步，纯 token 无人值守。**落盘的是 `/mcp/dsl` 原始 `Dsl`**，
每个画板一个 `dsl.json`，同时生成该画板的 `texts.json` 文本白名单。

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
# getDslByLayerIds 队列能力：给定一批单图层 id，按并发队列逐个拉 /mcp/dsl
node scripts/mcp-batch-fetch.mjs --file 1158... --ids 5771:91198,5771:92001 --concurrency 3 --out ./mg-dump
```

可选参数：`--url <长链>`（不支持 `/goto/` 短链）、`--wait [秒]`（默认 300）、
`--min-children N`（默认 1）、`--types A,B`（覆盖类型白名单）、`--limit N`（调试取前 N 个）、
`--concurrency N`（并发队列大小，默认 2，`MCP_FETCH_CONCURRENCY` 可覆盖）。

特性：

- 并发队列 + 单请求限速（`--concurrency` 控制队列大小，默认 2；`MCP_FETCH_INTERVAL_MS` 控制单 worker
  任务间隔，默认 300ms），失败单个记录不中断整批；
- **429/5xx 指数退避重试**（`MCP_FETCH_MAX_RETRIES=5`、`MCP_FETCH_RETRY_BASE_MS=2000`，
  服务端给 `Retry-After` 时优先采用）。实测整页 88 个画板跑到第 80 个必撞 429，
  间隔建议 800ms 起；
- **幂等**：已存在的 `dsl.json` 跳过，重跑只补缺的（撞限流后直接重跑即可补齐）；
- 页面未缓存时给出明确指引（打开哪个 URL、为什么、缓存持久），不静默产出空结果；
- 输出：
  - `<out>/frames.json` —— 画板清单
  - `<out>/<layerId>/dsl.json` —— 该画板的原始 `Dsl { styles, nodes, components }`
  - `<out>/<layerId>/texts.json` —— 从该画板 DSL 收集到的全部真实文本（白名单）
  - `<out>/index.json` —— 汇总（每画板 node/component/style 数量、allTexts 长度、错误）

## 批量消费工作流（AI 生成代码场景）

1. `--list-only` 拿清单，人工过一眼画板名（`弹窗`/`smile` 这类重复名很多，靠 id 区分）；
2. 批量拉 DSL 落盘（每画板 `dsl.json` + `texts.json`）；
3. `texts.json` 是该画板全部真实可见文本的**白名单**，既作需求上下文，也用于生成后自校验防幻觉
   （任何不在白名单里的可见文案 = 占位符或幻觉）；
4. AI 逐个画板出码，**一个画板 = 一个独立 standalone HTML 文件**，不要合并；
5. 结构相同的画板可复用生成结构、只换文案；但不要因为“看起来重复”而跳过文本差异。

跳转关系（原型交互 `reactions`）不在 page-layers / dsl 的稳定返回里。如需页面跳转地图，
只能靠编辑器内插件读节点 `reactions`（`mg.currentPage` 全树扫描），或让设计师导出交互说明。

## 给上游的能力缺口建议（feature request）

1. **（最关键）page-layers 依赖「页面被打开过」的缓存**，冷启动时纯 token 流程必须有人去点一次
   浏览器。建议服务端在缓存未命中时直接解析文件，或提供 `POST /mcp/page-layers/warmup` 预热端点；
   文件的**页面列表**也没有任何接口可取，page_id 只能靠人从 URL 复制；
2. layers 清单缺 `x/y/width/height`，无法按画布位置排序 / 还原流程图布局；
3. `depth` 字段恒为 0，形同废字段；
4. 清单里没有 `reactions`，跳转逻辑无法纯 token 获取。

---

<!-- ==================== 场景 B：DSL → 代码转换 ==================== -->

# DSL → 代码转换

用户拿到 DSL（无论来自 `scripts/mcp-batch-fetch.mjs` 落盘、MCP 工具 `getDsl` 直取、
还是 DevMode 插件内 `mg.codegen.getDSL`）后，需要把它转换为目标框架代码
（html / vue / react / flutter 等）。本 skill 的目标就是**只用 skill（提示词 + 规则 + 脚本），
不依赖额外服务**地完成转换。

## 核心结论：主路径用 `getDsl`，`getDesignSections` 只是兜底

`getDesignSections` 的设计目标是**解决 MCP 上下文过大**：把整层拆成多个 section 分发，
PATH 节点只给 `svgShortKey`，最后靠 `applyDesign` 统一替换 SVG 和长文本。

**skill 是本地批处理，上下文压力小，不需要这个分发机制。** 因此主路径应直接取整层 DSL：

- **主路径**：`mcp__getDsl(fileId, layerId)`（MCP）或 `GET /mcp/dsl?fileId=&layerId=`（REST）
  - 返回 `Dsl { styles, nodes, components }`
  - PATH 节点带**真实 `path[].data`**，生成代码时直接内联 SVG，**无需 `applyDesign`**
  - 适合绝大多数画板；一个画板一个 `Dsl`，直接转换
- **兜底路径**：当整层 DSL 太大、或已经走 `getDesignSections` 拿了一堆 section DSL 时：
  1. `getDesignSections` 不传 sectionIndex → 拿分区目录 + `rootMetadata.allTexts` + splitContainers
  2. 逐个 `getDesignSections?sectionIndex=i` → 拿分区 DSL（PATH 只有 `svgShortKey`）
  3. 代码生成用 `@@SVG:{svgShortKey}@@` 占位符 + 长文本 `T{si}|{nodeId}` 占位符
  4. 最后 `mcp__applyDesign` 替换占位符并落盘
  - 这是 section 工作流的完整形态，不是本 skill 的默认路径

> 注意：当前 `frontend-mcp-server` 工具列表里没有独立的 `getDslByLayerIds` MCP 工具。
> 因此这个 skill 把 `getDslByLayerIds` 做成了**脚本队列能力**：`mcp-batch-fetch.mjs --ids ... --concurrency N`
> 会按单个图层 id 逐个走 `/mcp/dsl`，用并发队列拉取；不需要依赖服务端单独暴露该工具。
> 如果未来 MCP 服务端补上 `getDslByLayerIds`，再把它切换为对应的 MCP 工具即可。

## 输入契约：MCP `Dsl` 结构

完整字段见 `references/dsl-schema.md`。这里只记最关键的：

```typescript
type Dsl = {
  styles: StyleMap;          // { [paint_*]: PaintStyle; [font_*]: FontStyle; [effect_*]: EffectStyle }
  nodes: SceneNode[];        // 顶层节点，节点内用 children 递归
  components: ComponentNode[]; // 组件定义
};
```

- **所有节点**都是 `SceneNode` 联合：`LAYER | GROUP | FRAME | PATH | TEXT | COMPONENT | COMPONENT_SET | INSTANCE | SVG_ELLIPSE`
- **节点公共字段**：`id / name / layoutStyle / opacity? / mask? / needParse? / interactive?`
- **布局字段**：`layoutStyle.width/height/relativeX/relativeY/rotate/rotateX/flipV/min|maxWidth/min|maxHeight`；
  有 `flexContainerInfo` 时以 flex 布局为准，width/height 仅参考
- **样式解析**：
  - `_color` 是已解析 CSS 色值，直接用于 `color/background`，不用再查 `styles`
  - `_token` 是设计令牌名，用于生成 CSS 变量（如 `--text-text-4`），声明处必须注释 token 名
  - 没有 `_color` 时，按 `fill`/`strokeColor`/`font`/`effect` 引用去 `styles` 表查实际值
- **PATH 节点**：`path: { data: string; fill: PaintStyleId; transform?: string; fillType?: number }[]`
  —— `data` 是完整 SVG path 数据，**原样使用，禁止手绘近似**
- **TEXT 节点**：`text: { text: string; font: FontStyleId }[]`，还有 `textColor / textAlign / textMode`
- **INSTANCE 节点**：`componentId` 指向 `components` 中的组件定义
- **INTERACTIVE**：`interactive?: Array<{ type: 'navigation', targetLayerId: string }>`

### 与旧版 `MGDSLData` 的区别

旧 SKILL 曾误把 DevMode `mg.codegen` 的 `MGDSLData`（`nodeMap/localStyleMap/fileMap/root/entry/settings`）
当作 MCP 返回结构。**这是错的**。MCP `getDsl` 和 `/mcp/dsl` 返回的是上面的 `Dsl { styles, nodes, components }`，
没有 `nodeMap`，也没有 `root/entry`，而是**顶层节点数组 + 节点内 `children` 递归**。转换时不要再去
`nodeMap` 按 id 索引。

## 转换流程（场景 B 标准步骤）

1. **确认输入**：拿到一个画板的 DSL（`Dsl`）与目标框架（html / vue3 / react / flutter，
   未指定默认 html 单文件）
2. **读结构**：从 `dsl.nodes` 出发沿 `children` 递归，建立节点树（容器/文本/图片/矢量/实例）
3. **布局映射**：有 `flexContainerInfo` 的容器 → flex 布局；否则按 `layoutStyle.relativeX/relativeY`
   绝对定位（`position:absolute; left/top`，注意父容器坐标基准）
4. **样式映射**：先看节点 `_color`/`_token`；缺失再查 `styles`；token 字段变量化
5. **矢量/图标**：`getDsl` 的 PATH 节点有真实 `path[].data`，**原样内联 `<svg><path d="..."/></svg>`**；
   若走 section 兜底，则只放 `@@SVG:{svgShortKey}@@` 占位符，最后 `applyDesign`
6. **文本**：用 DSL 中 TEXT 节点的真实内容；`getDsl` 没有现成 `allTexts` 时，先从 DSL 递归收集文本
   作为白名单，再自校验
7. **自校验**：生成完成后，把输出中的可见文案与白名单比对，不在白名单的一律修正
8. **输出**：一个画板 = 一个独立文件（standalone HTML 或 .vue / .tsx / .dart），不跨画板合并

## 硬性生成规则

见 `references/codegen-rules.md`。核心四条：

1. **token 字段必须生成变量**：颜色、阴影、字体等带 `token` / `_token` 的字段，
   一律产出变量（CSS 变量 / 设计令牌），且变量声明处必须带注释说明 token 名；
2. **图标 SVG 必须原样拷贝**：`getDsl` 的 PATH 节点用 `path[].data` 原样嵌入，禁止用手绘
   `<rect>/<circle>/<polygon>` 近似替代，即使看起来很像；
3. **复合/多子路径图标（logo）**：完整保留 `<svg>` 内所有 path。**禁止**拿节点画布坐标手算
   `transform="translate(x,y) scale(...)"` —— 那是画布摆放坐标，不是 SVG 内部变换；
4. **禁止编造数据**：只渲染 DSL 中真实存在的行/列/条目，不要为了“视觉密度”补占位内容；
   任何可见文案必须能追溯到 DSL 文本节点。

## 各框架转换要点

见 `references/codegen-rules.md` 的「框架映射」章节。简要版：

- **html（默认）**：单文件 `index.html`，内联 CSS；flex → `display:flex; ...`；绝对定位 →
  `position:relative` 父级 + `position:absolute; left/top` 子级
- **vue3**：单文件组件 `<template> + <script setup> + <style scoped>`；token → CSS 变量或 `:style`
- **react**：JSX + 内联 `style={{}}`；flex 用 `display:'flex', flexDirection, justifyContent, alignItems, gap, padding`
- **flutter**：`Row/Column`、`Stack + Positioned`、`TextStyle`、`Color(0xFF...)`、`SvgPicture.string`
  （DSL 的 `framework` 枚举无 FLUTTER，需手动映射）

## 相关项目（调研记录，供后续迭代参考）

- **master-dsl-tansfer**（`@master/master-dsl-transfer`，私服 npm）：turtle 二进制 → 结构化 DSL 的
  转换引擎（npm SDK，alpha/stable 双轨发版）。本 skill 的输入 DSL 若来自 MCP 服务端，即由它产出；
  它**不负责** DSL → 代码。
- **frontend-mcp-server**（`mastergo-context-mcp`）：MCP SSE 服务端，Worker 线程池 + 多级缓存 +
  single-flight + fileId affinity 调度，暴露 getDesignSections / getDesignSvgs / getDesignTexts /
  getPageLayers / getDsl / extractSvg / getComponentLink / getMeta / applyDesign 工具；
  是场景 A 纯 token REST 端点的服务端实现。
- **mastergo-magic-mcp**（`@mastergo/magic-mcp`）：面向用户的 MCP 客户端（npx 一键启动），
  将上述服务端能力封装为 MCP 工具；`getDsl` 返回 `{ dsl, componentDocumentLinks, rules }`，
  `rules` 即本 skill 硬性规则的来源。

> 后续迭代方向（待办）：把 DSL → 代码的框架模板（html/vue/react/flutter 各一份）沉淀为
> `assets/` 模板目录；补充 DSL 样例与 golden 测试；把「一个画板一个文件」的输出约定做成脚本校验。
