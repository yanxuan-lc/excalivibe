# ExcaliVibe ⚔️

> Excalibur + Vibe —— 像亚瑟王圣剑一样的 **Vibe Working** 圣器。

ExcaliVibe 是一套 **Vibe Working** 能力套件。概念源自 Vibe Coding，但不局限于 Coding，而是面向更广的业务场景，把 Agent 打造成更强大的综合体。

项目**同时支持 Claude 与 Codex 两个智能体**，能力均以各自的 **marketplace + plugin** 机制承载。

## 设计原则：求同存异

整体 **workflow / pipeline / architecture 保持一致**；具体细节、能力实现围绕各 Agent 的特点（command / tools / skills / hooks / MCP）**独立设计**，不为兼容而折中。例如：

| 场景 | Claude 侧 | Codex 侧 |
|---|---|---|
| 调研 | `deep_research` + dynamic workflow | 常规 subagent |
| 浏览器 | `claude --chrome` | computer-use / `@Chrome` |
| 浏览器兜底 | chrome-devtools MCP / Playwright | chrome-devtools MCP / Playwright |

## 目录结构

```
excalivibe/
├── claude/                              # Claude 智能体能力（marketplace 机制）
│   ├── .claude-plugin/marketplace.json  # Claude marketplace 清单（name: excalivibe）
│   └── plugins/
│       ├── plugin-infra/                # 通用基础设施：graceful-browser + chrome-devtools MCP
│       ├── gen-ai-development/          # 生成式 AI 开发套件：2 命令 + 7 子代理 + 开发/设计技能（含 app-ux-design）
│       └── opc-workflow/                # 一人公司工作流（非研发场景，当前暂无技能）
│
├── codex/                               # Codex 智能体能力（marketplace 机制，v0.117.0+）
│   ├── .agents/plugins/marketplace.json # Codex marketplace 清单（name: excalivibe）
│   ├── plugins/
│   │   ├── plugin-infra/                # 同上，浏览器第 1 优先级改用 Codex 原生栈
│   │   ├── gen-ai-development/          # 命令→skill、技能内容按 Codex 改写
│   │   └── opc-workflow/                # 同上
│   ├── agents/                          # 7 个 Codex subagent TOML（plugin 无法捆绑，独立安装）
│   └── ADAPTING-FROM-CLAUDE.md          # Claude→Codex 求同存异适配手册
│
├── AGENTS.md / CLAUDE.md
└── README.md
```

> 两侧的 marketplace 名均为 `excalivibe`；`source.path` 都写作 `./plugins/<name>`，
> 分别相对各自 scaffold 根目录（`claude/`、`codex/`）解析。

## 本地安装与调试

两侧 marketplace 均支持**指向本地目录**安装，便于开发期调试。

### Claude

```bash
# 1. 注册本地 marketplace（directory source）
claude plugin marketplace add ./claude

# 2. 安装插件（按需）
claude plugin install plugin-infra@excalivibe
claude plugin install gen-ai-development@excalivibe
claude plugin install opc-workflow@excalivibe
```

迭代时改动 plugin 后，刷新 marketplace 即可：`claude plugin marketplace update excalivibe`。

### Codex（CLI v0.117.0+）

```bash
# 1. 注册本地 marketplace（repo/team marketplace 需显式 add）
codex plugin marketplace add ./codex

# 2. 安装插件（按需）；新开 thread 后 skills / MCP 生效
codex plugin add plugin-infra@excalivibe
codex plugin add gen-ai-development@excalivibe
codex plugin add opc-workflow@excalivibe

# 3. 安装 gen-ai-development 的 7 个 subagent（plugin 无法捆绑，文件级安装）
cp codex/agents/*.toml ~/.codex/agents/        # 或项目级 .codex/agents/
```

> 开发期更新本地 plugin：用 cachebuster + 重装流程
> （`update_plugin_cachebuster.py <plugin>` → `codex plugin add <plugin>@excalivibe`），
> 然后**新开 thread** 让 Codex 重新加载 skills / tools。

## 插件清单

| 插件 | Claude 侧 | Codex 侧（求同存异） |
|---|---|---|
| `plugin-infra` | graceful-browser skill + chrome-devtools MCP | 浏览器第 1 优先级改用 Codex 原生栈（`@Chrome`/`@Browser`），MCP 兜底两侧共用 |
| `gen-ai-development` | 2 命令 + 7 子代理 + 开发/设计技能（含 app-ux-design，依赖 ui-ux-pro-max） | 命令→skill；子代理→`codex/agents/*.toml`；技能仅改写 Agent 专属机制引用；app-ux-design 框架代码原样移植、inspect 反馈环走 Codex Browser Annotation |
| `opc-workflow` | 暂无技能 | 暂无技能 |

> Claude→Codex 的适配规则见 [`codex/ADAPTING-FROM-CLAUDE.md`](./codex/ADAPTING-FROM-CLAUDE.md)。
