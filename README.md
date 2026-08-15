# MasterGo Skills

MasterGo 官方 skills 集合仓库，存放 MasterGo 生态的各个 Claude Code / Agent skill。

> 原名 `plugin-develop-skill`，2026-08 重命名为 `mastergo-skills`，并按 skill 目录拆分，
> 以便后续独立迭代维护各个 skill。

## Skills 列表

| Skill | 目录 | 说明 |
|-------|------|------|
| [plugin-develop](./skills/plugin-develop) | `skills/plugin-develop/` | MasterGo 插件开发与 API 维护（插件开发 + API 变更同步） |
| [dsl-to-code](./skills/dsl-to-code) | `skills/dsl-to-code/` | 设计 DSL 获取 + DSL → html/vue/react/flutter 代码转换 |

## 安装

### 方式一：通过 LLM 对话一键安装（推荐）

将以下提示词发送给任意支持 skill 安装的 LLM 工具（如 Claude Code、Cursor 等），即可自动完成安装：

```text
安装 skill: git@github.com:mastergo-design/mastergo-skills.git
```

也可以更详细地提要求（以 plugin-develop 为例）：

```text
请帮我安装 MasterGo 插件开发 skill：
1. 执行命令: git clone git@github.com:mastergo-design/mastergo-skills.git ~/.claude/skills/mastergo-skills
2. 将 ~/.claude/skills/mastergo-skills/skills/plugin-develop 复制（或软链）到 ~/.claude/skills/plugin-develop
3. 确认 ~/.claude/skills/plugin-develop/SKILL.md 文件存在且 frontmatter 中包含 name: mastergo-plugin-develop
4. 安装完成后告诉我已就绪
```

### 方式二：Claude Code 用户手动安装

```bash
mkdir -p ~/.claude/skills
git clone git@github.com:mastergo-design/mastergo-skills.git ~/.claude/skills/mastergo-skills
ln -s ~/.claude/skills/mastergo-skills/skills/plugin-develop ~/.claude/skills/plugin-develop
ln -s ~/.claude/skills/mastergo-skills/skills/dsl-to-code ~/.claude/skills/dsl-to-code
```

### 方式三：Claude Agent SDK 安装

```bash
git clone git@github.com:mastergo-design/mastergo-skills.git ./skills/mastergo-skills
```

```typescript
// 示例：在 Agent SDK 中注册 skill
import { Agent } from "@anthropic-ai/sdk";

const agent = new Agent({
  model: "claude-sonnet-4-5-20250901",
  skills: [
    {
      name: "mastergo-plugin-develop",
      path: "./skills/mastergo-skills/skills/plugin-develop",
      description: "MasterGo 插件开发与 API 维护",
      triggers: ["mastergo 插件", "mg.createFrame", "flexMode", "devmode"],
    },
    {
      name: "mastergo-dsl-to-code",
      path: "./skills/mastergo-skills/skills/dsl-to-code",
      description: "MasterGo 设计 DSL 获取与代码转换",
      triggers: ["mastergo dsl", "dsl to code", "设计转代码"],
    },
  ],
});
```

### 方式四：手动注册（任意 AI 工具）

将对应 skill 目录下 `SKILL.md` 的 **frontmatter**（`---` 之间的 name / description）和完整内容注入到
AI 工具的 system prompt 或 skill 配置中即可。

## 目录结构

```
.
├── .version               # 仓库版本号
├── CHANGELOG.md           # 变更记录
├── README.md              # 本文件
└── skills/                # 各 skill 独立目录
    ├── plugin-develop/    # MasterGo 插件开发与 API 维护
    │   ├── SKILL.md
    │   ├── assets/        # main.ts / manifest.json / ui.html 模板
    │   └── references/    # api-quick-reference / common-patterns / development-guide / node-types
    └── dsl-to-code/       # 设计 DSL 获取 + DSL → 代码转换
        ├── SKILL.md
        ├── references/    # page-batch-export（整页枚举与批量导出）
        └── scripts/       # mcp-batch-fetch.mjs（整页枚举 + 批量拉 DSL）
```

## 版本

当前版本见 `.version` 文件。变更记录见 [CHANGELOG.md](./CHANGELOG.md)。

## License

MIT
