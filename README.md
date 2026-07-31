# MasterGo Plugin Develop Skill

MasterGo 插件开发与 API 维护的 Claude Code skill，基于 [MasterGo 官方插件文档](https://develop-mastergo.pages.lanhuapp.com/) 编写。

## 安装

### 方式一：wind-skills 已安装（推荐）

如果你已安装 [wind-skills](https://github.com/muzi131313/wind-skills)，本 skill 已内置其中，无需额外安装。

### 方式二：独立安装

```bash
# 1. Clone 到 Claude Code skills 目录
mkdir -p ~/.claude/skills
git clone git@github.com:mastergo-design/plugin-develop-skill.git ~/.claude/skills/mastergo-plugin

# 2. 安装参考文档（按需）
mkdir -p ~/.claude/skills/mastergo-plugin/references
cp ~/.claude/skills/mastergo-plugin/references/*.md ~/.claude/skills/mastergo-plugin/references/
```

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
└── references/            # 参考文档
    ├── api-quick-reference.md
    ├── common-patterns.md
    ├── development-guide.md
    └── node-types.md
```

## License

MIT
