# AGENTS.md — ExcaliVibe

面向所有 Agent（Claude Code / Codex / Cursor / Gemini / Aider 等）的项目事实与协作规范。Claude Code 专属偏好见 [CLAUDE.md](./CLAUDE.md)。

## 项目简介

**ExcaliVibe**（Excalibur + Vibe）是一套 **Vibe Working** 能力套件。概念源自 Vibe Coding，但不局限于 Coding，而是面向更广的业务场景，把 Agent 打造成更强大的综合体。项目**同时支持 Claude 与 Codex 两个智能体**，能力均以各自的 **marketplace + plugin** 机制承载。

## 核心原则：求同存异（所有迭代必须遵循）

> **架构与主流程保持一致；实现细节针对各 Agent 个性化优化与适配。**

这是本项目**最高优先级的约束**，适用于后续每一个需求、每一次迭代改进：

- **求同**：整体 workflow / pipeline / architecture 在 Claude 与 Codex 两侧**必须一致** —— 同一个能力在两侧解决同样的问题、走同样的主流程、对用户呈现一致的心智模型。
- **存异**：具体实现细节、能力使用方式围绕各 Agent 的特点（command / tools / skills / hooks / MCP 等）**独立设计，不为兼容而折中**。

示例（同一能力，主流程一致、实现各异）：

| 场景 | Claude 侧 | Codex 侧 | 共同兜底 |
|---|---|---|---|
| 调研 | `deep-research` + dynamic workflow | 常规 subagent | — |
| 浏览器 | `claude --chrome` | computer-use / `@Chrome` | chrome-devtools MCP / Playwright |

**新增/修改能力的硬性要求**：任何改动要么同时落到 `claude/` 与 `codex/` 两侧并保持主流程一致，要么显式说明为何只动一侧；严禁因迁就某一 Agent 的能力短板而把两侧都拉平到折中方案。

## 项目性质与技术栈

这是一个**能力内容仓库**，而非传统应用：产物是 marketplace 清单（JSON）+ plugin（Markdown 形式的 skills / commands + JSON manifest），不包含可编译的应用代码，因此**没有 build / 启动脚本**。

- 语言/格式：JSON（manifest）、Markdown（SKILL.md / command）、Shell（plugin 内脚本，如需要）
- 规范方法：仓库内置 **OpenSpec**（`openspec/`）+ `opsx:*` 命令，承载较大需求的结构化流程

## 目录结构

```
excalivibe/
├── claude/                              # Claude 智能体能力（marketplace 机制）
│   ├── .claude-plugin/marketplace.json  # Claude marketplace 清单（name: excalivibe）
│   └── plugins/<plugin>/
│       ├── .claude-plugin/plugin.json
│       ├── commands/  agents/  skills/  hooks/  .mcp.json   # Claude 可用 primitives
│       └── ...
├── codex/                               # Codex 智能体能力（marketplace 机制，v0.117.0+）
│   ├── .agents/plugins/marketplace.json # Codex marketplace 清单（name: excalivibe）
│   └── plugins/<plugin>/
│       ├── .codex-plugin/plugin.json
│       └── skills/  .mcp.json  .app.json                     # Codex 可用 primitives
├── openspec/                            # OpenSpec 规范流程产物（specs / changes）
├── README.md
└── AGENTS.md / CLAUDE.md
```

> 两侧 marketplace 名均为 `excalivibe`，`source.path` 都写作 `./plugins/<name>`，分别相对各自 scaffold 根目录（`claude/`、`codex/`）解析。

## 两侧 marketplace / plugin 结构规范

| | **Claude** | **Codex**（CLI v0.117.0+） |
|---|---|---|
| Marketplace 清单 | `claude/.claude-plugin/marketplace.json`（`name`/`owner`/`plugins[].source` 为字符串路径） | `codex/.agents/plugins/marketplace.json`（`name`/`interface`/`plugins[]` 含 `source.path`/`policy`/`category`） |
| Plugin 清单 | `<plugin>/.claude-plugin/plugin.json`（`name`/`version`/`description`/`author`/`keywords`） | `<plugin>/.codex-plugin/plugin.json`（**JSON**；必填 `name`/`version`(semver)/`description`/`author.name` + `interface`，`interface` 必含 `displayName`/`capabilities`/`defaultPrompt`） |
| 承载单元 | `commands/` `agents/` `skills/` `hooks/` `.mcp.json` | `skills/` `.mcp.json` `.app.json` |

**约定**：

- plugin 名 **kebab-case**，外层文件夹名 = manifest `name`，两侧同名同概念。
- `version` 用严格 semver（如 `0.1.0`）。
- Codex 的 `plugin.json` **不要写 `hooks` 字段**（validator 拒绝）；Codex 运行时本身具备 hooks 能力（`config.toml` 途径），但非交互式 exec 下触发未经验证（trust-gated）；`mcpServers` / `apps` 仅在 `.mcp.json` / `.app.json` 实际存在时才声明；路径以 `./` 开头。
- skill 的 `SKILL.md` frontmatter 必含 `name` + `description`。

## 本地安装与调试

两侧均支持指向**本地目录**安装，便于开发期调试。

**Claude**
```bash
claude plugin marketplace add ./claude          # 注册本地 marketplace（directory source）
claude plugin install <plugin>@excalivibe        # 安装
claude plugin marketplace update excalivibe      # 迭代后刷新
```

**Codex（CLI v0.117.0+）**
```bash
codex plugin marketplace add ./codex             # repo/team marketplace 需显式 add
codex plugin add <plugin>@excalivibe             # 安装；新开 thread 后 skills 生效
# 迭代：update_plugin_cachebuster.py → codex plugin add <plugin>@excalivibe → 新开 thread
```

## 校验

- **Codex plugin**：`python3 ~/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py <plugin-path>`（依赖 `pyyaml`；建议在临时 venv 中运行）。
- **JSON manifest**：保证为合法 JSON（任意 `jq . <file>` 可解析）。

## 新增一个能力的标准流程

1. 在两侧确定**一致的主流程**与用户心智模型（求同）。
2. 分别在 `claude/plugins/<name>/` 与 `codex/plugins/<name>/` 实现，使用各 Agent 最契合的 primitives（存异）。
3. 在两侧 marketplace 清单的 `plugins[]` 追加条目（追加，不随意重排）。
4. 校验 manifest；本地安装冒烟。
5. 涉及**可运行产品代码**的较大需求走 OpenSpec（`opsx:*`）流程；**改 skill / agent / command / prompt / 文档本身不算研发，不走 OpenSpec**——以 `skill-creator` 为权威轨道，配合上面的双端同步与校验步骤即可（文件数多或「双端都要动」不构成走流程的理由）。

## Git 约定

- 单一 git 仓库，`claude/` 与 `codex/` 为子目录（非 submodule）。
- 由人工审阅后再提交，**Agent 不自动 commit**。

## 术语表

- **Vibe Working**：源自 Vibe Coding，泛化到非 Coding 业务场景的「凭感觉协作完成工作」的能力主张。
- **求同存异**：本项目的双端设计原则，见上文。
- **scaffold 根目录**：`claude/` 或 `codex/`，marketplace 路径解析的基准。
