# MasterGo Plugin Develop Skill

MasterGo 插件开发与 API 维护的 Claude Code skill，基于 [MasterGo 官方插件文档]([https://develop-mastergo.pages.lanhuapp.com/](https://developers.mastergo.com/)) 编写。

## 安装

### 方式一：通过 LLM 对话一键安装（推荐）

将以下提示词发送给任意支持 skill 安装的 LLM 工具（如 Claude Code、Cursor 等），即可自动完成安装：

```text
安装 skill: git@github.com:mastergo-design/plugin-develop-skill.git
```

也可以更详细地提要求：

```text
请帮我安装 MasterGo 插件开发 skill：
1. 执行命令: mkdir -p ~/.claude/skills && git clone git@github.com:mastergo-design/plugin-develop-skill.git ~/.claude/skills/mastergo-plugin
2. 确认 ~/.claude/skills/mastergo-plugin/SKILL.md 文件存在且 frontmatter 中包含 name: mastergo-plugin
3. 安装完成后告诉我已就绪
```

### 方式二：Claude Code 用户手动安装

```bash
mkdir -p ~/.claude/skills
git clone git@github.com:mastergo-design/plugin-develop-skill.git ~/.claude/skills/mastergo-plugin
```

### 方式三：Claude Agent SDK 安装

```bash
git clone git@github.com:mastergo-design/plugin-develop-skill.git ./skills/mastergo-plugin
```

```typescript
// 示例：在 Agent SDK 中注册 skill
import { Agent } from "@anthropic-ai/sdk";

const agent = new Agent({
  model: "claude-sonnet-4-5-20250901",
  skills: [
    {
      name: "mastergo-plugin",
      path: "./skills/mastergo-plugin",
      description: "MasterGo 插件开发与 API 维护",
      triggers: ["mastergo 插件", "mg.createFrame", "flexMode", "devmode"],
    },
  ],
});
```

### 方式四：手动注册（任意 AI 工具）

将 `SKILL.md` 的 **frontmatter**（`---` 之间的 name / description）和完整内容注入到 AI 工具的 system prompt 或 skill 配置中即可。

安装后在对话中提到"MasterGo 插件开发"、"mg.createFrame"、"flexMode"、"devmode 代码生成" 等关键词即可自动触发。

## 覆盖内容

| 模块 | 说明 |
|------|------|
| **插件开发指南** | 双线程架构、节点类型、mg 全局 API 命名空间树、自动布局 (flexMode) |
| **核心 API 示例** | 节点创建、自动布局、文本操作、样式管理、组件系统、团队库、UI 通信、客户端存储、通知、特效、视口控制、字体与图片 |
| **mg.variables** | 设计变量系统：集合/模式/变量 CRUD、跨类型绑定、图层属性绑定、组件属性变量、作用域、代码语法、分组管理 |
| **mg.WebSocket** | 插件主线程 WebSocket 通信 |
| **原型交互** | Reaction / Trigger / Action / Transition / Easing 类型体系 |
| **DevMode** | 设计转代码：mg.codegen API、DSL 数据结构、组件模板 |
| **整页批量导出** | 纯 token 免插件：page-layers 整页画板枚举、批量拉 DSL、allTexts 文本白名单、MCP REST 接口清单 |
| **API 变更同步** | plugin-typings → docs → E2E 四阶段跨仓库更新流程 |
| **模板 & 参考** | main.ts / manifest.json / ui.html 模板 |

## 版本

当前版本见 `.version` 文件。变更记录见 [CHANGELOG.md](./CHANGELOG.md)。

## 目录结构

```
.
├── SKILL.md               # 主 skill 文件
├── .version               # 版本号
├── CHANGELOG.md           # 变更记录
├── README.md              # 本文件
├── assets/                # 模板文件
│   ├── main.ts.template
│   ├── manifest.json.template
│   └── ui.html.template
├── references/            # 参考文档
│   ├── api-quick-reference.md
│   ├── common-patterns.md
│   ├── development-guide.md
│   ├── node-types.md
│   └── page-batch-export.md
└── scripts/               # 工具脚本
    └── mcp-batch-fetch.mjs   # 整页枚举 + 批量拉 DSL（纯 token）
```

## License

MIT
