# MasterGo API 快速参考

## 核心全局对象 `mg`

`mg` 是 MasterGo 插件的全局入口对象，提供所有插件 API 的访问。

## 属性

### 文档相关

| 属性 | 类型 | 说明 |
|-----|------|------|
| `mg.document` | `DocumentNode` | 文档根节点 |
| `mg.documentId` | `number` | 当前文档 ID |
| `mg.currentPage` | `PageNode` | 当前活动页面 |

### UI 相关

| 属性 | 类型 | 说明 |
|-----|------|------|
| `mg.ui` | `UIAPI` | UI 操作接口 |
| `mg.viewport` | `ViewportAPI` | 视口操作接口 |
| `mg.themeColor` | `'dark' \| 'light'` | 主题颜色 |

### 存储相关

| 属性 | 类型 | 说明 |
|-----|------|------|
| `mg.clientStorage` | `ClientStorageAPI` | 本地存储 API |

### 其他

| 属性 | 类型 | 说明 |
|-----|------|------|
| `mg.apiVersion` | `string` | API 版本号 |
| `mg.command` | `string` | 当前运行的 command 值 |
| `mg.mixed` | `string \| symbol` | 混合标记 |
| `mg.currentUser` | `User \| null` | 当前用户信息（需要权限） |
| `mg.codegen` | `CodegenAPI \| null` | 代码生成 API（仅研发模式） |

## 核心方法

### UI 控制

```typescript
// 显示 UI 界面
mg.showUI(htmlString: string, options?: ShowUIOptions): void

// 关闭插件
mg.closePlugin(): void

// 显示通知
mg.notify(message: string, options?: NotifyOptions): NotificationHandler
```

### 节点操作

```typescript
// 根据查找节点
mg.getNodeById(id: string): SceneNode | null
mg.getNodeByPosition(position: {x: number, y: number}): SceneNode | null

// 创建节点
mg.createRectangle(): RectangleNode
mg.createEllipse(): EllipseNode
mg.createLine(): LineNode
mg.createPolygon(): PolygonNode
mg.createStar(): StarNode
mg.createPen(): PenNode
mg.createText(): TextNode
mg.createFrame(children?: SceneNode[]): FrameNode
mg.createSection(): SectionNode
mg.createComponent(children?: SceneNode[]): ComponentNode
mg.createPage(): PageNode
mg.createSlice(): SliceNode
mg.createConnector(): ConnectorNode

// 从 SVG 创建节点
mg.createNodeFromSvgAsync(svg: string): Promise<FrameNode>

// 组合操作
mg.group(children: SceneNode[]): GroupNode
mg.union(children: SceneNode[]): BooleanOperationNode
mg.subtract(children: SceneNode[]): BooleanOperationNode
mg.intersect(children: SceneNode[]): BooleanOperationNode
mg.exclude(children: SceneNode[]): BooleanOperationNode
mg.flatten(nodes: SceneNode[]): PenNode

// 组件相关
mg.combineAsVariants(nodes: ComponentNode[]): ComponentSetNode
```

### 样式操作

```typescript
// 获取样式
mg.getStyleById(id: string): Style | null

// 创建样式
mg.createFillStyle(config: {id, name, description?}): PaintStyle
mg.createStrokeStyle(config: {id, name, description?}): PaintStyle
mg.createEffectStyle(config: {id, name, description?}): EffectStyle
mg.createTextStyle(config: {id, name, description?}): TextStyle
mg.createGridStyle(config: {id, name, description?}): GridStyle

// 获取本地样式列表
mg.getLocalPaintStyles(): PaintStyle[]
mg.getLocalEffectStyles(): EffectStyle[]
mg.getLocalTextStyles(): TextStyle[]
mg.getLocalGridStyles(): GridStyle[]
```

### 团队库

```typescript
// 获取团队库信息
mg.getTeamLibraryAsync(): Promise<TeamLibrary>

// 从团队库导入
mg.importComponentByKeyAsync(ukey: string): Promise<ComponentNode>
mg.importComponentSetByKeyAsync(ukey: string): Promise<ComponentSetNode>
mg.importStyleByKeyAsync(ukey: string): Promise<BaseStyle>
```

### 字体和图片

```typescript
// 字体操作
mg.listAvailableFontsAsync(): Promise<Font[]>
mg.loadFontAsync(fontName: FontName): Promise<void>

// 图片操作
mg.createImage(imageData: Uint8Array): Promise<Image>
mg.getImageByHref(href: string): Image
```

### 事件系统

```typescript
// 注册事件监听
mg.on(type: PluginEventType, callback: CallableFunction): void
mg.once(type: PluginEventType, callback: CallableFunction): void
mg.off(type?: PluginEventType, callback?: CallableFunction): void

// 事件类型
type PluginEventType =
  | 'selectionchange'  // 选择变化
  | 'currentpagechange'  // 页面切换
  | 'layoutchange'  // 布局变化
  | 'close'  // 插件关闭
  | 'themechange'  // 主题切换
  | 'drop'  // 拖放事件
  | 'run'  // 插件运行
```

### 其他

```typescript
// 撤销历史
mg.commitUndo(): void
mg.triggerUndo(): void

// 版本历史
mg.saveVersionHistoryAsync(desc: string, title?: string): Promise<void>

// 颜色转换
mg.hexToRGBA(hex: string): RGBA
mg.RGBAToHex(rgba: RGBA): string

// 布局网格
mg.showGrid(show: boolean): void

// 获取 hover 图层
mg.getHoverLayer(): SceneNode | PageNode
```

## mg.ui API

### 方法

```typescript
// 控制 UI 显示
mg.ui.show(): void
mg.ui.hide(): void
mg.ui.close(): void

// 调整 UI 大小
mg.ui.resize(width: number, height: number, withoutHeader?: boolean): void

// 移动 UI
mg.ui.moveTo(x: number, y: number): void

// 消息传递
mg.ui.postMessage(message: any, origin?: string): void
mg.ui.onmessage = (message: any, origin: string) => void
```

### 属性

```typescript
mg.ui.viewport: UIViewport  // UI 视口信息
```

## mg.viewport API

### 属性

```typescript
mg.viewport.center: Vector  // 可视区中心点
mg.viewport.zoom: number  // 缩放比例（1 = 100%）
mg.viewport.bound: Rect  // 可视区边界（只读）
mg.viewport.rulerVisible: boolean  // 标尺可见性
mg.viewport.layoutGridVisible: boolean  // 布局网格可见性
mg.viewport.positionOnDom: Rect  // 画布在窗口的位置（只读）
```

### 方法

```typescript
// 滚动并缩放使节点可见
mg.viewport.scrollAndZoomIntoView(nodes: ReadonlyArray<BaseNode>): void
```

## mg.clientStorage API

### 方法

```typescript
// 异步存储 API
mg.clientStorage.getAsync(key: string): Promise<any | undefined>
mg.clientStorage.setAsync(key: string, value: any): Promise<void>
mg.clientStorage.keysAsync(): Promise<string[]>
mg.clientStorage.deleteAsync(key: string): Promise<void>
```

**注意**：
- 类似 localStorage，但是异步的
- 数据不跨用户共享
- 清除浏览器缓存时数据可能被清除

## mg.notify API

```typescript
// 显示通知
mg.notify(message: string, options?: NotifyOptions): NotificationHandler

// 选项
interface NotifyOptions {
  position?: 'top' | 'bottom'  // 通知位置
  type?: 'normal' | 'highlight' | 'error' | 'warning' | 'success'
  timeout?: number  // 显示时间（ms）
  isLoading?: boolean  // 是否显示 loading
}

// 返回值
interface NotificationHandler {
  cancel: () => void  // 立即关闭通知
}
```

## 使用示例

### 显示 UI 并处理消息

```typescript
// main.ts
mg.showUI(__html__, { width: 400, height: 600 });

mg.ui.onmessage = (msg) => {
  console.log('收到 UI 消息:', msg);
  mg.ui.postMessage({ type: 'result', data: '处理完成' });
};
```

```html
<!-- ui.html -->
<script>
parent.postMessage({ type: 'action', data: '用户点击' }, '*');

window.onmessage = (event) => {
  console.log('收到主线程消息:', event.data);
};
</script>
```

### 监听选择变化

```typescript
mg.on('selectionchange', (selection) => {
  console.log('当前选择:', selection);
});
```

### 本地存储

```typescript
// 保存数据
await mg.clientStorage.setAsync('userPreferences', {
  theme: 'dark',
  fontSize: 14
});

// 读取数据
const prefs = await mg.clientStorage.getAsync('userPreferences');
console.log(prefs);
```

### 显示通知

```typescript
// 普通通知
mg.notify('操作成功');

// 错误通知
mg.notify('操作失败', {
  type: 'error',
  position: 'bottom',
  timeout: 5000
});

// Loading 通知
const loading = mg.notify('处理中...', { isLoading: true });

// 完成
setTimeout(() => loading.cancel(), 2000);
```
