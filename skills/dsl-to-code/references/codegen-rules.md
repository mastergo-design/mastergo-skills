# DSL → 代码 生成规则与框架映射

本文件把 DSL → html/vue/react/flutter 的硬性规则与框架映射集中在一起。核心原则只有一条：
**忠实还原 DSL，不臆造、不简化、不补数据。**

## 硬性规则

### 1. token 必须变量化

- 节点带 `_token` / `token` 的字段（颜色、阴影、字体等），必须产出变量。
- CSS 变量命名建议：`--<token小写，/ 换成 ->`，例如 `Text/Text-4` → `--text-text-4`。
- 声明处必须带注释说明 token 名，例如：

```css
:root {
  /* Text/Text-4 */
  --text-text-4: #4e5969;
}
```

### 2. SVG path 必须原样使用

- `getDsl` 的 PATH 节点：把 `path[].data` 原样放进 `<path d="...">`。
- 禁止用手绘 `<rect>/<circle>/<polygon>` 近似替代，即使看起来像。
- 复合/多子路径 logo：完整保留所有 path。禁止拿节点画布坐标手算
  `transform="translate(x,y) scale(...)"`；画布坐标只决定外层定位，不进入 SVG 内部。
- 若节点带有 `path[].transform`，它是 SVG 内部变换，照抄到 `<path transform="...">`。

### 3. 布局：flex 优先，其次绝对定位

- 有 `flexContainerInfo` → 用 flex：
  - `display: flex`
  - `flex-direction` / `justify-content` / `align-items` / `flex-wrap` / `gap` / `padding`
  - 子节点 `flex: <flexGrow> <flexShrink> 0%`
- 没有 `flexContainerInfo` → 用绝对定位：
  - 父容器 `position: relative`
  - 子节点 `position: absolute; left: relativeXpx; top: relativeYpx`
  - 子节点宽高优先用自身 `layoutStyle.width/height`
- 固定高度 flex column + `overflow: hidden` 时，固定高度子项（tabs/header/pagination）必须
  `flex-shrink: 0`，只有内容区可 `flex: 1`，否则会被压缩裁掉。

### 4. 文本必须可追溯

- 只渲染 DSL 中真实存在的 TEXT 文本。
- `getDsl` 没有 `allTexts` 时，生成前先从 DSL 递归收集文本作为白名单（脚本会写入 `texts.json`）。
- 任何不在白名单里的可见文案，一律视为幻觉，删除或替换为空占位符。
- 表格行数、列表条数严格等于 DSL 实际节点数，不因“视觉密度”补行。
- 分页文案（如「共 10 项」）是控件状态，不是数据条数，不得据此扩行。

### 5. 颜色优先 `_color`

- 有 `_color` 直接用。
- 没有 `_color` 才查 `styles` 表。
- 不硬编码 LLM 默认色（如 `#1D2129`、`#000`、`#333`）。
- `opacity` 只作用于该节点自身，必要时转 `rgba(R,G,B,opacity)`，不要给父容器加 `opacity`
  （会导致子元素整体半透明）。

## 主路径生成流程

1. 读 `dsl.nodes`，递归建树。
2. 对每个节点解析样式：
   - `_color` / `_token` 优先；
   - 缺省查 `dsl.styles[paint_*|font_*|effect_*]`。
3. 对每个 PATH 节点内联 `<svg>`。
4. 对每个 TEXT 节点输出真实文本。
5. 生成后把可见文案与文本白名单比对。
6. 一个画板一个独立文件，不合并。

## 框架映射

### html（默认）

- 单文件 `index.html`，内联 CSS，无外部依赖。
- flex 容器 → `display:flex; flex-direction:row|column; justify-content; align-items; gap; padding`。
- 绝对定位 → 父 `position:relative` + 子 `position:absolute; left/top`。
- PATH → 内联 `<svg viewBox="0 0 {w} {h}" width="{w}" height="{h}"><path d="..."/></svg>`。
- 图片 → `<img src="<url>" style="object-fit:cover">`。
- token → `:root` 中的 CSS 变量。

### vue3

- 单文件组件：`<template> + <script setup> + <style scoped>`。
- token → `:style` 绑定或 `:root` CSS 变量。
- 组件文档链接存在时，先 `mcp__getComponentLink` 了解组件用法，优先映射到前端组件。
- 跳转/交互拿不到 reactions 时，在事件处留 `// TODO: 接路由` 注释，不臆造业务逻辑。

### react

- JSX + 内联 `style={{}}` 或 CSS 变量。
- flex → `display:'flex', flexDirection, justifyContent, alignItems, gap, padding`。
- PATH → JSX 内联 `<svg><path d="..."/></svg>`。
- token → `const tokens = { text4: '#4e5969' }` 或 CSS 变量。

### flutter

- DSL 的 `framework` 枚举无 FLUTTER，需手动映射：
  - flex row → `Row(mainAxisAlignment, crossAxisAlignment, mainAxisSize)`
  - flex column → `Column(...)`
  - 绝对定位 → `Stack` + `Positioned(left, top, width, height)`
  - 文本 → `Text(style: TextStyle(fontFamily, fontSize, fontWeight, color, height, letterSpacing))`
  - 颜色 → `Color(0xFF...)`；渐变 → `LinearGradient`
  - 阴影 → `BoxShadow`
  - 图片 → `Image.network(url, fit: BoxFit.cover)`
  - SVG → `flutter_svg` 的 `SvgPicture.string`
  - token → 常量类 `class AppColors { static const text4 = Color(0xFF4E5969); }`
- 输出单个 `.dart` widget 文件，标注需人工接入路由/资源。

## 自校验清单

- [ ] 可见文案全部来自 DSL 文本白名单。
- [ ] PATH 数量与 DSL 中 PATH 节点数量一致，且没有手绘替代。
- [ ] token 字段全部变量化并注释 token 名。
- [ ] 表格行数/列表条数等于 DSL 实际节点数。
- [ ] 每个画板输出一个独立文件。
- [ ] 如果走 section 兜底，所有 `@@SVG:...@@` / `T{si}|{nodeId}` 都已交给 `applyDesign` 替换。
