# MasterGo Skills

MasterGo 官方 skills 集合仓库，存放 MasterGo 生态的各个 Claude Code / Agent skill。

> 原名 `plugin-develop-skill`，2026-08 重命名为 `mastergo-skills`，并按 skill 目录拆分，
> 以便后续独立迭代维护各个 skill。

## Skills 列表

| Skill | 目录 | 说明 |
|-------|------|------|
| [plugin-develop](./skills/plugin-develop) | `skills/plugin-develop/` | MasterGo 插件开发（公开插件 API 参考与开发指南） |
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

## 公开仓库内容边界（脱敏清单）

本仓库是**公开仓库**。skill 内容通常先在内部环境沉淀，再反向同步到这里；同步时容易把
「只对内部维护者有效、但对外部使用者无意义」的信息一起带进来。请在提交前对照下表自查。

**可以保留（面向 skill 使用者）**
- 公开 API 的名称、参数、返回值、枚举值、用法示例
- 公开的 API 行为结论与已知限制（例如「某属性只读」「某能力未暴露」）
- 指向 `mastergo.com` 等公开站点的文档 / 控制台地址

**必须移除或改写（只对内部有效）**
| 类别 | 示例形态 | 处理方式 |
|------|----------|----------|
| 本机绝对路径 | `/Users/<name>/...`、`/home/<name>/...`、`C:\Users\...` | 改为通用占位路径或 `~/...` | <!-- sanitize:allow -->
| 个人代码目录惯例 | `~/code/<org>/<repo>` | 改为通用路径说明 | <!-- sanitize:allow -->
| 内部源码定位 | `foo/bar.ts:120`、内部包路径 | 只保留 API 层结论，内部定位移回内部 skill | <!-- sanitize:allow -->
| 内部系统 / 仓库 | 内部 GitLab 组路径、内部服务名、内部文档库 ID | 删除或改为中性描述 |
| 内部协作人 | 真实姓名、内部账号 | 改为角色名（如「插件审核管理员」） |
| 公司邮箱 / 内部域名 | `@company.com` 等 | 删除 |

> 内部特有的具体用词（内部仓库名、内部人名、内部域名等）**不要写进本仓库的任何文件**，
> 包括这条规则本身。把它们维护在一个**不提交**的本地清单里（见下），本地跑检查时引用。

### 同步策略：`plugin-develop` 只允许插件 API 内容

`skills/plugin-develop` 是**插件 API skill**，只承载面向插件开发者的公开 API 内容。
从内部环境反向同步时，**非插件 API 的内容一律禁止进入本仓库**——这类内容对外部使用者
无意义，且天然带着内部系统、流程与人员信息。

**允许清单**（白名单，新增文件必须先在门禁脚本中登记）

| 路径 | 内容 |
|------|------|
| `skills/plugin-develop/SKILL.md` | 插件开发指南 + mg API 用法 |
| `references/api-quick-reference.md` | API 速查 |
| `references/node-types.md` | 节点类型 |
| `references/common-patterns.md` | 常用模式 |
| `references/development-guide.md` | 开发指南 |
| `assets/*.template` | main.ts / manifest.json / ui.html 模板 |

**禁止清单**（出现即门禁失败）
- 内部跨仓库发布 / 维护流程：类型包发布、文档站更新、E2E 单测等阶段步骤
- 插件审核、上线验证工作流，以及配套脚本（审核 / 列举 / 详情 / 扫描 / 线上运行）
- 内部环境变量、内部项目路径、内部系统名、内部人员（见上表）

> 判断标准只有一条：**「外部插件开发者会不会需要这段内容」**。答「不会」就不许同步。

### 本地自查

仓库自带门禁脚本（脱敏 + 内容边界两道），CI 会在每个 PR 上运行它：

```bash
scripts/check-public-sanitize.sh          # 通用模式（CI 使用）
SANITIZE_EXTRA_PATTERNS=scripts/.sanitize-local.txt scripts/check-public-sanitize.sh   # 叠加内部专有词
```

`scripts/.sanitize-local.txt` 已在 `.gitignore` 中，按行写内部专有词（`#` 开头为注释），
例如内部仓库名、内部人名、内部域名、公司邮箱等。**未设置环境变量时会自动加载该文件**；
文件不存在时词表检查被跳过并给出醒目提示——反向同步前务必确认词表在位（正本另存于内部
私有仓库，避免单机丢失）。

若某处**故意**需要展示「不该出现的形态」作为示例（本例即如此），在该行末尾加标记
`sanitize:allow`（推荐用 HTML 注释 `<!-- sanitize:allow -->` 承载，渲染时不可见），该行会被跳过。

## 版本

当前版本见 `.version` 文件。变更记录见 [CHANGELOG.md](./CHANGELOG.md)。

## License

MIT
