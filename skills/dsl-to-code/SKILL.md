---
name: mastergo-dsl-to-code
description: MasterGo 设计 DSL → 代码转换 skill。覆盖两类场景：(A) DSL 获取——纯 token 免插件的页面级画板枚举(getPageLayers)、批量拉取 DSL 落盘、allTexts 文本白名单防幻觉；(B) DSL → 代码——把拿到的 DSL 转换为 html / vue / react / flutter 等目标代码，遵循 token 变量化、SVG 原样拷贝、防幻觉等生成规则。触发词：mastergo dsl、dsl to code、dsl 转代码、设计转代码、整页导出、页面画板枚举、批量拉取、跳转逻辑导出、reactions 导出、mg.codegen、getDSL、getCodeByDSL。
version: 0.1.0
---

# MasterGo DSL 获取与代码转换

本 skill 负责 MasterGo 设计数据的「获取」与「转换」两个环节：先把设计稿（页面/画板）批量拉成
结构化 DSL，再把 DSL 交给 LLM 生成 html / vue / react / flutter 等目标代码。

## 场景路由

- **场景 A：获取 DSL**（纯 token 免插件：页面级画板枚举 / 批量拉 DSL / 文本白名单防幻觉）
  → 见 `references/page-batch-export.md` + 一体化脚本 `scripts/mcp-batch-fetch.mjs`
- **场景 B：DSL → 代码**（拿到 DSL 后按目标框架生成 html / vue / react / flutter 代码）
  → 见下方「# DSL → 代码转换」

> 辅助资料：`references/page-batch-export.md`（通道能力对照 / 画板筛选判据 / REST 端点清单）、
> `scripts/mcp-batch-fetch.mjs`（整页枚举 + 批量拉取脚本）按需读取。

---

<!-- ==================== 场景 A：获取 DSL（原 plugin-develop 场景 C 迁移） ==================== -->

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
| `getDesignSections` / `/mcp/design-sections` | ✅ 纯 token | ❌ | 只认**图层级 layerId**；传 page_id 返回 `{sections:[],totalSections:0}` **且不报错**（最易踩的坑） |
| `getDsl` / `/mcp/dsl` | ✅ 纯 token | ❌ | 同上，只认图层级 layerId；整层 DSL 很大，慎用 |
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
| `GET /mcp/design-sections?fileId=&layerId=[&sectionIndex=N]` | getDesignSections | 不传 sectionIndex 返回分区目录（含 `rootMetadata.allTexts` 文本白名单、splitContainers 坐标），传了返回单区 DSL |
| `GET /mcp/dsl?fileId=&layerId=&format=json\|yaml\|tree` | getDsl | 整层 DSL（大，慎用） |
| `GET /mcp/dsl-by-layer-ids?fileId=&layerId=&targetLayerIds=` | getDslByLayerIds | 按 targetLayerIds 批量取子树完整 DSL（含样式/填充/描边/SVG 路径），有层预算限制 |
| `GET /mcp/layer-tree?fileId=&layerId=` | getLayerTree | 轻量结构总览（id/name/type/位置/尺寸/children 数，TEXT 节点含文本内容），**大文件第一步** |
| `GET /mcp/extract-svg?fileId=&layerId=[&page=&pageSize=]` | extractSvg | 提取 PATH 节点 SVG |
| `GET /mcp/meta?fileId=&layerId=` | getMeta | 站点级 meta/action（需设计师在文件里配置，否则空） |
| `GET /mcp/style?fileId=&layerId=` | （组件样式） | getComponentStyleJson 用 |
| `GET /mcp/d2c/events?contentId=&documentId=` | getD2c | D2C 出码（需企业版权限） |
| `POST /mcp/c2d` | C2d | 代码转设计 |
| `POST /mcp/apply-design` | applyDesign | 占位符替换后落盘 |

要点重申：除 page-layers 外，**其余端点的 layerId 必须是图层 ID，不是 page_id**；
传 page_id 会返回空结果**且 HTTP 200 不报错**。

## 画板筛选判据（page-layers 返回结构）

字段只有 `id / name / type / depth / parentId / childrenCount`（**没有 width/height/x/y**；
`depth` 实测恒为 0，不可用于筛选）。

**筛「顶层画板」的正确判据（实测）**：

1. `parentId` 为空 —— 页面直接子节点；
2. `id` 不含 `/` —— 形如 `1365:60274/808:152750` 的路径式 id 是组件实例内部子层，排除；
3. `type` 在白名单内 —— `SECTION` / `FRAME` / `COMPONENT` / `INSTANCE`，以及 `9`（GROUP，
   流程图里常见的成组画板）。`type` 可能是字符串枚举名，也可能是数字码
   （已见：`9`=GROUP、`10`=直线、`12`=椭圆、`13`=矩形、`25`=TEXT、`33`=PATH/Vector、`37`=连接线）；
4. `childrenCount >= 1` —— 过滤零散文本、连接线等非画板节点。

按此规则，示例页面 3153 层 → 88 个可出码画板。

## 一条命令拉全页（`scripts/mcp-batch-fetch.mjs`）

```bash
export MG_MCP_TOKEN=mg_xxx
# 最省事：直接粘 MasterGo 链接，自动解出 fileId + page_id
node scripts/mcp-batch-fetch.mjs --url 'https://mastergo.com/file/1158...?page_id=808%3A150160' --out ./mg-dump
# 整页 / 多页一次跑完（各自落到 <out>/page-<id>/，某页未缓存只跳过该页不中断）
node scripts/mcp-batch-fetch.mjs --file 115835509271418 --page 808:150160 --out ./mg-dump
node scripts/mcp-batch-fetch.mjs --file 1158... --page 808:150160,5496:96753 --out ./mg-dump
# 页面还没打开过：--wait 原地等，你在浏览器打开后脚本自动继续
node scripts/mcp-batch-fetch.mjs --file 1158... --page 5496:96753 --wait --out ./mg-dump
# 先看清单不落盘 / 指定画板 / 从清单 JSON
node scripts/mcp-batch-fetch.mjs --file 1158... --page 808:150160 --list-only
node scripts/mcp-batch-fetch.mjs --file 1158... --ids 5771:91198,5771:92001 --out ./mg-dump
node scripts/mcp-batch-fetch.mjs --file 1158... --frames frames.json --out ./mg-dump
```

可选参数：`--url <长链>`（不支持 `/goto/` 短链）、`--wait [秒]`（默认 300）、
`--min-children N`（默认 1）、`--types A,B`（覆盖类型白名单）、`--limit N`（调试取前 N 个）。

特性：

- 串行限速（默认 300ms 间隔，`MCP_FETCH_INTERVAL_MS` 可调），失败单个记录不中断整批；
- **429/5xx 指数退避重试**（`MCP_FETCH_MAX_RETRIES=5`、`MCP_FETCH_RETRY_BASE_MS=2000`，
  服务端给 `Retry-After` 时优先采用）。实测整页 88 个画板跑到第 80 个必撞 429，
  间隔建议 800ms 起；
- **幂等**：已存在的 section 文件跳过，重跑只补缺的；
- 页面未缓存时给出明确指引（打开哪个 URL、为什么、缓存持久），不静默产出空结果；
- 输出：
  - `<out>/frames.json` —— 画板清单
  - `<out>/<layerId>/sections-index.json` —— 分区目录（含 allTexts、splitContainers）
  - `<out>/<layerId>/section-N.json` —— 各分区 DSL
  - `<out>/index.json` —— 汇总（每画板 sections 数、allTexts、bbox、错误）

## 批量消费工作流（AI 生成代码场景）

1. `--list-only` 拿清单，人工过一眼画板名（`弹窗`/`smile` 这类重复名很多，靠 id 区分）；
2. 批量拉 DSL 落盘；
3. `allTexts` 是该画板全部真实可见文本的**白名单**，既作需求上下文，也用于生成后自校验防幻觉
   （任何不在 allTexts 里的可见文案 = 占位符或幻觉）；
4. AI 逐个画板出码，**一个画板 = 一个独立 standalone HTML 文件**，不要合并；
5. 同构画板（分区目录里 `structureHash` 相同）只拉首个、其余复用结构换文案。

跳转关系（原型交互 `reactions`）不在 page-layers / design-sections 的返回里。如需页面跳转
地图，只能靠编辑器内插件读节点 `reactions`（`mg.currentPage` 全树扫描），或让设计师导出交互说明。

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

用户拿到 DSL（无论来自 mcp-batch-fetch 落盘、MCP 工具 getDsl / getDesignSections 直取、
还是 DevMode 插件内 `mg.codegen.getDSL`）后，需要把它转换为目标框架代码
（html / vue / react / flutter 等）。本 skill 的目标就是**只用 skill（提示词 + 规则 + 脚本），
不依赖额外服务**地完成转换。

## 调研结论：现有 DSL→代码 通道盘点（2026-08）

| 通道 | 输入 | 输出 | 依赖 | 适用性 |
|------|------|------|------|--------|
| **LLM 直接基于 DSL 生成（本 skill 主路径）** | DSL JSON | html/vue/react/flutter | 仅 token + LLM | ✅ 最通用，纯 skill 可实现 |
| DevMode codegen API（`mg.codegen.getCodeByDSL(dsl, framework)`） | DSL | 代码 | **DevMode 插件 + 编辑器会话** | ⚠️ 需插件环境，非纯 skill |
| D2C（`getD2c` / `/mcp/d2c/events`） | contentId | 代码 | **企业版权限**，否则 `10013 禁止访问` | ⚠️ 受限 |
| `master-dsl-tansfer`（@master/master-dsl-transfer） | turtle 二进制 | DSL JSON | 私服 npm 包 + 内网 | 🔧 只是 DSL 生产端，不做 DSL→代码 |
| `frontend-mcp-server`（mastergo-context-mcp） | MCP SSE 工具 | DSL/SVG/文本 | 内网服务 | 🔧 只是 DSL 提供端 |

结论：**用户只拿得到 DSL 时，唯一不依赖额外服务/权限的转换路径，就是让 LLM 直接读 DSL 生成代码**。
这正是本 skill 场景 B 要固化的流程与规则。

## DSL 数据结构（转换的输入契约）

### 顶层结构（mg.codegen / magic-mcp 返回）

```typescript
interface MGDSLData {
  version: string;
  framework: 'REACT' | 'VUE2' | 'VUE3' | 'ANDROID' | 'IOS';  // 声明 DSL 面向的框架
  nodeMap: Record<string, MGNode>;   // 全部节点，按 id 索引
  localStyleMap: Record<string, any>; // 样式表（paint_*/font_*/effect_*）
  fileMap: Record<string, MGDSLFile>; // 生成的文件映射
  root: string;                       // 根节点 id
  entry: string;                      // 入口节点 id
  settings: DSLSettings;
}
```

注意：`framework` 枚举只到 IOS，**没有 FLUTTER**。flutter 输出需按下方
「flutter 转换要点」自行映射，或直接产出通用组件结构由用户套壳。

### 节点与样式关键字段（来自 master-dsl-tansfer 的 master-code.schema）

- **LayoutStyle**：`width / height / relativeX / relativeY / rotate / rotateX / flipV / min|maxWidth / min|maxHeight`。
  `relativeX/Y` 是相对父节点坐标；有 `FlexContainerInfo / FlexItemStyle` 时以 flex 布局为准，width/height 仅为参考值。
- **PaintStyle**：`{ token?, value: string[] }`，value 是 CSS 可用的颜色/渐变/图片描述。
  **若 `token` 字段存在，必须生成为变量（CSS 变量 / 主题 token），并在注释中标出**。
- **FontStyle**：`{ token?, value: { family, size, style, weight?, decoration, case, lineHeight, letterSpacing } }`。
  `weight` 是 CSS 数值字重（如 "500"）；`decoration`/`case` 可直接映射 CSS `text-decoration`/`text-transform`。
- **FillData / StrokeData**：`fill` 引用 paint_* id；**`_color` 已解析 CSS 色值可直接用**；
  `_token` 是设计令牌名（用于生成 `--text-text-4` 这类 CSS 变量）。
- **FlexContainerInfo**：`flexDirection('row'|'column') / justifyContent / alignItems / flexWrap / gap / padding / mainSizing('fixed'|'auto') / crossSizing('fixed'|'auto')`。
  flex 容器与 CSS flex 一一对应；`mainSizing/crossSizing` 决定主轴/交叉轴是固定尺寸还是内容撑开。
- **FlexItemStyle**：`flexGrow / flexShrink`（0 或 1），映射 CSS `flex: grow shrink 0%`。
- **EffectStyle**：`{ token?, value: string[] }`，value 为 CSS 阴影/模糊描述。

### 生成代码的硬性规则（magic-mcp getDsl 同源 rules，必须遵守）

1. **token 字段必须生成变量**：颜色、阴影、字体等带 `token` / `_token` 的字段，
   一律产出变量（CSS 变量 / 设计令牌），且变量声明处必须带注释说明；
2. **图标 SVG 必须原样拷贝**：用 DSL 中的 SVG path 数据 **VERBATIM**，禁止用手绘
   `<rect>/<circle>/<polygon>` 近似替代，即使看起来很像；
3. **复合/多子路径图标（logo）**：完整拷贝 DSL 里的 `<svg>...</svg>` 块。**禁止**拿节点
   坐标手算 `transform="translate(x,y) scale(...)"` —— 那是画布摆放坐标，不是 SVG 内部变换；
4. **禁止编造数据**：只渲染 DSL 中真实存在的行/列/条目，不要为了"视觉密度"补占位内容。

## 转换流程（场景 B 标准步骤）

1. **确认输入**：拿到一个画板的 DSL（nodeMap + localStyleMap + root/entry）与目标框架
   （html / vue3 / react / flutter，未指定默认 html 单文件）；
2. **读结构**：从 `root`/`entry` 出发沿 nodeMap 遍历，先建立节点树（容器/文本/图片/矢量）；
3. **布局映射**：有 FlexContainerInfo 的容器 → flex 布局；否则按 LayoutStyle 绝对定位
   （`relativeX/relativeY` 转 `position:absolute; left/top`，注意父容器坐标基准）；
4. **样式映射**：查 localStyleMap 解析 paint/font/effect，token 字段变量化（规则 1）；
5. **矢量/图标**：SVG path 原样嵌入（规则 2/3），路径缺失时标记 TODO 而非手绘；
6. **文本**：用 nodeMap 中 TEXT 节点的真实内容（对照 allTexts 白名单防幻觉，规则 4）；
7. **自校验**：生成完成后，把输出中的可见文案与 `allTexts` 白名单比对，不在白名单的一律修正；
8. **输出**：一个画板 = 一个独立文件（standalone HTML 或 .vue / .tsx / .dart），不跨画板合并。

## 各框架转换要点

### html（默认）
- 一个画板 → 一个 `index.html`（内联 CSS，无外部依赖）；
- flex 容器 → `display:flex; flex-direction:row|column; justify-content; align-items; gap; padding`；
- 绝对定位 → 容器 `position:relative` + 子节点 `position:absolute; left/top`；
- 图片 → `<img src="<url>" style="object-fit:cover">`；SVG → 内联 `<svg>`。

### vue3
- 单文件组件：`<template> + <script setup> + <style scoped>`；
- 变量 → `:style` 绑定或 CSS 变量（`:root { --token: value }`）；
- 交互/跳转（reactions）→ `@click` 路由跳转占位（reactions 通常拿不到，留 TODO）。

### react
- 单文件组件或按节点拆分 JSX；样式用内联 `style={{}}` 或 CSS 变量；
- flex → `display:'flex', flexDirection, justifyContent, alignItems, gap, padding`；
- 图标 → JSX 内联 `<svg>`（path 原样）。

### flutter
- DSL `framework` 枚举无 FLUTTER，需手动映射：
  - flex 容器 → `Row`（`mainAxisAlignment` / `crossAxisAlignment` / `mainAxisSize`）或 `Column`；
  - 绝对定位 → `Stack` + `Positioned(left, top, width, height)`；
  - 文本 → `Text(style: TextStyle(fontFamily, fontSize, fontWeight, color, height, letterSpacing))`；
  - 颜色/渐变 → `Color(0xFF...)` / `LinearGradient`；阴影 → `BoxShadow`；
  - 图片 → `Image.network(url, fit: BoxFit.cover)`；SVG → `flutter_svg` 的 `SvgPicture.string`；
  - token → 常量类（`class AppColors { static const x = Color(...); }`）。
- 输出为单个 `.dart` widget 文件，标注需人工接入路由/资源。

## 相关项目（调研记录，供后续迭代参考）

- **master-dsl-tansfer**（`@master/master-dsl-transfer`，私服 npm）：turtle 二进制 → 结构化 DSL 的
  转换引擎（npm SDK，alpha/stable 双轨发版）。本 skill 的输入 DSL 若来自 MCP 服务端，即由它产出；
  它**不负责** DSL → 代码。
- **frontend-mcp-server**（`mastergo-context-mcp`）：MCP SSE 服务端，Worker 线程池 + 多级缓存 +
  single-flight + fileId affinity 调度，暴露 getDesignSections / getDesignSvgs / getDesignTexts /
  getPageLayers / getDsl / extractSvg / getComponentLink / getMeta / applyDesign 工具；
  是场景 A 纯 token REST 端点的服务端实现。
- **mastergo-magic-mcp**（`@mastergo/magic-mcp`）：面向用户的 MCP 客户端（npx 一键启动），
  将上述服务端能力封装为 MCP 工具；getDsl 返回 `{ dsl, rules }`，rules 即上文「硬性规则」的来源。

> 后续迭代方向（待办）：把 DSL → 代码的框架模板（html/vue/react/flutter 各一份）沉淀为
> `assets/` 模板目录；补充 DSL 样例与 golden 测试；把「一个画板一个文件」的输出约定做成脚本校验。
