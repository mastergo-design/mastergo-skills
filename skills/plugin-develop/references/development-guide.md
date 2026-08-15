# MasterGo 插件开发指南

## 插件架构

MasterGo 插件采用双线程架构：

### 主线程（Main Thread）
- 运行在沙箱环境中
- 可以访问 MasterGo 插件 API
- 无法访问浏览器 API（如 XMLHttpRequest）
- 用于操作文档节点和调用 MasterGo 功能

### UI 线程（UI Thread）
- 运行在 `<iframe>` 中
- 可以访问所有浏览器 API
- 无法直接访问 MasterGo API
- 用于构建用户界面和发送网络请求

### 消息通信

两个线程通过 `postMessage` 进行通信：

```typescript
// 主线程 → UI
mg.ui.postMessage({ type: 'data', payload: '...' });

// UI → 主线程
parent.postMessage({ type: 'action', data: '...' }, '*');
```

## 创建新插件

### 1. 目录结构

最小插件结构：
```
my-plugin/
├── manifest.json
├── main.js
└── ui.html
```

### 2. manifest.json

```json
{
  "name": "my-plugin",
  "api": "1.0.0",
  "main": "./main.js",
  "ui": "./ui.html",
  "menu": [
    {
      "name": "打开主页面",
      "command": "home"
    },
    {
      "name": "执行功能",
      "command": "run"
    }
  ],
  "permissions": ["currentuser"]
}
```

**字段说明**：
- `name`: 插件名称（显示在菜单中）
- `api`: API 版本（当前为 "1.0.0"）
- `main`: 主线程脚本路径
- `ui`: UI 界面 HTML 路径
- `menu`: 菜单项配置（可选）
- `permissions`: 权限配置（可选）

### 3. main.js

```javascript
// 显示 UI
mg.showUI(__html__);

// 监听 UI 消息
mg.ui.onmessage = (msg) => {
  console.log('收到消息:', msg);

  if (msg.type === 'create-ellipse') {
    // 创建椭圆
    const ellipse = mg.createEllipse();
    ellipse.x = 100;
    ellipse.y = 100;
  }
};
```

### 4. ui.html

```html
<!DOCTYPE html>
<body>
  <button id="btn">创建椭圆</button>

  <script>
    const btn = document.getElementById('btn');

    btn.addEventListener('click', () => {
      // 发送消息到主线程
      parent.postMessage({
        type: 'create-ellipse'
      }, '*');
    });

    // 监听主线程消息
    window.onmessage = (event) => {
      console.log('收到主线程消息:', event.data);
    };
  </script>
</body>
```

## 开发流程

### 1. 安装依赖（如使用 TypeScript 或框架）

```bash
# 使用 yarn
yarn install

# 或使用 npm
npm install
```

### 2. 开发调试

1. 在 MasterGo 客户端中：**插件 → 开发者模式 → 创建/添加插件**
2. 选择插件的 `manifest.json` 文件
3. 在 **开发中** 面板找到插件并点击运行
4. 使用快捷键 `Ctrl+Alt+P` (Windows) 或 `Cmd+Option+P` (Mac) 快速运行最近一次插件

### 3. 构建（如使用 TypeScript）

```bash
yarn build
# 或
npm run build
```

### 4. 发布插件

在 MasterGo 客户端中：
1. **插件 → 管理插件**
2. 在 **开发中** 面板找到插件
3. 点击 **发布** 按钮
4. 选择发布到团队或社区
5. 填写插件信息并发布

## 使用模板

### HTML 模板

最简单的开发方式，适合小型插件。

### Vue 模板

```bash
# 创建时选择 Vue 模板
# 开发流程：
1. yarn install
2. 编写代码（ui/App.vue 和 lib/main.ts）
3. yarn build
```

**ui/App.vue**：
```vue
<template>
  <div>
    <input type="number" v-model="count" />
    <button @click="create">创建</button>
  </div>
</template>

<script>
export default {
  data() {
    return { count: 0 };
  },
  methods: {
    create() {
      parent.postMessage({ count: this.count }, '*');
    }
  }
};
</script>
```

**lib/main.ts**：
```typescript
mg.showUI(__html__);

mg.ui.onmessage = (msg) => {
  for (let i = 0; i < msg.count; i++) {
    mg.createEllipse();
  }
};
```

### React 模板

```bash
# 创建时选择 React 模板
# 开发流程：
1. yarn install
2. 编写代码（ui/App.tsx 和 lib/main.ts）
3. yarn build
```

**ui/App.tsx**：
```tsx
import { useState, useCallback } from 'react';

function App() {
  const [count, setCount] = useState(0);

  const create = () => {
    parent.postMessage({ count }, '*');
  };

  return (
    <div>
      <input
        type="number"
        value={count}
        onChange={(e) => setCount(parseInt(e.target.value))}
      />
      <button onClick={create}>创建</button>
    </div>
  );
}

export default App;
```

## TypeScript 支持

### 安装类型定义

```bash
yarn add @mastergo/plugin-typings
# 或
npm install @mastergo/plugin-typings
```

### 配置 tsconfig.json

```json
{
  "compilerOptions": {
    "types": ["@mastergo/plugin-typings"]
  }
}
```

### 类型声明示例

```typescript
// 获取当前选中的矩形节点
const node = mg.document.currentPage.selection[0] as RectangleNode;

// 设置矩形属性
node.cornerRadius = 10;
node.fills = [{
  type: 'SOLID',
  color: { r: 1, g: 0, b: 0, a: 1 }
}];
```

## 常见开发模式

### 1. 访问当前选择

```typescript
const currentPage = mg.document.currentPage;
const selectedNodes = currentPage.selection;

// 处理选中的节点
selectedNodes.forEach((node) => {
  console.log(node.name, node.type);
});
```

### 2. 查找节点

```typescript
// 查找所有文本节点
const texts = currentPage.findAll((node) => {
  return node.type === 'TEXT';
});

// 查找第一个矩形节点
const rect = currentPage.findOne((node) => {
  return node.type === 'RECTANGLE';
});
```

### 3. 修改节点属性

```typescript
const node = mg.document.currentPage.selection[0];

// ✅ 正确：完全替换复杂属性
const newFills = JSON.parse(JSON.stringify(node.fills));
newFills[0].color.r = 1;
node.fills = newFills;

// ❌ 错误：直接修改内部属性
node.fills[0].color.r = 1;
```

### 4. 文本处理

```typescript
const textNode = mg.document.currentPage.selection[0] as TextNode;

// 检查字体是否缺失
if (textNode.hasMissingFont) {
  mg.notify('字体缺失，无法编辑', { type: 'error' });
  return;
}

// 加载字体
await mg.loadFontAsync(textNode.textStyles[0].textStyle.fontName);

// 修改文本内容
textNode.characters = '新的文本内容';
```

### 5. 图片处理

```typescript
// 创建图片填充
const imageData = new Uint8Array([...]); // PNG/JPEG 数据
const imageHandle = await mg.createImage(imageData);

node.fills = [{
  type: 'IMAGE',
  scaleMode: 'FILL',
  imageRef: imageHandle.href
}];
```

### 6. 网络请求

**main.js**：
```javascript
mg.showUI(__html__, { visible: false });

mg.ui.onmessage = async (msg) => {
  if (msg.type === 'fetch-complete') {
    const text = mg.createText();
    text.x = mg.viewport.center.x;
    text.y = mg.viewport.center.y;

    await mg.loadFontAsync(text.textStyles[0].textStyle.fontName);
    text.characters = msg.data;
    mg.closePlugin();
  }
};
```

**ui.html**：
```html
<script>
window.onmessage = async () => {
  const response = await fetch('https://api.example.com/data');
  const data = await response.json();

  parent.postMessage({
    type: 'fetch-complete',
    data: JSON.stringify(data)
  }, '*');
};
</script>
```

### 7. 本地存储

```typescript
// 保存用户偏好
await mg.clientStorage.setAsync('preferences', {
  theme: 'dark',
  fontSize: 14
});

// 读取用户偏好
const prefs = await mg.clientStorage.getAsync('preferences');
console.log(prefs);

// 列出所有键
const keys = await mg.clientStorage.keysAsync();

// 删除数据
await mg.clientStorage.deleteAsync('preferences');
```

### 8. 事件监听

```typescript
// 监听选择变化
mg.on('selectionchange', (selection) => {
  console.log('选择已变化:', selection);
});

// 监听页面切换
mg.on('currentpagechange', (pageId) => {
  console.log('切换到页面:', pageId);
});

// 监听插件关闭
mg.on('close', () => {
  console.log('插件即将关闭');
  // 清理资源
});

// 移除事件监听
mg.off('selectionchange');
```

### 9. 撤销历史

```typescript
// 创建第一个矩形
mg.createRectangle();
mg.commitUndo();  // 提交撤销点

// 创建第二个矩形
mg.createRectangle();

// 执行撤销只会撤销第二个矩形
mg.triggerUndo();
```

## 调试技巧

### 1. 使用 console.log

```typescript
console.log('当前选择:', mg.document.currentPage.selection);
console.log('节点类型:', node.type);
console.log('节点属性:', node.fills);
```

### 2. 打开开发者工具

在 MasterGo 客户端中：
1. 运行插件
2. 点击插件 UI 窗口
3. 使用快捷键打开开发者工具（视浏览器而定）

### 3. 使用通知

```typescript
mg.notify('调试信息', { type: 'normal' });
mg.notify('错误信息', { type: 'error' });
```

## 常见问题

### Q: 为什么我的代码无法访问浏览器 API？

A: 主线程代码运行在沙箱中，无法访问浏览器 API。需要通过 UI 线程发送网络请求等操作。

### Q: 为什么修改属性后没有效果？

A: 复杂对象属性（如 `fills`、`strokes`）需要完全替换，不能直接修改内部属性。

### Q: 为什么修改文本内容时报错？

A: 修改文本内容前需要先加载字体，使用 `mg.loadFontAsync()`。

### Q: 为什么我的插件无法加载资源？

A: 检查 CORS 策略，确保资源服务器允许跨域访问。同时确保使用 HTTPS 协议。

### Q: 如何调试插件？

A: 使用 `console.log` 输出调试信息，使用 `mg.notify()` 显示通知，打开浏览器开发者工具查看错误。

### Q: 插件无法启动，显示 manifest 错误？

A: 检查 manifest.json 格式是否正确。特别注意：
- `permissions` 必须是数组格式（如 `["currentuser"]`），不要使用对象格式
- 不要使用 Figma 的 `networkAccess` 字段
- 确保所有必需字段（name、api、main、ui）都存在且值正确

## 性能优化

### 1. 减少节点遍历

```typescript
// ❌ 慢：多次遍历
const rects = page.findAll(n => n.type === 'RECTANGLE');
const texts = page.findAll(n => n.type === 'TEXT');

// ✅ 快：一次遍历
const nodes = page.findAll(n =>
  n.type === 'RECTANGLE' || n.type === 'TEXT'
);
const rects = nodes.filter(n => n.type === 'RECTANGLE');
const texts = nodes.filter(n => n.type === 'TEXT');
```

### 2. 批量操作

```typescript
// ❌ 慢：逐个提交撤销
nodes.forEach(node => {
  node.x += 10;
  mg.commitUndo();
});

// ✅ 快：批量操作后提交
nodes.forEach(node => {
  node.x += 10;
});
mg.commitUndo();
```

### 3. 延迟加载

```typescript
// 只在需要时加载文档
mg.ui.onmessage = async (msg) => {
  if (msg.type === 'load-docs') {
    const docs = await fetchDocumentation();
    mg.ui.postMessage({ docs });
  }
};
```
