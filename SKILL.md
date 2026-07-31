---
name: mastergo-plugin
description: MasterGo 插件开发与 API 维护一体化 skill。覆盖两类场景：(A) 插件开发——从零创建插件项目结构、mg 全局 API 参考、节点类型、自动布局(flexMode)、组件/样式/团队库/字体/图片、DevMode 代码生成、UI 通信、调试与最佳实践；(B) 插件 API 变更同步——当 API 新增/修改/废弃时，按顺序跨三仓库更新 plugin-typings 类型发布 + mastergo-plugin-docs 开发者文档 + master-internal-plugins E2E 单测。触发词：mastergo 插件开发、插件 API、plugin api update、更新插件类型、更新插件文档、补充插件单测、同步插件 API、插件 API 变更、devmode 代码生成、mg.createFrame、flexMode 自动布局。
version: 0.5.0
---

# MasterGo 插件开发与 API 维护

本 skill 整合原 `mastergo-plugin-developer`（插件开发）与 `mastergo-plugin-api-update`（API 变更同步）。

## 场景路由

- **场景 A：开发 MasterGo 插件**（新建项目 / 查 mg API / 节点类型 / 自动布局 / 组件 / 样式 / DevMode 代码生成 / 调试 / 最佳实践）→ 见下方「# MasterGo 插件开发助手」
- **场景 B：插件 API 变更同步**（API 新增/修改/废弃 → 同步 typings 类型发布 + 开发者文档 + E2E 单测）→ 见下方「# MasterGo 插件 API 更新全流程」

> 辅助资料：`assets/`（main.ts / manifest.json / ui.html 模板）、`references/`（api-quick-reference / common-patterns / development-guide / node-types）按需读取。

---

<!-- ==================== Part A：插件开发指南（原 mastergo-plugin-developer） ==================== -->

# MasterGo 插件开发助手

## 概述

本 skill 基于 MasterGo 官方插件文档编写，辅助 MasterGo 插件开发。插件采用双线程架构（主线程 + UI 线程），主线程运行在沙箱中可访问 MasterGo API，UI 线程运行在 iframe 中可访问浏览器 API。

## 节点类型一览

| 节点类型 | type 字段值 | 创建方法 | 特殊属性 |
|---------|-----------|----------|---------|
| 文档 | DOCUMENT | - | children, currentPage |
| 页面 | PAGE | mg.createPage() | selection, label, bgColor |
| 画框 | FRAME | mg.createFrame() | children, flexMode |
| 矩形 | RECTANGLE | mg.createRectangle() | cornerRadius, 独立描边宽度 |
| 椭圆 | ELLIPSE | mg.createEllipse() | arcData |
| 直线 | LINE | mg.createLine() | height=0, leftStrokeCap |
| 多边形 | POLYGON | mg.createPolygon() | pointCount |
| 星形 | STAR | mg.createStar() | pointCount, innerRadius |
| 文本 | TEXT | mg.createText() | characters, textStyles |
| 画笔 | PEN | mg.createPen() | penPaths, penNetwork |
| 切图 | SLICE | mg.createSlice() | 仅布局+导出 |
| 连接线 | CONNECTOR | mg.createConnector() | connectorStart/End |
| 编组 | GROUP | mg.group(nodes) | children |
| 布尔运算 | BOOLEAN_OPERATION | mg.union/subtract/intersect/exclude | booleanOperation |
| 组件 | COMPONENT | mg.createComponent() | createInstance(), ukey |
| 组件集 | COMPONENT_SET | mg.combineAsVariants() | variantProperties |
| 实例 | INSTANCE | component.createInstance() | mainComponent |
| Section | SECTION | mg.createSection() | children |
| 智能容器 | INTELLIGENT_CONTAINER | mg.createIntelligentContainer() | shaderCode, isPlaying (GLSL shader) |
| 文本子图层 | TEXT_SUBLAYER | -（连接线/组件文本子层） | characters, fills（只读 align/autoResize 固定 CENTER） |

## 全局 mg 对象命名空间

```
mg
├── 属性
│   ├── apiVersion             # API 版本（只读）
│   ├── document               # 当前文档 DocumentNode
│   ├── documentId             # 文档 ID（只读）
│   ├── command                # 子菜单命令值（只读）
│   ├── mixed                  # 混合值标记（只读）
│   ├── ui                     # UI 控制对象
│   ├── themeColor             # 'dark' | 'light'（只读）
│   ├── viewport               # 视口控制对象
│   ├── clientStorage          # 客户端存储
│   ├── currentUser            # 当前用户 User | null
│   ├── codegen                # DevMode 代码生成（只读）
│   └── documentCookie         # 文档 Cookie（私有化）
│
├── 插件控制
│   ├── showUI(html?, options?) # 显示 UI（支持 width/height/x/y/withoutHeader）
│   ├── closePlugin()          # 关闭插件
│   ├── commitUndo()           # 提交撤销点
│   ├── triggerUndo()          # 触发撤销
│   ├── on(event, cb)          # 事件监听（selectionchange|layoutchange|close|currentpagechange|themechange|drop|run）
│   ├── once(event, cb)        # 单次事件
│   └── off(event?, cb?)       # 移除监听
│
├── 用户交互
│   ├── notify(message, options?) # Toast 通知
│   ├── showGrid(show)         # 显示/隐藏网格
│   └── saveVersionHistoryAsync(desc, title?) # 保存版本历史
│
├── 工具方法
│   ├── hexToRGBA(hex)         # hex 转 RGBA
│   └── RGBAToHex(rgba)        # RGBA 转 hex
│
├── 创建节点
│   ├── createFrame(children?)    # FrameNode
│   ├── createComponent(children?) # ComponentNode
│   ├── createSection()           # SectionNode
│   ├── createRectangle()         # RectangleNode
│   ├── createEllipse()           # EllipseNode
│   ├── createLine()              # LineNode
│   ├── createPolygon()           # PolygonNode
│   ├── createStar()              # StarNode
│   ├── createText()              # TextNode
│   ├── createPen()               # PenNode
│   ├── createSlice()             # SliceNode
│   ├── createConnector()         # ConnectorNode
│   ├── createPage()              # PageNode
│   ├── createNodeFromSvgAsync(svg) # Promise<FrameNode>
│   └── createImage(data)         # Promise<Image>
│
├── 节点查找
│   ├── getNodeById(id)        # SceneNode | null
│   ├── getNodeByPosition({x,y}) # SceneNode | null
│   └── getHoverLayer()        # SceneNode | PageNode
│
├── 组合操作
│   ├── group(nodes)           # GroupNode
│   ├── union(nodes)           # BooleanOperationNode
│   ├── subtract(nodes)        # BooleanOperationNode
│   ├── intersect(nodes)       # BooleanOperationNode
│   ├── exclude(nodes)         # BooleanOperationNode
│   ├── flatten(nodes)         # PenNode
│   └── combineAsVariants(nodes) # ComponentSetNode
│
├── 样式管理
│   ├── getStyleById(id)       # Style | null
│   ├── getLocalPaintStyles()  # PaintStyle[]
│   ├── getLocalTextStyles()   # TextStyle[]
│   ├── getLocalEffectStyles() # EffectStyle[]
│   ├── getLocalGridStyles()   # GridStyle[]
│   ├── createFillStyle({id, name, description?})    # PaintStyle
│   ├── createStrokeStyle({id, name, description?})   # PaintStyle
│   ├── createEffectStyle({id, name, description?})   # EffectStyle
│   ├── createTextStyle({id, name, description?})     # TextStyle
│   └── createGridStyle({id, name, description?})     # GridStyle
│
├── 团队库
│   ├── getTeamLibraryAsync()  # Promise<TeamLibrary[]>
│   ├── importComponentByKeyAsync(ukey)      # Promise<ComponentNode>
│   ├── importComponentSetByKeyAsync(ukey)   # Promise<ComponentSetNode>
│   └── importStyleByKeyAsync(ukey)          # Promise<BaseStyle>
│
├── 字体管理
│   ├── listAvailableFontsAsync()    # Promise<Font[]>
│   ├── loadFontAsync(fontName)      # Promise<void>
│   └── getTitleByFontFamilyAndStyle(family, style) # FontAlias | null
│
├── 图片管理
│   ├── createImage(data)      # Promise<Image>（PNG/JPEG/GIF/WebP）
│   └── getImageByHref(href)   # Image（同步）
│
├── 变量系统 (mg.variables)
│   ├── 集合管理
│   │   ├── getCollections(includeExternal?)       # Collection[]
│   │   ├── getCollectionById(id?)                 # Collection | null
│   │   ├── createCollection(name?)                # Promise<Collection>
│   │   ├── renameCollection(id, name)             # void
│   │   ├── deleteCollection(id)                   # void
│   │   └── moveCollection(id, {afterId?, index?}) # void
│   ├── 模式管理
│   │   ├── getModes(collectionId?)       # Mode[]
│   │   ├── getModeById(id?, modeId?)     # Mode | null
│   │   ├── addMode(id, name?)            # Promise<Mode>
│   │   ├── renameMode(cId, mId, name)    # void
│   │   ├── deleteMode(cId, mId)          # void
│   │   ├── setVariableMode(cId, mId)     # void
│   │   ├── setPageVariableMode(cId, mId, pageId?) # void
│   │   └── getLayerVariableModes(layerId) # LayerVariableMode[]
│   ├── 变量管理
│   │   ├── getVariables(options?)          # Variable[]
│   │   ├── getVariableById(id)             # Variable | null
│   │   ├── createVariable(options)         # Promise<Variable>
│   │   ├── renameVariable(id, name)        # void
│   │   ├── deleteVariable(id)              # void
│   │   ├── moveVariable(id, options?)      # Promise<void>
│   │   ├── addVariableValue({id, value?, modeId})  # Promise<Variable|null>
│   │   ├── deleteVariableValue({id, index, modeId}) # Promise<Variable|null>
│   │   └── getVariableIndexes(id, modeId?) # string[]
│   ├── 变量值
│   │   └── setVariableValue({id, value, modeId?}) # Variable | null
│   ├── 变量绑定与解绑
│   │   ├── setVariableReference(options)  # void
│   │   └── unlinkVariable({id, modeId?})  # Promise<void>
│   ├── 图层属性绑定
│   │   ├── setVariableReferenceInLayer(options)    # Promise<void>
│   │   ├── unlinkVariableReferenceInLayer(options) # Promise<void>
│   │   └── createVariableInLayer(options)          # Promise<Variable>
│   ├── 组件属性变量
│   │   ├── setVariableInComponent({id, propertyId, type}) # void
│   │   ├── unlinkVariableInComponent({propertyId, type})  # void
│   │   └── createVariableInComponent(options)              # Promise<string|null>
│   ├── 变量作用域
│   │   ├── getVariableScopes(id)          # string[]
│   │   └── setVariableScopes(id, scopes)  # Promise<Variable>
│   ├── 变量描述与别名
│   │   ├── getVariableDescription(id)       # string
│   │   ├── setVariableDescription(id, desc) # Promise<Variable>
│   │   ├── resetVariableDescription(id)     # Promise<Variable>
│   │   ├── getVariableAlias(id)             # string
│   │   ├── setVariableAlias(id, alias)      # Promise<Variable>
│   │   └── resetVariableAlias(id)           # Promise<Variable>
│   ├── 代码语法
│   │   ├── getCodeSyntax(id)     # {web?,android?,ios?}|null
│   │   ├── setCodeSyntax(id, syntax) # Promise<Variable>
│   │   └── resetCodeSyntax(id, platform?) # Promise<Variable>
│   ├── 变量分组
│   │   ├── getGroupList(collectionId?)  # GroupNode[]
│   │   ├── createGroup(cId, varIds, name?)  # void
│   │   ├── addVariablesToGroup(cId, path, ids) # void
│   │   ├── removeVariablesFromGroup(cId, path, ids) # void
│   │   ├── renameGroup(cId, name, path?, ids?) # void
│   │   ├── disbandGroup(cId, path?, ids?) # void
│   │   └── deleteGroup(cId, path?, ids?)  # void
│   └── 字体
│       ├── getFontFamilies()            # FontFamilyInfo[]
│       └── getFontWeights(family)       # FontWeightInfo[]
│
├── WebSocket (mg.WebSocket)
│   ├── CONNECTING: 0 / OPEN: 1 / CLOSING: 2 / CLOSED: 3  # 静态常量
│   ├── connect(url, protocols?)                            # WebSocketHandle
│   └── WebSocketHandle: { readyState, url, protocol, onopen, onmessage, onclose, onerror, send(), close() }
│
└── 样式代码导出
    ├── getStyleCodeById(id, options?)     # CodeString | null
    ├── getWebStyleCodeById(id, options?)  # CodeString | null
    ├── getIOSStyleCodeById(id, options?)  # CodeString | null
    └── getAndroidStyleCodeById(id, options?) # CodeString | null
```

## 自动布局（关键）

### 容器级属性（Frame、Component、ComponentSet、BooleanOperation、Group）

| 属性 | 类型 | 值 | 说明 |
|------|------|-----|------|
| `flexMode` | string | `'NONE' \| 'HORIZONTAL' \| 'VERTICAL'` | **自动布局开关**（不是 `layoutMode`） |
| `flexWrap` | string | `'NO_WRAP' \| 'WRAP'` | 换行（仅 HORIZONTAL 生效） |
| `itemSpacing` | number | - | 子元素间距 |
| `crossAxisSpacing` | number \| null | - | 换行行间距（null 同步 itemSpacing） |
| `mainAxisAlignItems` | string | `'FLEX_START' \| 'FLEX_END' \| 'CENTER' \| 'SPACING_BETWEEN'` | 主轴对齐 |
| `crossAxisAlignItems` | string | `'FLEX_START' \| 'FLEX_END' \| 'CENTER'` | 交叉轴对齐 |
| `mainAxisSizingMode` | string | `'FIXED' \| 'AUTO'` | 主轴尺寸模式 |
| `crossAxisSizingMode` | string | `'FIXED' \| 'AUTO'` | 交叉轴尺寸模式 |
| `crossAxisAlignContent` | string | `'AUTO' \| 'SPACE_BETWEEN'` | 换行行分布 |
| `itemReverseZIndex` | boolean | - | true = 首个子元素在最上层 |
| `strokesIncludedInLayout` | boolean | - | true = 描边计入布局（类似 box-sizing） |
| `paddingTop/Right/Bottom/Left` | number | - | 内边距 |
| `resizeToFit()` | method | - | 适配内容尺寸 |

### 子元素级属性

| 属性 | 类型 | 值 | 说明 |
|------|------|-----|------|
| `flexGrow` | 0 \| 1 | - | 是否填充主轴 |
| `alignSelf` | string | `'STRETCH' \| 'INHERIT'` | 交叉轴填充 |
| `layoutPositioning` | string | `'AUTO' \| 'ABSOLUTE'` | 绝对/自动定位 |
| `maxWidth/minWidth/maxHeight/minHeight` | number | - | 尺寸约束 |

### 约束（非自动布局时）

```typescript
node.constraints = {
  horizontal: 'START' | 'END' | 'STARTANDEND' | 'CENTER' | 'SCALE',
  vertical: 'START' | 'END' | 'STARTANDEND' | 'CENTER' | 'SCALE'
};
```

## 核心 API 使用示例

### 1. 节点创建与操作

```typescript
// 创建并配置矩形
const rect = mg.createRectangle();
rect.x = 100;
rect.y = 100;
rect.width = 200;
rect.height = 150;
rect.fills = [{
  type: 'SOLID',
  color: { r: 0.2, g: 0.5, b: 0.8, a: 1 }
}];
rect.cornerRadius = 8;
mg.document.currentPage.appendChild(rect);
mg.commitUndo();

// 创建文本节点
const text = mg.createText();
await mg.loadFontAsync({ family: 'PingFang SC', style: 'Regular' });
text.characters = 'Hello MasterGo!';
text.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } }];
text.textAlignHorizontal = 'CENTER';
text.textAlignVertical = 'CENTER';
mg.document.currentPage.appendChild(text);

// 创建组件
const component = mg.createComponent([rect, text]);
component.name = 'Button';

// 创建实例
const instance = component.createInstance();
instance.x = 300;
mg.document.currentPage.appendChild(instance);
```

### 2. 自动布局

```typescript
const frame = mg.createFrame();
frame.flexMode = 'VERTICAL';         // 不是 layoutMode！
frame.itemSpacing = 10;
frame.crossAxisSpacing = 8;          // 换行行间距
frame.paddingTop = 16;
frame.paddingRight = 16;
frame.paddingBottom = 16;
frame.paddingLeft = 16;
frame.mainAxisAlignItems = 'FLEX_START';    // 不是 primaryAxisAlignItems！
frame.crossAxisAlignItems = 'FLEX_START';   // 不是 counterAxisAlignItems！
frame.mainAxisSizingMode = 'AUTO';          // 不是 primaryAxisSizingMode！
frame.crossAxisSizingMode = 'FIXED';        // 不是 counterAxisSizingMode！
frame.itemReverseZIndex = false;
frame.strokesIncludedInLayout = true;

// 子元素控制
child.flexGrow = 1;                  // 0 或 1
child.alignSelf = 'STRETCH';         // STRETCH 或 INHERIT
child.layoutPositioning = 'AUTO';    // AUTO 或 ABSOLUTE

// 缩放/翻转
node.rescale(2.0, { scaleCenter: 'TOPLEFT' });
// 锚点: TOPLEFT | TOP | TOPRIGHT | LEFT | CENTER | RIGHT | BOTTOMLEFT | BOTTOM | BOTTOMRIGHT
node.flip('HORIZONTAL');  // 或 'VERTICAL'
```

### 3. 文本节点操作

```typescript
const text = mg.createText();
await mg.loadFontAsync({ family: 'Inter', style: 'Regular' });
text.characters = 'Hello MasterGo!';

// 段落属性
text.textAlignHorizontal = 'CENTER';  // LEFT | CENTER | RIGHT | JUSTIFIED
text.textAlignVertical = 'CENTER';    // TOP | CENTER | BOTTOM
text.textAutoResize = 'WIDTH_AND_HEIGHT';  // NONE | WIDTH_AND_HEIGHT | HEIGHT | TRUNCATE
text.paragraphSpacing = 10;

// 范围样式（0-5 为 "Hello"）
text.setRangeFontSize(0, 5, 32);
text.setRangeFontName(0, 5, { family: 'Inter', style: 'Bold' });
text.setRangeLineHeight(0, 5, { unit: 'PIXELS', value: 40 });
text.setRangeLetterSpacing(0, 5, { value: 0.1, unit: 'PERCENT' });
text.setRangeFills(0, 5, [{ type: 'SOLID', color: { r: 1, g: 0.2, b: 0.2, a: 1 } }]);
text.setRangeTextDecoration(0, 5, 'UNDERLINE');  // NONE | UNDERLINE | STRIKETHROUGH
text.setRangeTextCase(0, 5, 'UPPER');            // ORIGINAL | UPPER | LOWER | TITLE
text.setRangeHyperlink(0, 5, { type: 'URL', value: 'https://mastergo.com' });
text.setRangeFillStyleId(0, 5, 'style-id');      // 绑定填充样式
text.setRangeTextStyleId(0, 5, 'style-id');      // 绑定文本样式（空字符串解绑）
text.setRangeListStyle(0, 5, 'ORDERED');         // NONE | ORDERED | BULLETED

// 超链接读取
text.hyperlinks;  // HyperlinkWithRange[]（注意：superlinks 已废弃）

// 插入/删除
text.insertCharacters(5, ' World');
text.deleteCharacters(0, 6);
```

### 4. 样式管理

```typescript
// 创建样式（注意：参数是 {id, name, description?}，不是内联样式值）
const fillStyle = mg.createFillStyle({ id: node.id, name: 'Primary Blue' });
fillStyle.paints = [{ type: 'SOLID', color: { r: 0.2, g: 0.5, b: 0.8, a: 1 } }];

const textStyle = mg.createTextStyle({ id: node.id, name: 'Heading 1' });
// TextStyle 属性在创建后设置

// 获取样式列表
const paintStyles = mg.getLocalPaintStyles();   // PaintStyle[]
const textStyles = mg.getLocalTextStyles();     // TextStyle[]
const effectStyles = mg.getLocalEffectStyles(); // EffectStyle[]
const gridStyles = mg.getLocalGridStyles();     // GridStyle[]

// 应用样式到节点
node.fillStyleId = fillStyle.id;
node.strokeStyleId = strokeStyle.id;
node.effectStyleId = effectStyle.id;

// 样式代码导出
mg.getWebStyleCodeById(fillStyle.id);
mg.getIOSStyleCodeById(fillStyle.id);
mg.getAndroidStyleCodeById(fillStyle.id);
```

### 5. 组件系统

```typescript
// 创建组件集
const componentSet = mg.combineAsVariants([button1, button2]);
button1.setVariantPropertyValues({ size: 'small', color: 'primary' });
button2.setVariantPropertyValues({ size: 'large', color: 'secondary' });

// 组件属性 CRUD
component.addComponentProperty('variant', 'STRING', 'primary');
component.editComponentProperty('property-id', { name: 'newName', defaultValue: 'secondary' });
component.deleteComponentProperty('property-id');

// 实例操作
const instance = component.createInstance();
instance.setVariantPropertyValues({ size: 'large' });
instance.swapComponent(otherComponent);
instance.resetOverrides();
instance.detachInstance();  // → FrameNode
instance.setProperties({ 'prop-id': 'value' });  // 批量设置属性

// 绑定组件属性（在组件内的子图层上）
textNode.componentPropertyReferences = {
  characters: 'property-id-123',  // 文本内容绑定
  isVisible: 'property-id-456'    // 可见性绑定
};
```

### 6. 团队库

```typescript
const libraries = await mg.getTeamLibraryAsync();
const component = await mg.importComponentByKeyAsync('component-ukey');
const componentSet = await mg.importComponentSetByKeyAsync('set-ukey');
const style = await mg.importStyleByKeyAsync('style-ukey');

// 注意：mg.teamLibrary 已废弃，使用 getTeamLibraryAsync()
```

### 7. UI 通信

```typescript
// 主线程 → UI
mg.ui.postMessage({ type: 'selection-updated', data: { count: selection.length } });

// 主线程接收 UI 消息
mg.ui.onmessage = (msg) => {
  switch (msg.type) {
    case 'create-rectangle': createRectangle(msg.options); break;
  }
};

// UI → 主线程（在 ui.html 中）
parent.postMessage({ type: 'create-rectangle', options: { width: 200 } }, '*');

// UI 接收主线程消息（在 ui.html 中）
window.onmessage = (event) => {
  if (event.data.type === 'selection-updated') updateUI(event.data.data);
};

// 拖放到画布（在 ui.html 中）
parent.postMessage({
  pluginDrop: {
    clientX: event.clientX,
    clientY: event.clientY,
    dropMetadata: { svg: '<svg>...</svg>' }
  }
}, '*');

// 主线程监听拖放
mg.on('drop', (dropEvent) => {
  // dropEvent: { x, y, absoluteX, absoluteY, dropMetadata }
});
```

### 8. 客户端存储

```typescript
await mg.clientStorage.setAsync('key', { theme: 'dark' });
const data = await mg.clientStorage.getAsync('key');
const keys = await mg.clientStorage.keysAsync();
await mg.clientStorage.deleteAsync('key');
// 注意：没有 clearAsync() 方法
```

### 9. 通知

```typescript
mg.notify('操作成功', {
  type: 'success',       // normal | highlight | error | warning | success
  position: 'top',       // top | bottom（小写！）
  timeout: 3000,
  isLoading: true        // 不是 loading！
});
```

### 10. 特效类型

```typescript
// 阴影
node.effects = [{
  type: 'DROP_SHADOW',   // DROP_SHADOW | INNER_SHADOW
  color: { r: 0, g: 0, b: 0, a: 0.5 },
  offset: { x: 0, y: 4 },
  radius: 8,
  spread: 0,
  isVisible: true,
  blendMode: 'NORMAL'
}];

// 模糊
node.effects = [{
  type: 'LAYER_BLUR',    // LAYER_BLUR | BACKGROUND_BLUR
  radius: 10,
  isVisible: true,
  blendMode: 'NORMAL'
}];

// 液态玻璃（MasterGo 特有）
node.effects = [{
  type: 'LIQUID_GLASS',
  depth: 1,
  dispersion: 1,
  refraction: 1,
  lightIntensity: 1,
  lightAngle: 0,
  radius: 10,
  isVisible: true,
  blendMode: 'NORMAL'
}];

// 运动模糊（MasterGo 特有）
node.effects = [{
  type: 'MOTION_BLUR',   // 注意：无 type 字段区分
  radius: 5,
  angle: 45,
  isVisible: true,
  blendMode: 'NORMAL'
}];
```

### 11. 视口控制

```typescript
mg.viewport.center = { x: 100, y: 200 };  // 支持部分设置
mg.viewport.zoom = 2.0;
mg.viewport.bound;               // Rect（只读，注意是单数 bound）
mg.viewport.rulerVisible = true;
mg.viewport.layoutGridVisible = true;
mg.viewport.scrollAndZoomIntoView([node1, node2]);
```

### 12. 字体与图片

```typescript
// 字体
const fonts = await mg.listAvailableFontsAsync();
await mg.loadFontAsync({ family: 'Inter', style: 'Regular' });
const alias = mg.getTitleByFontFamilyAndStyle('Inter', 'Bold');

// 图片
const imageData = new Uint8Array([...]);  // PNG/JPEG/GIF/WebP
const image = await mg.createImage(imageData);
const href = image.href;
const bytes = await image.getBytesAsync();

// 应用图片填充
node.fills = [{ type: 'IMAGE', imageRef: href, scaleMode: 'FILL' }];
// scaleMode: FILL | TILE | STRETCH | FIT | CROP

// 获取已有图片
const existingImage = mg.getImageByHref(href);
```

## DevMode（设计转代码）

DevMode 是 MasterGo 的开发者模式，插件可以在此模式下读取设计 DSL 并生成代码。

### manifest.json 配置

```json
{
  "name": "我的代码生成插件",
  "api": "1.0.0",
  "main": "main.js",
  "ui": "ui.html",
  "editor_type": "devMode",
  "capabilities": ["codegen"]
}
```

### mg.codegen API

```typescript
// 注册代码生成事件
mg.codegen.on('generateDSL', ({ data, callback }) => {
  callback(modifiedDsl);  // 拦截并修改 DSL
});

mg.codegen.on('generate', ({ data, callback }) => {
  callback({ data: { files: [{ name: 'index.vue', content: '...' }] } });
});

mg.codegen.on('codeChange', (data) => { /* 代码变更 */ });

// 获取 DSL/代码
const dsl = await mg.codegen.getDSL(layerId, 'VUE3');
const code = await mg.codegen.getCode(layerId, 'REACT');
const codeFromDsl = await mg.codegen.getCodeByDSL(dsl, 'VUE3');

// 组件模板
mg.codegen.setComponentTemplate({
  documentId: 'xxx', name: 'Ant Design',
  importType: 'npm', importPath: 'ant-design-vue', framework: 'VUE3',
  components: [{
    name: 'Button',
    props: [{ name: 'type', type: 'STRING', aliasName: 'variant' }],
    slots: [{ name: 'default', type: 'TEXT', relateNodeNames: ['文本'] }]
  }]
});
```

### DSL 数据结构

```typescript
interface MGDSLData {
  version: string;
  framework: 'REACT' | 'VUE2' | 'VUE3' | 'ANDROID' | 'IOS';
  nodeMap: Record<string, MGNode>;
  localStyleMap: Record<string, any>;
  fileMap: Record<string, MGDSLFile>;
  root: string;
  entry: string;
  settings: DSLSettings;
}
```

### 13. 设计变量系统 (mg.variables)

设计变量（Design Variables）是 MasterGo 的核心特性，允许创建和管理可复用的设计令牌（Design Tokens），支持集合（Collection）、模式（Mode）、变量（Variable）三级结构。

```typescript
// === 集合管理 ===

// 获取所有变量集合
const collections = mg.variables.getCollections();
const allCollections = mg.variables.getCollections(true); // 含外部集合

// 创建集合
const collection = await mg.variables.createCollection('我的颜色变量');

// 重命名 / 删除 / 排序集合
mg.variables.renameCollection('colId', '新名称');
mg.variables.deleteCollection('colId');
mg.variables.moveCollection('colId', { afterId: 'otherId' }); // 插入到指定集合之后
mg.variables.moveCollection('colId', { index: 0 });           // 插入到首位
```

```typescript
// === 模式管理 ===

// 获取模式
const modes = mg.variables.getModes('colId');
const mode = mg.variables.getModeById('colId', 'modeId');

// 增删改模式
const newMode = await mg.variables.addMode('colId', 'Dark Mode');
mg.variables.renameMode('colId', 'modeId', '新模式名');
mg.variables.deleteMode('colId', 'modeId');

// 切换模式（全局 vs 页面级）
mg.variables.setVariableMode('colId', 'modeId');
mg.variables.setPageVariableMode('colId', 'modeId', 'pageId');

// 获取图层上生效的变量模式
const layerModes = mg.variables.getLayerVariableModes(node.id);
// → [{ collectionId, modeId, modeName, isExplicit, parentModeId }]
```

```typescript
// === 变量 CRUD ===

// 创建变量
const boolVar = await mg.variables.createVariable({
  name: 'isDarkMode', type: 'BOOLEAN', value: true, collectionId: 'colId',
});
const numVar = await mg.variables.createVariable({
  name: 'spacing', type: 'NUMBER', value: 8, collectionId: 'colId',
});
const strVar = await mg.variables.createVariable({
  name: 'buttonText', type: 'STRING', value: 'Click me', collectionId: 'colId',
});
// 颜色变量（RGBA，值范围 0-1）
const colorVar = await mg.variables.createVariable({
  name: 'primaryColor', type: 'COLOR',
  value: { r: 0.2, g: 0.4, b: 0.8, a: 1 }, collectionId: 'colId',
});
// 复合样式变量（创建后默认为空样式）
const paintVar = await mg.variables.createVariable({
  name: '填充样式', type: 'PAINT', collectionId: 'colId',
});

// 查询变量
const vars = mg.variables.getVariables({ type: 'COLOR', collectionId: 'colId' });
const v = mg.variables.getVariableById('varId');

// 修改变量名 / 删除 / 排序
mg.variables.renameVariable('varId', '新变量名');
mg.variables.deleteVariable('varId');
await mg.variables.moveVariable('varId', { index: 0 });
```

**PluginVariableType 枚举**：`'BOOLEAN'` | `'NUMBER'` | `'STRING'` | `'COLOR'` | `'PAINT'` | `'TEXT'` | `'EFFECT'` | `'GRID'` | `'STROKE_WIDTH'` | `'CORNER_RADIUS'` | `'PADDING'`

```typescript
// === 变量值操作 ===

// 修改基础变量值
mg.variables.setVariableValue({ id: 'varId', modeId: 'modeId', value: true });
mg.variables.setVariableValue({ id: 'varId', modeId: 'modeId', value: 12 });
mg.variables.setVariableValue({ id: 'varId', modeId: 'modeId', value: { r: 1, g: 1, b: 1, a: 1 } });

// 填充变量（PAINT）部分更新——不传 index 自动匹配同 type 填充项
mg.variables.setVariableValue({
  id: 'paintVarId', modeId: 'modeId',
  value: { index: '612:1', type: 0, color: { r: 0, g: 0.5, b: 1, a: 0.8 } },
});

// 描边/圆角变量：4 值数组
mg.variables.setVariableValue({ id: 'varId', modeId: 'modeId', value: [1, 2, 1, 2] });
// 内边距变量：上右下左 4 值数组
mg.variables.setVariableValue({ id: 'varId', modeId: 'modeId', value: [10, 20, 10, 20] });

// 特效变量——投影（type=1）
mg.variables.setVariableValue({
  id: 'effectVarId', modeId: 'modeId',
  value: { type: 1, index: '685:0', x: 10, y: 10, radius: 5, spread: 2 },
});
// 图层模糊（type=2）/ 背景模糊（type=3，额外支持 saturate）
mg.variables.setVariableValue({ id: 'varId', modeId: 'modeId', value: { type: 2, radius: 20 } });

// 文本变量部分更新
mg.variables.setVariableValue({
  id: 'textVarId', modeId: 'modeId',
  value: { fontSize: 14, fontWeight: 400, fontFamily: 'Anek Latin' },
});

// 复合变量子项增删
await mg.variables.addVariableValue({ id: 'paintVarId', modeId: 'modeId' });           // 新增默认子项
await mg.variables.deleteVariableValue({ id: 'paintVarId', index: '741:0', modeId: 'modeId' });
const indexes = mg.variables.getVariableIndexes('paintVarId', 'modeId');  // 子项 index 列表
```

```typescript
// === 变量引用绑定（跨类型） ===

// 变量 A 引用变量 B
mg.variables.setVariableReference({ id: 'varId', reference: 'otherVarId', modeId: 'modeId' });

// 填充变量子项绑定到 COLOR 变量
mg.variables.setVariableReference({
  id: 'paintVarId', reference: 'colorVarId', modeId: 'modeId', index: '741:0',
});

// 文字属性绑定（textProperty: fontFamily/fontWeight/fontSize/lineHeight/letterSpacing/paragraphSpacing）
mg.variables.setVariableReference({
  id: 'textVarId', reference: 'numberVarId', modeId: 'modeId', textProperty: 'fontSize',
});

// 子属性绑定（strokeProperty/radiusProperty/paddingProperty/effectProperty/gridProperty）
mg.variables.setVariableReference({
  id: 'strokeVarId', reference: 'numberVarId', modeId: 'modeId', strokeProperty: 'all',
});
mg.variables.setVariableReference({
  id: 'effectVarId', reference: 'colorVarId', modeId: 'modeId',
  index: '685:0', effectProperty: 'color',
});

// 解绑
await mg.variables.unlinkVariable({ id: 'varId', modeId: 'modeId' });
```

```typescript
// === 图层属性变量绑定 ===

// 将变量绑定到图层属性（id 支持本地变量 id 或团队库变量 ukey）
await mg.variables.setVariableReferenceInLayer({
  id: 'numberVarId', layerId: 'layerId', strokeProperty: 'all',
});
// 绑定团队库变量（自动导入，无需先手动导入）
const libraries = await mg.getTeamLibraryAsync();
const colorVar = libraries[0]?.style.colors[0];
await mg.variables.setVariableReferenceInLayer({
  id: colorVar.ukey, layerId: 'layerId', baseProperty: 'fillColor',
});

// 解绑
await mg.variables.unlinkVariableReferenceInLayer({ layerId: 'layerId', strokeProperty: 'all' });

// 在图层上创建变量并一步绑定
await mg.variables.createVariableInLayer({
  name: '圆角', layerId: '2:1', radiusProperty: 'all', collectionId: 'colId',
});
// 支持的属性参数: baseProperty | strokeProperty | radiusProperty | paddingProperty
//   | dimensionProperty | effectProperty | gridProperty | textProperty
```

```typescript
// === 组件属性变量 ===

// 将已有变量绑定到组件属性
mg.variables.setVariableInComponent({ id: 'varId', propertyId: 'propId', type: 'BOOLEAN' });
mg.variables.unlinkVariableInComponent({ propertyId: 'propId', type: 'BOOLEAN' });

// 创建变量 + 组件属性 + 绑定（一步完成）
const propId = await mg.variables.createVariableInComponent({
  name: 'isVisible', layerId: 'componentLayerId',
  type: 'BOOLEAN', value: true, collectionId: 'colId',
});
```

```typescript
// === 变量作用域 ===
// 不同变量类型有不同的可用 scope 值，如 COLOR: 'all'|'fillAll'|'fill'|'stroke'|'effect'|'grid'
// NUMBER: 'all'|'widthHeight'|'cornerRadius'|'layoutSpacing'|'opacity'|'fontSize'|...
const scopes = mg.variables.getVariableScopes('varId');
await mg.variables.setVariableScopes('varId', ['fillAll', 'stroke']);

// === 描述 / 别名 / 代码语法 ===
mg.variables.setVariableDescription('varId', '主色调变量');
mg.variables.setVariableAlias('varId', 'primary-color');
await mg.variables.setCodeSyntax('varId', { web: '--primary-color', android: 'primaryColor', ios: 'primaryColor' });
await mg.variables.resetCodeSyntax('varId', 'web');  // 单独重置某平台

// === 分组管理 ===
const groups = mg.variables.getGroupList('colId');
mg.variables.createGroup('colId', ['var1', 'var2'], '布尔变量组');
mg.variables.addVariablesToGroup('colId', '分组路径', ['var3']);
mg.variables.disbandGroup('colId', '分组路径');    // 解散分组（变量保留）
mg.variables.deleteGroup('colId', '分组路径');     // 删除分组（变量也删除）
```

### 14. WebSocket 通信 (mg.WebSocket)

插件主线程可通过 `mg.WebSocket` 创建和管理 WebSocket 连接，API 设计尽量贴近浏览器原生 `WebSocket`。

```typescript
// 静态常量（比对接状态）
mg.WebSocket.CONNECTING  // 0
mg.WebSocket.OPEN        // 1
mg.WebSocket.CLOSING     // 2
mg.WebSocket.CLOSED      // 3

// 创建连接
const ws = mg.WebSocket.connect('ws://localhost:50678');
const ws2 = mg.WebSocket.connect('wss://example.com/ws', ['soap', 'wamp']);

// 回调（第一个参数为 WebSocketHandle 自身）
ws.onopen = function(self, event) {
  console.log('连接成功，url:', self.url);
  self.send({ type: 'handshake', version: 1 });
};

ws.onmessage = function(self, data) {
  // 字符串消息会自动 JSON.parse；解析失败则返回原始字符串
  console.log('收到:', data);
};

ws.onclose = function(self, event) {
  // event: { code, reason, wasClean }
  if (!event.wasClean) console.warn('异常关闭, code:', event.code);
};

ws.onerror = function(self, event) {
  console.error('WebSocket 错误:', event.type);
};

// 发送（对象自动 JSON.stringify）
ws.send('ping');
ws.send({ cmd: 'canvasOp', data: { layerId: '123' } });

// 关闭
ws.close(1000, '正常关闭');

// 安全检查
if (ws.readyState === mg.WebSocket.OPEN) {
  ws.send(data);
}
```

**与浏览器原生 WebSocket 差异**：
- 回调第一个参数为 `WebSocketHandle` 自身（非 `event`）
- `onmessage` 的 `data` 自动 `JSON.parse`（解析失败返回原始字符串）
- 暂不支持二进制消息（Blob/ArrayBuffer）

### 15. 原型交互类型（Reaction / Trigger / Action / Transition / Easing）

以下类型用于描述节点上的原型交互。读取节点可通过 `node.reactions?: Reaction[]`（实验性）。

```typescript
// === Reaction — 交互描述 ===
interface Reaction {
  readonly trigger: Trigger;
  readonly action?: Action;
}

// === Trigger — 触发行为 ===
interface Trigger {
  readonly type: TriggerType;  // 'ON_CLICK' | 'ON_DRAG' | 'ON_HOVER' | 'ON_PRESS'
                               // | 'MOUSE_ENTER' | 'MOUSE_LEAVE' | 'MOUSE_DOWN' | 'MOUSE_UP' | 'AFTER_DELAY'
  readonly delay: number;      // 毫秒，非 AFTER_DELAY 时恒为 0
}

// === Action — 交互动作 ===
interface Action {
  readonly type: ActionType;          // 'BACK' | 'NODE' | 'URL' | 'CLOSE' | 'NONE'
  readonly destinationId: string;     // 目标图层 ID（NODE 动作时）
  readonly navigation: Navigation;    // 'NAVIGATE' | 'OVERLAY' | 'SWAP_OVERLAY' | 'SCROLL_TO'
  readonly transition: Transition;    // 动画效果
  readonly url: string;               // URL 动作时
  readonly scrollToXOffset?: number;  // 容器内滚动
  readonly scrollToYOffset?: number;
}

// === Transition — 动画 ===
interface Transition {
  readonly type: TransitionType;      // 'INSTANT' | 'DISSOLVE' | 'SMART_ANIMATE'
                                      // | 'MOVE_IN' | 'MOVE_OUT' | 'PUSH'
                                      // | 'SLIDE_IN' | 'SLIDE_OUT' | 'DISPLACE'
  readonly duration: number;          // 毫秒
  readonly direction: TransitionDirection; // 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM'
  readonly easing: Easing;
}

// === Easing — 缓动 ===
interface Easing {
  readonly type: EasingType;          // 'LINEAR' | 'EASE_IN' | 'EASE_OUT' | 'EASE_IN_AND_OUT'
                                      // | 'EASE_IN_BACK' | 'EASE_OUT_BACK' | 'EASE_IN_AND_OUT_BACK'
                                      // | 'CUSTOM_CUBIC_BEZIER'
  readonly easingFunctionCubicBezier?: { x1: number; x2: number; y1: number; y2: number };
}
```

### 16. 智能容器节点 (IntelligentContainerNode)

智能容器继承自 FrameNode，用于承载 GLSL shader 动画效果。创建方法：`mg.createIntelligentContainer()`。

```typescript
// 特有属性
const ic = mg.createIntelligentContainer();
ic.shaderCode = 'void main() { ... }';  // GLSL 着色器代码
ic.isPlaying = true;                     // 播放/暂停

// GLSL 代码格式要求：
// 1. 仅需片段着色器（Fragment Shader），不需顶点着色器
// 2. 必须声明两个 uniform：uniform float u_time;（时间戳，毫秒）
//    uniform sampler2D u_texture;（画布纹理）
// 3. UV 坐标必须通过 textureSize 获取，不可硬编码分辨率：
//    vec2 uv = gl_FragCoord.xy / vec2(textureSize(u_texture, 0));
// 4. 自定义参数声明为 const，上方注释说明功能和取值范围：
//    // 极光强度: [0.2, 3.0]
//    const float AURORA_INTENSITY = 1.4;
//    注释格式是设置面板自动解析参数的依据，会被映射为可拖拽滑块
```

### 17. 文本子图层节点 (TextSublayerNode)

文本子图层是文本的精简版本，出现在连接线文本（`connector.text`）和组件文本子层等场景。类型标识：`'TEXT_SUBLAYER'`。

```typescript
// TextSublayerNode 与 TextNode 的关键差异：
// - textAlignHorizontal / textAlignVertical: 固定为 'CENTER'（只读）
// - textAutoResize: 固定为 'WIDTH_AND_HEIGHT'（只读）
// - 不可调整大小或重新定位（无 x/y/width/height）

// 读取和设置文本内容（和普通文本节点一致）
connector.text.characters = '一些文本';
await mg.loadFontAsync({ family: 'PingFang SC', style: 'Regular' });

// 可用属性：
// characters, insertCharacters/deleteCharacters, fills, fillStyleId
// fontName, fontSize, letterSpacing, lineHeight, textDecoration
// hyperlinks, listStyles, paragraphSpacing, textStyles
// hasMissingFont (只读), setRange* 系列方法
```

## REST API（服务端接口）

MasterGo 提供 OpenAPI 用于服务端集成（Beta）。

```bash
# 获取 AccessToken
curl -L -X POST "https://mastergo.com/openapi/v1/organization/application/token" \
  -H "Content-Type: application/json" \
  -d '{"app_id": "your_app_id", "app_secret": "your_app_secret"}'

# 后续请求
curl -L "https://mastergo.com/openapi/v1/..." \
  -H "X-MG-Authentication: your_access_token"
```

标签：`Private`（私有部署）、`Deprecated`（已废弃）、`Beta`（测试中）

## 开发流程

### manifest.json 配置

**普通插件：**
```json
{
  "name": "我的插件",
  "api": "1.0.0",
  "main": "main.js",
  "ui": "ui.html",
  "permissions": ["currentuser"]
}
```

**DevMode 代码生成插件：**
```json
{
  "name": "代码生成插件",
  "api": "1.0.0",
  "main": "main.js",
  "ui": "ui.html",
  "editor_type": "devMode",
  "capabilities": ["codegen"]
}
```

**带菜单的插件：**
```json
{
  "name": "带菜单插件",
  "api": "1.0.0",
  "main": "main.js",
  "ui": "ui.html",
  "menu": [
    { "name": "功能一", "command": "feature1" },
    { "name": "功能二", "command": "feature2" }
  ]
}
```

### ⚠️ MasterGo vs Figma manifest 差异

| 平台 | 网络权限字段 | 格式 |
|------|------------|------|
| MasterGo | `permissions` | 数组：`["currentuser"]` |
| Figma | `networkAccess` | 对象：`{"allowedDomains": ["*"]}` |

MasterGo **不支持** `networkAccess` 字段。Figma **不支持** `permissions` 为嵌套对象。

### TypeScript 支持

```bash
yarn add @mastergo/plugin-typings
```

```json
// tsconfig.json
{ "compilerOptions": { "types": ["@mastergo/plugin-typings"] } }
```

### 调试

- 快捷键：`Ctrl+Alt+P` (Windows) 或 `Cmd+Option+P` (Mac)
- 主线程沙箱支持：`setTimeout`、`setInterval`、`requestAnimationFrame`、`console.log/error/warn`

## 常见陷阱

| 问题 | 错误做法 | 正确做法 |
|-----|---------|---------|
| 自动布局 | `frame.layoutMode = 'VERTICAL'` | `frame.flexMode = 'VERTICAL'` |
| 主轴对齐 | `frame.primaryAxisAlignItems = 'MIN'` | `frame.mainAxisAlignItems = 'FLEX_START'` |
| 交叉轴对齐 | `frame.counterAxisAlignItems = 'MIN'` | `frame.crossAxisAlignItems = 'FLEX_START'` |
| 创建样式 | `mg.createFillStyle({name, fills: [...]})` | `mg.createFillStyle({id, name})` → 设置 `.paints` |
| 修改 fills | `node.fills[0].color.r = 1` | 完全替换整个 fills 数组 |
| 修改文本 | 直接修改 `characters` | 先调用 `mg.loadFontAsync()` |
| 发送请求 | 在主线程使用 fetch | 在 UI 线程使用 fetch |
| 菜单配置 | `{"name": "x", "use": "y"}` | `{"name": "x", "command": "y"}` |
| 通知位置 | `position: 'BOTTOM'` | `position: 'bottom'`（小写） |
| 通知加载 | `loading: true` | `isLoading: true` |
| 超链接 | `text.setRangeSuperLink()` | `text.setRangeHyperlink()`（前者已废弃） |

## 最佳实践

- ✅ 修改文本前先 `mg.loadFontAsync()`
- ✅ 复杂属性（fills、effects 等）完全替换
- ✅ 操作完成后调用 `mg.commitUndo()`
- ✅ 使用 `mg.notify()` 提供用户反馈
- ✅ 验证选择：`selection.length > 0`
- ❌ 不要在主线程使用 fetch/XHR
- ❌ 不要直接修改复杂对象内部属性
- ❌ 不要假设节点存在（检查 `node.removed`）

---

<!-- ==================== Part B：插件 API 更新全流程（原 mastergo-plugin-api-update） ==================== -->

# MasterGo 插件 API 更新全流程

此技能负责当插件 API 发生变更时，按正确顺序完成三个子项目的更新。

## 环境变量

本技能通过环境变量定位项目路径，**使用前必须设置** `MG_DOCS_ROOT`：

```bash
export MG_DOCS_ROOT=/Users/liyanfeng/code/mg/mg-docs
```

如需为单个项目覆盖路径，可额外设置：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MG_PLUGIN_TYPINGS` | `$MG_DOCS_ROOT/plugin-typings` | 插件类型声明项目 |
| `MG_PLUGIN_DOCS` | `$MG_DOCS_ROOT/mastergo-plugin-docs` | 插件开发者文档 |
| `MG_INTERNAL_PLUGINS` | `$MG_DOCS_ROOT/master-internal-plugins` | 插件 E2E 单测 |

**重要**: 技能启动后，先读取 `MG_DOCS_ROOT` 环境变量（调用 `echo $MG_DOCS_ROOT`）。如果为空，输出以下提示并中止：

```
❌ 请先设置 MG_DOCS_ROOT 环境变量，指向 mg-docs 仓库根目录:
   export MG_DOCS_ROOT=/path/to/mg-docs
```

下文用 `$MG_DOCS_ROOT` 泛指上述变量解析后的路径。

## 项目路径

| 项目 | 路径 | 说明 |
|------|------|------|
| plugin-typings | `$MG_DOCS_ROOT/plugin-typings` | 插件 TypeScript 类型声明，发布为 `@mastergo/plugin-typings` |
| mastergo-plugin-docs | `$MG_DOCS_ROOT/mastergo-plugin-docs` | 插件开发者文档 (VitePress) |
| master-internal-plugins | `$MG_DOCS_ROOT/master-internal-plugins` | 插件 E2E 单测 |

## 执行顺序

按以下四个阶段依次执行，不可跳过或调换顺序。每完成一个阶段需确认结果后再进入下一阶段。

---

### 阶段 1: 更新 plugin-typings 类型定义

**核心文件**: `plugin.d.ts`（在 plugin-typings 项目根目录）

#### 操作步骤

1. **阅读 `$MG_DOCS_ROOT/plugin-typings/plugin.d.ts`**，理解现有类型结构，找到需要修改的类型/接口/函数
2. **编辑 `plugin.d.ts`**，根据 API 变更内容添加/修改/标记废弃类型声明
3. **构建验证**:
   ```bash
   cd $MG_DOCS_ROOT/plugin-typings && yarn build
   ```
   确保构建无报错。
4. **如果变更涉及 MG-DSL 类型**，同步更新 `mg-dsl.d.ts` 或 `mg-comp-temp.d.ts`

#### 类型声明规范

- 遵循 `plugin.d.ts` 中已有的代码风格和 JSDoc 注释格式
- 新增类型放在相关的 `interface`/`namespace` 中，不要随意新建顶层声明
- 废弃的类型/方法标记 `@deprecated`，并注明替代方案
- 所有对外暴露的 API 必须有 JSDoc 注释

#### 发布 beta 版本

确认类型文件无误后，执行发布:

```bash
cd $MG_DOCS_ROOT/plugin-typings && yarn release
```

在交互式选择中:
- 第一步选择: **`dev`**
- 第二步选择: **`prepatch`**（也可以是 preminor/prerelease，根据变更规模）

> 注意: `yarn release` 会检查 `gh auth status` 登录状态。如果 `gh` 未安装或未登录，会提示手动操作指引并跳过 PR/Release 创建，但不会中断发布流程。

发布成功后，记录新的 beta 版本号（如 `2.18.5-beta.0`）。

---

### 阶段 2: 更新 mastergo-plugin-docs 开发者文档

**文档根路径**: `$MG_DOCS_ROOT/mastergo-plugin-docs/docs/`

#### 文档结构

| 目录 | 内容 |
|------|------|
| `docs/apis/` | API 参考文档，每个节点/模块一个 `.md` 文件 |
| `docs/types/` | TypeScript 类型参考文档 |
| `docs/updates/` | 版本更新日志 |
| `docs/guide/` | 开发指南 |
| `docs/plugin-typings/` | 类型安装使用说明 |

#### 操作步骤

1. **找到对应的 markdown 文件**。例如:
   - `mg` 全局 API → `docs/apis/mastergo.md`
   - `FrameNode` → `docs/apis/frameNode.md`
   - 类型定义 → `docs/types/<type>.md`
2. **更新 API 文档**:
   - 新增 API：添加对应的标题、描述、类型签名、代码示例
   - 修改 API：更新类型签名和描述
   - 废弃 API：标记 `@deprecated` 或添加废弃提示
3. **更新版本日志**:
   - 在 `docs/updates/` 下创建新的 `YYYY-MM-DD.md` 文件
   - 格式参考已有文件（标题为版本号、发布时间、更新列表）
   - 在 `docs/.vitepress/config.js` 的 `getUpdateLogs()` 中添加新版本的 sidebar 条目
4. **更新 plugin-typings 引用**:
   - 在 `docs/plugin-typings/usages.md` 中更新 `@mastergo/plugin-typings` 版本号

#### 文档编写规范

- 使用 VitePress 的 markdown 扩展语法
- API 属性标注 `Readonly`、`Type`、是否可选
- 链接到相关的类型页面，使用相对路径
- 代码示例使用 `ts` 或 `js` 代码块

---

### 阶段 3: 更新 master-internal-plugins E2E 单测

**测试项目路径**: `$MG_DOCS_ROOT/master-internal-plugins/packages/plugin-api-e2e-test/`

#### 操作步骤

1. **升级依赖版本**（如阶段 1 已发布新 beta 版）:
   ```bash
   cd $MG_DOCS_ROOT/master-internal-plugins && \
   pnpm --filter plugin-e2e-test add -D @mastergo/plugin-typings@<新beta版本号>
   ```
   注意：使用 `pnpm`，因为项目使用 pnpm workspace。

2. **找到对应的测试文件**:
   - 全局方法 → `src/tests/globalFn.ts`
   - 组件 → `src/tests/component.ts`
   - 组件集 → `src/tests/componentSet.ts`
   - 自动布局 → `src/tests/autoLayout.ts`
   - Frame → `src/tests/frame.ts`
   - 实例 → `src/tests/instance.ts`
   - 文字 → `src/tests/textNode.ts`
   - 样式 → `src/tests/style/`
   - 导出 → `src/tests/export.ts`
   - UI → `src/tests/uiFn.ts`
   - WebSocket → `src/tests/websocket.ts`
   - 页面 → `src/tests/pageNode.ts`
   - 文档 → `src/tests/documentNode.ts`
   - 团队库 → `src/tests/team-library.ts`
   - 连接线 → `src/tests/connectorNode.ts`

3. **编写测试用例**，遵循现有测试模式:
   - 使用 `Test.describe` / `Test.it`（来自 `src/decribe.ts`）
   - 使用 `chai.expect` 做断言
   - 测试命名：`it('描述性中文标题', async () => { ... })`
   - 在 `after` 回调中清理创建的节点和样式
   - 使用 `src/lib/` 中的工具函数（如 `createRects`、`sleep` 等）
   - 参考 `src/tests/autoLayout.ts` 作为示例

4. **构建验证**:
   ```bash
   cd $MG_DOCS_ROOT/master-internal-plugins && pnpm build-e2e-test
   ```
   确保 webpack 构建无报错。

#### 测试用例编写要求

- **必须覆盖主路径** (happy path): 验证 API 正常工作
- **建议覆盖边界情况**: 异常参数、空值、并发调用等
- **测试命名用中文**，与现有测试风格一致
- **合理使用 `sleep()`**: 事件驱动的 API（如 `selectionchange`）需要 `await sleep(N)` 等待
- **清理资源**: 在 `after()` 中清理创建的页面、节点、样式

---

### 阶段 4: 验证与提交

#### 本地验证流程

1. **启动 e2e 插件服务**:
   ```bash
   cd $MG_DOCS_ROOT/master-internal-plugins && pnpm serve
   ```
   这会启动一个本地服务器（通常是 `http://localhost:7733`）。

2. **在 MasterGo 中加载插件**:
   打开 MasterGo 设计文件，在浏览器控制台执行:
   ```js
   window.runNewPlugin('http://localhost:7733/pluginUrl', true)
   ```
   插件窗口弹出后在 UI 中查看测试结果。

3. **检查测试结果**: 确保所有用例（包括新旧）通过。

#### Git 提交

确认全部通过后，分项目提交:

1. **plugin-typings**: 通常由 `yarn release` 自动提交到 `release/vX.Y.Z` 分支
2. **mastergo-plugin-docs**: `git add` + `git commit` 在对应的 feature 分支
3. **master-internal-plugins**: `git add` + `git commit` 在对应的 feature 分支

---

## 快速参考

### 常见 API 变更对应的文档文件

| API 变更 | plugin.d.ts 位置 | 文档文件 | 测试文件 |
|----------|-----------------|---------|---------|
| mg.xxx 全局方法 | `PluginAPI` interface | `docs/apis/mastergo.md` | `src/tests/globalFn.ts` |
| 节点属性 (如 FrameNode) | 对应 `*Node` interface | `docs/apis/frameNode.md` 等 | `src/tests/frame.ts` 等 |
| 类型定义 (如 Rect) | 对应 type/interface | `docs/types/<type>.md` | 在相关节点测试中 |
| 组件属性 | `ComponentPropertiesMixin` | `docs/apis/componentNode.md` | `src/tests/component.ts` |
| 自动布局 | `AutoLayoutMixin` | `docs/apis/frameNode.md` 等 | `src/tests/autoLayout.ts` |
| 事件 | `PluginAPI.on/off` | `docs/apis/mastergo.md` | 按事件类型分散 |
| 样式 | `PaintStyle/TextStyle` 等 | `docs/types/style.md` | `src/tests/style/` |
| DSL 类型 | `mg-dsl.d.ts` / `mg-comp-temp.d.ts` | `docs/devmode/types/` | 视情况而定 |

### 快捷命令

```bash
# plugin-typings 构建
cd $MG_DOCS_ROOT/plugin-typings && yarn build

# plugin-typings 发布 (交互式，需手动)
cd $MG_DOCS_ROOT/plugin-typings && yarn release
# → 选择 dev → 选择 prepatch

# master-internal-plugins 构建
cd $MG_DOCS_ROOT/master-internal-plugins && pnpm build-e2e-test

# master-internal-plugins 启动测试服务
cd $MG_DOCS_ROOT/master-internal-plugins && pnpm serve
```
