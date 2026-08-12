# 整页枚举与批量导出（Page Batch Export）

> 适用场景：设计文件的一整个页面包含几十~上百个画板（流程图、弹窗集合、带跳转标注的
> 原型），需要把「全部画板 + 文字说明 + 跳转逻辑」一次性交给 AI（或脚本）批量消费。

## 0. 能力边界（2026-08 实测，先说结论）

**「纯 token 认证、零浏览器/客户端操作」的整页画板枚举，MasterGo 官方目前没有任何通道支持。**
逐项验证过的结论：

| 通道 | 认证 | 能否枚举页面画板 | 说明 |
|------|------|------------------|------|
| Magic MCP（magic-mcp REST） | ✅ 纯 token | ❌ | `/mcp/design-sections`、`/mcp/dsl` 等只认**图层级 layerId**；传 `page_id` 返回空结果**且不报错**（最易踩的坑） |
| Vibe MCP（vibe-mcp） | 桌面客户端会话 | ✅（读选区等） | 必须 MasterGo **桌面客户端运行 + 文件打开 + MCP 已连接**，见官方《MasterGo MCP 配置指南》(help/MG/MCP/CONFIG) |
| 官方 REST API（内测） | ✅ 纯 token | ❌ | developers.mastergo.com/rest-api 只有团队/项目/文件**管理**接口，无设计节点树 |
| D2C（getD2c） | ✅ 纯 token | ❌ | 按 contentId 出码；且文件需**企业版权限**，否则报 `10013 禁止访问` |
| 网页端 SPA API | session | — | 不对外开放，PAT 不适用 |
| 插件（editor 内） | 编辑器会话 | ✅ | `mg.currentPage.children` 全量枚举，但需在编辑器里跑一次 |

因此 skill 采用「**一次拿清单 → 之后纯 key 全自动**」的两段式设计：

- **第一段（一次性）**：拿到页面的画板 layerId 清单（三选一，见第 2 节）；
- **第二段（纯 key，可无人值守）**：用 `scripts/mcp-batch-fetch.mjs` 批量拉取全部画板 DSL
  落盘（见第 3 节），AI 再逐个消费。

## 1. MCP REST 底层接口（逆向自 @mastergo/magic-mcp v0.2.7）

> ⚠️ 非官方公开 API，是 magic-mcp 的服务端实现细节，**可能随版本变动**。
> 优先走 MCP 工具；REST 直调用于脚本化批处理。

- Base URL：`https://mastergo.com`（可用 `MG_API_BASE` 环境变量覆盖）
- 认证：请求头 `x-mg-useraccesstoken: mg_xxx`（也接受 query 参数 `?token=mg_xxx`）

| 端点 | 对应 MCP 工具 | 说明 |
|------|--------------|------|
| `GET /mcp/design-sections?fileId=&layerId=[&sectionIndex=N]` | getDesignSections | 不传 sectionIndex 返回分区目录（含 allTexts 文本白名单、splitContainers 坐标），传了返回单区 DSL |
| `GET /mcp/dsl?fileId=&layerId=&format=json\|yaml\|tree` | getDsl | 整层 DSL（大，慎用） |
| `GET /mcp/extract-svg?fileId=&layerId=` | extractSvg | 提取 PATH 节点 SVG |
| `GET /mcp/meta?fileId=&layerId=` | getMeta | 站点级 meta/action（需设计师在文件里配置，否则空） |
| `GET /mcp/style?fileId=&layerId=` | （组件样式） | getComponentStyleJson 用 |
| `POST /mcp/apply-design` | applyDesign | 占位符替换后落盘 |

要点重申：**layerId 必须是页面内的图层 ID，不是 page_id**；页面节点查询返回空结果且不报错。
design-sections 的分区目录里 `rootMetadata.allTexts` 是该画板全部可见文本的白名单，
可单独用作「文字说明/批注」的提取来源。

## 2. 第一段：拿画板清单（三选一，一次性）

### 方案 A：page-exporter 插件（推荐，`assets/page-exporter/`）

免构建最小插件，DevMode 导入后一键导出当前页面为 JSON：

- **画板清单**：`frames[].id` 即 layerId，附名称/位置/尺寸，按画布位置排序；
- **全部文字**：递归收集每个画板内 TEXT 节点（需求说明、批注、UI 文案），带节点路径；
- **跳转交互**：递归收集所有节点的 `reactions`（原型交互），含 trigger / action /
  destinationId / navigation / transition。跳转逻辑可挂在任意内层节点（如按钮）上，
  所以必须全树扫描。

安装使用：MasterGo 打开文件 → 开发模式 → 插件 → 开发 → 导入 `manifest.json` →
运行 page-exporter →「导出当前页面」→ 下载 JSON。

### 方案 B：Vibe MCP + 桌面客户端

客户端保持运行并连接 MCP 后，AI 可通过 vibe-mcp 的 `get_selection_node` 等工具读当前
选中图层。适合「边看边取」的交互式场景，不适合批量。

### 方案 C：手动复制 layer_id

只要 1~3 个画板时：选中画板 → 复制链接 → URL 的 `layer_id=xxx:xxx`。

## 3. 第二段：纯 key 批量拉取（`scripts/mcp-batch-fetch.mjs`）

```bash
export MG_MCP_TOKEN=mg_xxx
# 从 page-exporter 导出的清单批量拉：
node scripts/mcp-batch-fetch.mjs --file 115835509271418 --frames page-export-808-150160.json --out ./mg-dump
# 或直接给 id 列表：
node scripts/mcp-batch-fetch.mjs --file 115835509271418 --ids 5771:91198,5771:92001 --out ./mg-dump
```

特性：

- 串行限速（默认 300ms 间隔，`MCP_FETCH_INTERVAL_MS` 可调），失败单个记录不中断整批；
- **幂等**：已存在的 section 文件跳过，重跑只补缺的；
- 输出 `<out>/<layerId>/section-N.json` + 汇总 `index.json`（含每画板 allTexts 文本白名单）。

## 4. 批量消费工作流（AI 生成代码场景）

1. page-exporter 导出 JSON → 得到全页画板索引 + 跳转关系 + 文字；
2. 先用 `interactiveNodes[].reactions` 建**页面跳转地图**（destinationId → 目标画板 id），
   把散落的画板还原成流程图；
3. `texts[]` / `allTexts` 作为需求上下文喂给模型（文字白名单也可用于生成后自校验防幻觉）；
4. `mcp-batch-fetch.mjs` 批量拉 DSL 落盘，AI 逐个画板生成代码；
   同构画板（分区目录里 structureHash 相同）只拉首个、其余复用结构换文案。

## 5. 给上游的能力缺口建议（feature request）

magic-mcp 服务端增加页面枚举端点即可闭环纯 key 全流程：

```
GET /mcp/page-children?fileId=<fileId>&layerId=<pageId>
→ { children: [{ id, name, type, x, y, width, height }] }
```

服务端已具备整文件解析能力（design-sections 就是按图层切的），只缺暴露这个清单。
在此端点落地前，第一段用第 2 节的三种方案之一完成即可。
