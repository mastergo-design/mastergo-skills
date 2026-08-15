# MCP DSL 结构契约（`Dsl`）

本文件记录 magic-mcp / frontend-mcp-server 返回的**真实** `Dsl` 结构。来源是
`master-dsl-tansfer` 的 `code-schema.d.ts` 与 `/mcp/dsl` 路由实现。

## 顶层

```typescript
type Dsl = {
  styles: StyleMap;
  nodes: SceneNode[];
  components: ComponentNode[];
};
```

- `styles`：样式表，键是 `paint_*` / `font_*` / `effect_*` 引用 id。
- `nodes`：顶层节点数组，节点内用 `children` 递归。
- `components`：组件定义数组。`INSTANCE` 节点通过 `componentId` 引用它们。

MCP 工具 `mcp__getDsl` 的响应会再包一层：

```typescript
{
  dsl: Dsl;
  componentDocumentLinks: string[];
  rules: string[];
}
```

HTTP `GET /mcp/dsl` 直接返回 `Dsl` 本身，不包 `dsl`/`rules`。

## 节点联合

```typescript
type SceneNode =
  | LayerNode | GroupNode | FrameNode | PathNode | TextNode
  | ComponentNode | InstanceNode | ComponentSetNode | EllipseNode;
```

类型字符串：`LAYER`、`GROUP`、`FRAME`、`PATH`、`TEXT`、`COMPONENT`、`INSTANCE`、
`COMPONENT_SET`、`SVG_ELLIPSE`。

## 公共字段（BaseNode）

```typescript
type BaseNode = FlexItemStyle & {
  id: string;
  name: string;
  layoutStyle: LayoutStyle;
  opacity?: number;
  mask?: 'alpha' | 'luminance' | 'outline';
  needParse?: boolean;
  interactive?: Array<{ type: 'navigation'; targetLayerId: string }>;
};
```

- `layoutStyle` 是每个节点都有的布局参考。
- `opacity` 只作用于节点自身背景/内容，不应翻译成父级 CSS `opacity`（会让子元素整体变透明）。
- `interactive` 是跳转动作，通常不完整，代码中留 TODO 即可。

## 布局

```typescript
type LayoutStyle = {
  width: number;   // 参考值；有 flex 时以 flex 为准
  height: number;  // 参考值；有 flex 时以 flex 为准
  relativeX: number;
  relativeY: number;
  rotate?: number;
  rotateX?: number;
  flipV?: boolean;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
};
```

- `relativeX/relativeY` 是相对父节点坐标，转 CSS 时父容器需要 `position: relative`，
  子节点 `position: absolute; left: relativeXpx; top: relativeYpx`。
- `flipV` 表示垂直翻转，PATH/SVG 图标可能需要 `transform: scaleY(-1)`。
- 有 `flexContainerInfo` 的节点，其直接子节点应按 flex 布局；`width/height` 只作参考。

## Flex

```typescript
type FlexContainerData = {
  flexContainerInfo?: {
    flexDirection: 'row' | 'column';
    justifyContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between';
    alignItems?: 'flex-start' | 'flex-end' | 'center' | 'baseline';
    flexWrap?: 'wrap' | 'nowrap';
    gap?: string;
    padding?: string;
    mainSizing: 'fixed' | 'auto';
    crossSizing: 'fixed' | 'auto';
  };
};

type FlexItemStyle = {
  flexGrow?: 0 | 1;
  flexShrink?: 0 | 1;
};
```

映射：`flexContainerInfo` → `display:flex; flex-direction; justify-content; align-items; gap; padding`。
`flexGrow/flexShrink` → `flex: <grow> <shrink> 0%`。

## 样式解析

```typescript
type FillData = {
  fill?: PaintStyleId;
  _color?: string;  // 已解析 CSS 色值，直接用于 color/background
  _token?: string;  // 设计令牌名，用于 CSS 变量注释
};
```

- **优先 `_color`**。它已经是可直接写入 CSS 的颜色值，不需要查 `styles`。
- **`_token` 必须变量化**，例如 `var(--text-text-4, #4E5969)`，并在声明处注释 token 名。
- 没有 `_color` 时，按 `fill` / `strokeColor` / `font` / `effect` 引用去 `styles` 表查。

## PATH 节点

```typescript
type PathNode = BaseNode & EffectData & {
  type: 'PATH';
  path: {
    data: string;        // 完整 SVG path d 数据，原样使用
    fill: PaintStyleId;
    transform?: string;
    fillType?: number;
  }[];
};
```

**这是主路径选择 `getDsl` 的核心原因**：`path[].data` 是真实路径，代码生成时直接内联
`<svg><path d="..."/></svg>`，不需要 `svgShortKey` + `applyDesign`。

- `transform` 是 SVG 内部变换（如果有），不是画布坐标变换；照抄到 `<path transform="...">`。
- 不要用手绘 `<rect>/<circle>/<polygon>` 近似代替 path。
- 复合 logo 的多个 path 必须完整保留。

## TEXT 节点

```typescript
type TextNode = BaseNode & StrokeData & EffectData & TextData & {
  type: 'TEXT';
};

type TextData = {
  text: { text: string; font: FontStyleId }[];
  textColor: { start: number; end: number; color: PaintStyleId }[];
  textAlign: 'left' | 'center' | 'right';
  textMode: 'single-line' | 'auto-height' | 'fixed' | 'ellipsis';
};
```

- 一个 TEXT 节点可能有多个 run（富文本分段），所有 `text[].text` 都是真实文本。
- `textMode: ellipsis` → CSS `text-overflow: ellipsis; white-space: nowrap; overflow: hidden`。
- 颜色优先看 `_color`；否则查 `textColor` 引用的 paint。

## INSTANCE / COMPONENT

```typescript
type InstanceNode = FrameData & componentData & {
  type: 'INSTANCE';
  componentId: string;
};

type ComponentNode = FrameData & componentData & {
  type: 'COMPONENT';
  propertiesDefinition?: (VisablePropertyType | ContentPropertyType | InstancePropertyType)[];
};
```

- `INSTANCE.componentId` 对应 `dsl.components` 里的组件。
- `componentInfo.documentLink` / `componentSetDocumentLink` 如果存在，说明该组件有前端文档，
  应按 `getDsl` 返回的 `componentDocumentLinks` 调用 `mcp__getComponentLink` 了解用法。
- `componentInfo.properties` 是组件属性覆盖值（如选中态、文案等），比节点名更可靠。

## 主路径与兜底路径差异

| 字段 | `getDsl` / `/mcp/dsl` | `getDesignSections` section DSL |
|------|----------------------|--------------------------------|
| 顶层 | `Dsl { styles, nodes, components }` | `{ sectionIndex, dsl, rowTexts, svgShortKey? ... }` |
| PATH | `path[].data` 真实数据 | 只有 `svgShortKey`，无 path |
| 长文本 | TEXT 节点内完整 | 可能替换成 `T{si}|{nodeId}` 占位符 |
| 白名单 | 需自己递归收集文本 | `rootMetadata.allTexts` |
| 落地 | 直接内联 SVG | `@@SVG:{svgShortKey}@@` + `mcp__applyDesign` |
