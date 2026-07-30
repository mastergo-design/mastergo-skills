# MasterGo 节点类型快速参考

## 节点类型概述

MasterGo 文件由节点树构成，每个节点对应特定的图层类型。共有 18 种节点类型：

### 基础节点类型

| 节点类型 | 说明 | 常用属性 |
|---------|------|---------|
| `DocumentNode` | 文档根节点 | `children`, `currentPage` |
| `PageNode` | 页面节点 | `children`, `selection`, `name` |
| `SceneNode` | 场景节点基类型 | `id`, `name`, `parent`, `removed`, `visible` |

### 图层节点类型

| 节点类型 | type 值 | 说明 | 创建方法 |
|---------|---------|------|---------|
| `FrameNode` | `FRAME` | 容器图层 | `mg.createFrame()` |
| `GroupNode` | `GROUP` | 组图层 | `mg.group()` |
| `ComponentNode` | `COMPONENT` | 组件节点 | `mg.createComponent()` |
| `ComponentSetNode` | `COMPONENT_SET` | 组件集 | `mg.combineAsVariants()` |
| `InstanceNode` | `INSTANCE` | 组件实例 | `component.createInstance()` |
| `RectangleNode` | `RECTANGLE` | 矩形图层 | `mg.createRectangle()` |
| `EllipseNode` | `ELLIPSE` | 椭圆图层 | `mg.createEllipse()` |
| `LineNode` | `LINE` | 线段图层 | `mg.createLine()` |
| `PolygonNode` | `POLYGON` | 多边形图层 | `mg.createPolygon()` |
| `StarNode` | `STAR` | 星形图层 | `mg.createStar()` |
| `PenNode` | `PEN` | 钢笔图层 | `mg.createPen()` |
| `TextNode` | `TEXT` | 文本图层 | `mg.createText()` |
| `BooleanOperationNode` | `BOOLEAN_OPERATION` | 布尔运算 | `mg.union()`, `mg.subtract()` 等 |
| `SliceNode` | `SLICE` | 切图图层 | `mg.createSlice()` |
| `ConnectorNode` | `CONNECTOR` | 连接线图层 | `mg.createConnector()` |
| `SectionNode` | `SECTION` | 区域图层 | `mg.createSection()` |

## 节点类型定义

```typescript
type BaseNode = DocumentNode | PageNode | SceneNode

type SceneNode =
  | GroupNode
  | FrameNode
  | PenNode
  | StarNode
  | LineNode
  | EllipseNode
  | PolygonNode
  | RectangleNode
  | TextNode
  | ComponentNode
  | ComponentSetNode
  | InstanceNode
  | BooleanOperationNode
  | SliceNode
  | ConnectorNode
```

## 通用节点属性

所有节点都包含以下属性：

- `id: string` - 节点唯一标识
- `name: string` - 节点名称
- `type: string` - 节点类型
- `parent: BaseNode | null` - 父节点
- `removed: boolean` - 是否已删除
- `visible: boolean` - 是否可见

## SceneNode 通用属性

- `x: number` - X 坐标
- `y: number` - Y 坐标
- `width: number` - 宽度
- `height: number` - 高度
- `rotation: number` - 旋转角度（-180 到 180）
- `children: ReadonlyArray<SceneNode>` - 子节点数组
- `fills: ReadonlyArray<Paint>` - 填充样式
- `strokes: ReadonlyArray<Paint>` - 描边样式
- `effects: ReadonlyArray<Effect>` - 特效
- `opacity: number` - 不透明度
- `blendMode: BlendMode` - 混合模式
- `layoutAlign: string` - 布局对齐方式
- `constraints: Constraints` - 约束条件

## 节点查找方法

所有包含子节点的节点都支持以下查找方法：

```typescript
// 查找直接子节点
findChildren(callback?: (node: SceneNode) => boolean): SceneNode[]
findChild(callback: (node: SceneNode) => boolean): SceneNode | null

// 查找所有子代节点
findAll(callback?: (node: SceneNode) => boolean): SceneNode[]
findOne(callback: (node: SceneNode) => boolean): SceneNode | null
```

## 使用示例

### 获取当前选中的节点
```typescript
const selectedNodes = mg.document.currentPage.selection;
```

### 查找特定类型的节点
```typescript
// 查找所有矩形节点
const rects = currentPage.findAll((node) => node.type === 'RECTANGLE');

// 查找所有文本节点
const texts = currentPage.findAll((node) => node.type === 'TEXT');
```

### 遍历节点树
```typescript
function traverse(node, callback) {
  if ("children" in node) {
    callback(node);
    for (const child of node.children) {
      traverse(child, callback);
    }
  }
}
```

### 检查节点类型
```typescript
if (node.type === 'RECTANGLE') {
  // 这是一个矩形节点
  const rect = node as RectangleNode;
  console.log(rect.cornerRadius);
}
```

## 注意事项

1. **类型安全**：在访问特定类型节点的属性前，先检查 `node.type`
2. **属性修改**：复杂对象属性（如 `fills`）需要完全替换，不能直接修改内部属性
3. **文本节点**：修改文本内容前需要先加载字体
4. **组件实例**：只能修改组件实例的覆盖属性，不能修改组件本身的属性
