# ExcaliVibe ⚔️

[English](./README.md) · **中文**

> Excalibur + Vibe —— 像亚瑟王圣剑一样的 **Vibe Working** 圣器。

ExcaliVibe 是一套 **Vibe Working** 能力套件。概念源自 Vibe Coding，但不止于 Coding，而是面向更广的业务场景，把 Agent 打造成更强大的综合体。

项目**同时支持 Claude Code 与 Codex 两个智能体**，能力均以各自的 **marketplace + plugin** 机制承载。同一能力在两侧解决同样的问题、走同样的主流程，只是用各自最契合的原语（command / skill / subagent / hooks / MCP）实现——即下文的「求同存异」。

## 插件一览

| 插件 | 作用 | 详细用法 |
|---|---|---|
| `gen-ai-development` | 生成式 AI 研发工作流套件：核心是**自治控制器**，按「变更原型 × 关键度 × 可逆性」为每个任务定自治档位、组装轨道与人工门禁；SDD（spec 契约）+ TDD 两范式，三层架构（编排 skill + 专人专事 subagent + 独立功能 skill）| [Claude](./claude/plugins/gen-ai-development/README.md) · [Codex](./codex/plugins/gen-ai-development/README.md) |
| `plugin-infra` | 通用基础设施：浏览器自动化（Chrome DevTools / Playwright MCP，Claude 侧含 graceful-browser 决策） | [Claude](./claude/plugins/plugin-infra/README.md) · [Codex](./codex/plugins/plugin-infra/README.md) |
| `opc-workflow` | 一人公司工作流：面向内容 / 运营等非研发场景的能力位（当前暂无技能） | [Claude](./claude/plugins/opc-workflow/README.md) · [Codex](./codex/plugins/opc-workflow/README.md) |

> 每个插件的命令、技能、子代理与具体用法以其自身 README 为准；两侧主流程一致，实现细节按「求同存异」各自最优。

## 从 GitHub 安装

本仓库为公开仓库，两侧 marketplace 清单都放在**仓库根**，因此可以**一条命令直接从 GitHub 拉取安装**，无需先手动 clone。

**前置**

- **Claude Code**：较新版本（含 `plugin marketplace` 支持）。
- **Codex CLI**：v0.117.0+（本文的 GitHub 直装步骤在 v0.137.0 实测通过）。

### Claude Code

```bash
# 1. 添加 marketplace（直接从 GitHub 拉取；固定分支/标签可用 @main、@v1.0）
claude plugin marketplace add yanxuan-lc/excalivibe

# 2. 按需安装插件
claude plugin install gen-ai-development@excalivibe
claude plugin install plugin-infra@excalivibe
claude plugin install opc-workflow@excalivibe

# 之后拉取仓库更新
claude plugin marketplace update excalivibe
```

### Codex（CLI v0.117.0+）

```bash
# 1. 添加 marketplace（owner/repo 简写，或 HTTPS/SSH Git URL；固定 ref 用 --ref main）
codex plugin marketplace add yanxuan-lc/excalivibe

# 2. 按需安装插件；安装后**新开 thread** 让 skills / MCP 生效
codex plugin add gen-ai-development@excalivibe
codex plugin add plugin-infra@excalivibe
codex plugin add opc-workflow@excalivibe
```

`gen-ai-development` 的 **9 个 subagent** 以独立 TOML 提供（Codex 的 plugin 机制无法捆绑 subagent），需单独放入 agents 目录。GitHub 直装时本地没有仓库副本，clone 一份取用即可：

```bash
git clone https://github.com/yanxuan-lc/excalivibe.git
cp excalivibe/codex/agents/*.toml ~/.codex/agents/      # 或放到项目级 .codex/agents/
```

## 本地开发安装

改动插件、需要边改边调时，指向**本地目录**安装（marketplace 清单在仓库根，故 SOURCE 为 `.`）。

**Claude**

```bash
claude plugin marketplace add .                     # 注册本地 marketplace（仓库根）
claude plugin install gen-ai-development@excalivibe # 按需安装
claude plugin marketplace update excalivibe         # 改动后刷新
```

**Codex**

```bash
codex plugin marketplace add .                      # 注册本地 marketplace（仓库根）
codex plugin add gen-ai-development@excalivibe       # 安装；新开 thread 后生效
cp codex/agents/*.toml ~/.codex/agents/              # 安装 subagent
# 迭代：update_plugin_cachebuster.py <plugin> → codex plugin add <plugin>@excalivibe → 新开 thread
```

## 设计原则：求同存异

**架构与主流程两侧一致；实现细节各自最优，不为兼容而折中。** 例如：

| 场景 | Claude 侧 | Codex 侧 | 共同兜底 |
|---|---|---|---|
| 调研 | `deep-research` + dynamic workflow | 常规 subagent | — |
| 浏览器 | `claude --chrome` | computer-use / `@Chrome` | chrome-devtools MCP / Playwright |

## 目录结构

```
excalivibe/
├── .claude-plugin/marketplace.json       # Claude marketplace 清单（仓库根，name: excalivibe）
├── .agents/plugins/marketplace.json      # Codex marketplace 清单（仓库根，name: excalivibe）
├── claude/                               # Claude 侧插件（commands / agents / skills / hooks / .mcp.json）
│   └── plugins/{plugin-infra, gen-ai-development, opc-workflow}/
├── codex/                                # Codex 侧插件（skills / .mcp.json / .app.json）
│   ├── plugins/{plugin-infra, gen-ai-development, opc-workflow}/
│   ├── agents/*.toml                     # 9 个 Codex subagent（独立安装）
│   └── ADAPTING-FROM-CLAUDE.md           # Claude→Codex 求同存异适配手册
├── docs/                                 # 项目文档 MDX 树（tech = 事实标准，research = 历史）
├── openspec/                             # OpenSpec 规范流程产物
├── AGENTS.md                             # 跨 Agent 的项目事实与协作规范
├── CLAUDE.md                             # Claude Code 专属偏好与协作规则
└── README.md
```

> 两侧 marketplace 名均为 `excalivibe`；plugin 的 `source` 相对**仓库根**解析，分别指向 `./claude/plugins/<name>` 与 `./codex/plugins/<name>`。

## 文档（MDX 查看）

项目文档位于 [`docs/`](./docs/),是一棵 **MDX 树**(`.mdx`),按**权威性**分区:[`docs/tech/`](./docs/tech/) 是已落地机制的**事实标准**,[`docs/research/`](./docs/research/) 是**历史**调研。它们面向 `plugin-infra` 的 **mdx-artifact** skill 的富文档阅读器编写——GitHub 上 `.mdx` 只显示源码,想要预期的阅读体验请用下面的预览。

**预览整棵文档树(推荐):**

```bash
SKILL=claude/plugins/plugin-infra/skills/mdx-artifact
npm --prefix $SKILL install                  # 仅首次:安装构建依赖
node $SKILL/scripts/serve.mjs --root docs    # 浏览器打开 docs/ 的可浏览索引
```

预览会列出 `docs/` 下每一篇 `.mdx`;点开任意一篇,文档间的相对链接会在预览内互跳(改文件即热重载)。若只想把某一篇导出成**自包含、可离线**的 HTML 文件:

```bash
node claude/plugins/plugin-infra/skills/mdx-artifact/scripts/render.mjs docs/tech/README.mdx docs-tech.html
```

> 渲染器离线自包含(零外部请求)。写法约定见该 skill 的 [SKILL.md](./claude/plugins/plugin-infra/skills/mdx-artifact/SKILL.md);Codex 侧镜像同一 skill。

## 更多文档

- [docs/](./docs/) —— 项目文档 MDX 树(`tech/` = 事实标准,`research/` = 历史),用上方预览查看。
- [AGENTS.md](./AGENTS.md) —— 跨 Agent 的项目事实、marketplace / plugin 结构规范、校验与新增能力流程。
- [CLAUDE.md](./CLAUDE.md) —— Claude Code 专属的 primitives、Subagent 协作与委派规则。
- [codex/ADAPTING-FROM-CLAUDE.md](./codex/ADAPTING-FROM-CLAUDE.md) —— Claude→Codex 的适配规则。
