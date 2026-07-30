# MasterGo 插件开发常见模式和最佳实践

## 节点操作模式

### 模式 1：安全地获取和验证节点

```typescript
// 获取当前选中的第一个节点
function getSelectedNode(): SceneNode | null {
  const selection = mg.document.currentPage.selection;
  if (selection.length === 0) {
    mg.notify('请先选择一个节点', { type: 'warning' });
    return null;
  }
  return selection[0];
}

// 验证节点类型
function assertNodeType<T extends SceneNode>(
  node: SceneNode,
  type: string
): node is T {
  if (node.type !== type) {
    mg.notify(`期望 ${type} 类型，但得到 ${node.type}`, { type: 'error' });
    return false;
  }
  return true;
}

// 使用示例
const node = getSelectedNode();
if (!node) return;

if (assertNodeType<RectangleNode>(node, 'RECTANGLE')) {
  // 现在 TypeScript 知道这是 RectangleNode
  node.cornerRadius = 10;
}
```

### 模式 2：批量修改节点属性

```typescript
// 正确的属性修改方式
function updateNodeFill(node: SceneNode, newColor: RGBA) {
  // 完全替换 fills 数组
  const newFills = clone(node.fills);
  if (newFills.length > 0 && newFills[0].type === 'SOLID') {
    newFills[0].color = newColor;
  }
  node.fills = newFills;
}

// 克隆函数
function clone<T>(val: T): T {
  return JSON.parse(JSON.stringify(val));
}
```

### 模式 3：递归遍历节点树

```typescript
// 查找所有匹配条件的节点
function findNodesDeep(
  node: BaseNode,
  predicate: (node: SceneNode) => boolean
): SceneNode[] {
  const results: SceneNode[] = [];

  function traverse(current: BaseNode) {
    if ('children' in current) {
      for (const child of current.children) {
        if (predicate(child)) {
          results.push(child);
        }
        traverse(child);
      }
    }
  }

  traverse(node);
  return results;
}

// 使用示例：查找所有名称包含 "button" 的节点
const buttons = findNodesDeep(mg.document.currentPage,
  (node) => node.name.toLowerCase().includes('button')
);
```

## UI 通信模式

### 模式 4：类型安全的消息传递

```typescript
// main.ts - 定义消息类型
type UIMessage =
  | { type: 'create-ellipse'; count: number }
  | { type: 'update-settings'; settings: UserSettings }
  | { type: 'request-data' };

type MainMessage =
  | { type: 'success'; data: any }
  | { type: 'error'; message: string }
  | { type: 'data-response'; data: any };

mg.ui.onmessage = (msg: UIMessage) => {
  switch (msg.type) {
    case 'create-ellipse':
      handleCreateEllipse(msg.count);
      break;
    case 'update-settings':
      handleUpdateSettings(msg.settings);
      break;
    case 'request-data':
      handleRequestData();
      break;
  }
};
```

```typescript
// ui.html - 发送类型化消息
function sendCreateEllipseMessage(count: number) {
  parent.postMessage({
    type: 'create-ellipse',
    count
  } as UIMessage, '*');
}
```

### 模式 5：异步操作的 Promise 封装

```typescript
// main.ts - 将消息传递封装为 Promise
function createUIBridge() {
  let messageHandler: ((msg: any) => void) | null = null;

  mg.ui.onmessage = (msg) => {
    if (messageHandler) {
      messageHandler(msg);
    }
  };

  return {
    send: (data: any) => mg.ui.postMessage(data),

    request: <T>(data: any, timeout = 30000): Promise<T> => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          messageHandler = null;
          reject(new Error('UI 请求超时'));
        }, timeout);

        messageHandler = (msg) => {
          clearTimeout(timer);
          messageHandler = null;
          resolve(msg);
        };

        mg.ui.postMessage(data);
      });
    }
  };
}

// 使用示例
const bridge = createUIBridge();
const result = await bridge.request<{ processed: boolean }>({
  type: 'process-image',
  imageData: bytes
});
```

## 文本处理模式

### 模式 6：安全的文本编辑

```typescript
async function safeTextEdit(
  textNode: TextNode,
  editor: (text: string) => string
): Promise<boolean> {
  // 检查字体缺失
  if (textNode.hasMissingFont) {
    mg.notify('文本包含缺失字体，无法编辑', { type: 'error' });
    return false;
  }

  // 收集所有字体
  const fonts = new Set<FontName>();
  for (const style of textNode.textStyles) {
    fonts.add(style.textStyle.fontName);
  }

  // 加载所有字体
  try {
    await Promise.all(
      Array.from(fonts).map(font => mg.loadFontAsync(font))
    );
  } catch (error) {
    mg.notify('字体加载失败', { type: 'error' });
    return false;
  }

  // 修改文本
  const newText = editor(textNode.characters);
  textNode.characters = newText;

  return true;
}

// 使用示例
await safeTextEdit(textNode, (text) => {
  return text.toUpperCase();
});
```

### 模式 7：处理多段样式文本

```typescript
function getStyledSegments(textNode: TextNode): Array<{
  text: string
  style: TextSegStyle
}> {
  const segments: Array<{ text: string; style: TextSegStyle }> = [];
  let currentIndex = 0;

  for (const segStyle of textNode.textStyles) {
    const { start, end } = segStyle.characterStyle;
    const text = textNode.characters.substring(start, end);
    segments.push({ text, style: segStyle.textStyle });
    currentIndex = end;
  }

  return segments;
}

// 使用示例
const segments = getStyledSegments(textNode);
segments.forEach(seg => {
  console.log(`文本: "${seg.text}", 字体: ${seg.style.fontName}`);
});
```

## 图片处理模式

### 模式 8：图片数据处理

```typescript
// main.ts - 发送图片数据到 UI 处理
async function processImageFill(node: SceneNode) {
  const imageFills = node.fills.filter(f => f.type === 'IMAGE');

  mg.showUI(__html__, { visible: false });

  for (const fill of imageFills) {
    if (fill.type === 'IMAGE') {
      const imageHandle = mg.getImageByHref(fill.imageRef);
      const bytes = await imageHandle.getBytesAsync();

      // 发送到 UI 处理
      mg.ui.postMessage({ type: 'process', bytes });

      // 等待处理结果
      const result = await new Promise<{ processed: Uint8Array }>(
        resolve => {
          mg.ui.onmessage = (msg) => resolve(msg);
        }
      );

      // 创建新图片
      const newImage = await mg.createImage(result.processed);
      fill.imageRef = newImage.href;
    }
  }
}
```

```html
<!-- ui.html - 使用 Canvas 处理图片 -->
<script>
window.onmessage = async (event) => {
  if (event.data.type === 'process') {
    const bytes = event.data.bytes;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // 解码图片
    const decoded = await decodeImage(canvas, ctx, bytes);

    // 处理图片（例如：灰度化）
    const pixels = decoded.data;
    for (let i = 0; i < pixels.length; i += 4) {
      const gray = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
      pixels[i] = pixels[i + 1] = pixels[i + 2] = gray;
    }

    // 编码图片
    const processed = await encodeImage(canvas, ctx, decoded);

    // 发回主线程
    parent.postMessage({ processed }, '*');
  }
};
</script>
```

## 样式管理模式

### 模式 9：创建和应用样式

```typescript
// 从节点创建样式
function createStyleFromNode(
  node: SceneNode,
  name: string,
  description?: string
): PaintStyle {
  const style = mg.createFillStyle({
    id: node.id,
    name,
    description
  });

  style.name = name;
  style.paints = clone(node.fills);

  return style;
}

// 应用样式到节点
function applyStyleToNode(node: SceneNode, styleId: string) {
  const style = mg.getStyleById(styleId);
  if (!style) {
    mg.notify('样式不存在', { type: 'error' });
    return;
  }

  if (style.type === 'PAINT') {
    node.fillStyleId = styleId;
  }
}

// 使用示例
const node = mg.document.currentPage.selection[0];
const style = createStyleFromNode(node, '我的红色填充', '用于按钮的红色');
applyStyleToNode(node, style.id);
```

## 错误处理模式

### 模式 10：统一的错误处理

```typescript
// 创建错误处理包装器
function handlePluginErrors(
  operation: string,
  fn: () => void | Promise<void>
) {
  try {
    const result = fn();

    if (result instanceof Promise) {
      result.catch((error) => {
        console.error(`${operation} 失败:`, error);
        mg.notify(`${operation} 失败: ${error.message}`, {
          type: 'error'
        });
      });
    }
  } catch (error) {
    console.error(`${operation} 失败:`, error);
    mg.notify(`${operation} 失败: ${error.message}`, {
      type: 'error'
    });
  }
}

// 使用示例
handlePluginErrors('创建节点', () => {
  const node = mg.createRectangle();
  node.x = 100;
  node.y = 100;
});
```

### 模式 11：验证用户输入

```typescript
function validateSelection(
  requiredType?: string,
  minCount = 1,
  maxCount?: number
): SceneNode[] | null {
  const selection = mg.document.currentPage.selection;

  if (selection.length < minCount) {
    mg.notify(`请至少选择 ${minCount} 个节点`, { type: 'warning' });
    return null;
  }

  if (maxCount && selection.length > maxCount) {
    mg.notify(`最多只能选择 ${maxCount} 个节点`, { type: 'warning' });
    return null;
  }

  if (requiredType) {
    const invalid = selection.filter(n => n.type !== requiredType);
    if (invalid.length > 0) {
      mg.notify(`所有节点必须是 ${requiredType} 类型`, { type: 'warning' });
      return null;
    }
  }

  return selection;
}

// 使用示例
const nodes = validateSelection('RECTANGLE', 1, 1);
if (!nodes) return;

// 现在可以安全地操作 nodes[0] 为 RectangleNode
const rect = nodes[0] as RectangleNode;
rect.cornerRadius = 10;
```

## 性能优化模式

### 模式 12：延迟计算和缓存

```typescript
// 缓存计算结果
class NodeCache {
  private cache = new Map<string, any>();

  get<T>(key: string, compute: () => T): T {
    if (!this.cache.has(key)) {
      this.cache.set(key, compute());
    }
    return this.cache.get(key);
  }

  clear() {
    this.cache.clear();
  }
}

// 使用示例
const cache = new NodeCache();

function getAllTextNodes(): TextNode[] {
  return cache.get('all-text-nodes', () => {
    return mg.document.currentPage.findAll(n => n.type === 'TEXT');
  });
}
```

### 模式 13：批量操作并提交撤销

```typescript
function batchUpdate(nodes: SceneNode[], updates: (node: SceneNode) => void) {
  // 开始批量操作
  mg.commitUndo();

  try {
    nodes.forEach(node => {
      updates(node);
    });

    // 完成批量操作
    mg.commitUndo();
  } catch (error) {
    // 出错时回滚
    mg.triggerUndo();
    throw error;
  }
}

// 使用示例
const nodes = mg.document.currentPage.selection;
batchUpdate(nodes, (node) => {
  node.x += 10;
  node.y += 10;
});
```

## 团队库集成模式

### 模式 14：从团队库导入组件

```typescript
async function importTeamComponent(ukey: string) {
  try {
    const component = await mg.importComponentByKeyAsync(ukey);

    // 创建实例
    const instance = component.createInstance();

    // 添加到当前页面
    mg.document.currentPage.appendChild(instance);

    // 设置位置
    instance.x = mg.viewport.center.x - instance.width / 2;
    instance.y = mg.viewport.center.y - instance.height / 2;

    mg.notify('组件导入成功', { type: 'success' });
    return instance;
  } catch (error) {
    mg.notify(`组件导入失败: ${error.message}`, { type: 'error' });
    return null;
  }
}
```

## 插件生命周期管理

### 模式 15：完整的插件初始化和清理

```typescript
// main.ts
let cleanupFunctions: Array<() => void> = [];

// 初始化插件
async function initializePlugin() {
  // 设置事件监听
  const selectionHandler = () => handleSelectionChange();
  mg.on('selectionchange', selectionHandler);
  cleanupFunctions.push(() => mg.off('selectionchange', selectionHandler));

  // 加载用户偏好
  const prefs = await mg.clientStorage.getAsync('preferences');
  applyPreferences(prefs);

  // 显示 UI
  mg.showUI(__html__, { width: 400, height: 600 });
}

// 清理资源
function cleanup() {
  cleanupFunctions.forEach(fn => fn());
  cleanupFunctions = [];
}

// 监听关闭事件
mg.on('close', cleanup);

// 运行插件
initializePlugin();
```

## 最佳实践总结

### ✅ 应该做的

1. **总是验证用户输入**：检查选择、类型、数量等
2. **使用类型断言**：在 TypeScript 中使用 `as` 进行类型断言
3. **提供用户反馈**：使用 `mg.notify()` 告知用户操作结果
4. **处理错误**：使用 try-catch 捕获异常
5. **加载字体**：修改文本前总是先加载字体
6. **完全替换属性**：对于复杂对象使用完全替换而非修改
7. **使用撤销点**：合理使用 `mg.commitUndo()` 分组操作
8. **清理资源**：在插件关闭时清理事件监听器等
9. **使用 TypeScript**：提高代码质量和开发体验
10. **编写文档**：为复杂功能添加注释和文档

### ❌ 不应该做的

1. **不要直接修改复杂对象属性**：如 `node.fills[0].color.r = 1`
2. **不要忽略字体缺失检查**：使用 `hasMissingFont` 检查
3. **不要在主线程中发送网络请求**：使用 UI 线程
4. **不要忘记清理事件监听器**：避免内存泄漏
5. **不要假设选择存在**：总是检查 `selection.length`
6. **不要忽略错误处理**：提供友好的错误提示
7. **不要过度遍历节点树**：使用 `findAll` 等内置方法
8. **不要阻塞 UI**：使用异步操作处理耗时任务
9. **不要硬编码值**：使用常量或配置
10. **不要忽略性能**：批量操作、缓存结果
