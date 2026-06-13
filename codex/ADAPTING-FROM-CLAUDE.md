# 从 Claude 插件适配到 Codex —— 求同存异映射手册

本手册定义 ExcaliVibe 把一个 **Claude plugin** 适配为 **Codex plugin** 的标准规则。原则：**主流程/架构求同，实现细节按 Codex 能力存异**。`plugin-infra` 是已落地的范例，照它做。

## 0. 适配前提

- Codex CLI v0.117.0+ 原生支持 plugin + marketplace。
- 校验器：`python3 ~/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py <plugin-path>`（需 pyyaml）。每个 plugin 适配后必须通过。

## 1. 目录与清单映射

| Claude | Codex | 说明 |
|---|---|---|
| `plugins/<p>/.claude-plugin/plugin.json` | `plugins/<p>/.codex-plugin/plugin.json` | JSON；**必须**补 `interface` 块 |
| `plugins/<p>/skills/<s>/` | `plugins/<p>/skills/<s>/` | 结构原样保留；仅按 §3 改写内容 |
| `plugins/<p>/commands/<c>.md` | `plugins/<p>/skills/<c>/SKILL.md` | Codex plugin **无 commands**，命令转为 skill（见 §4） |
| `plugins/<p>/agents/<a>.md` | `codex/agents/<a>.toml` | plugin **不能**捆绑 subagent，转为独立 TOML（见 §5） |
| `plugins/<p>/.mcp.json` | `plugins/<p>/.mcp.json` | 格式相同（`{"mcpServers": {...}}`），`${CLAUDE_PLUGIN_ROOT}` 保留（Codex 也注入） |
| `plugins/<p>/hooks/` | 暂不迁移 | manifest 拒绝 `hooks` 字段 |
| `plugins/<p>/README.md`, `package.json` | 原样保留并按需改 install 段 | — |

### plugin.json 模板（Codex）

```json
{
  "name": "<plugin-name>",
  "version": "<semver，沿用源版本>",
  "description": "<沿用源描述>",
  "author": { "name": "ExcaliVibe Contributors" },
  "license": "MIT",
  "keywords": ["...", "excalivibe"],
  "skills": "./skills/",
  "interface": {
    "displayName": "<人类可读名>",
    "shortDescription": "<一句话副标题>",
    "longDescription": "<详情描述>",
    "developerName": "ExcaliVibe Contributors",
    "category": "Developer Tools",
    "capabilities": ["Interactive"],
    "defaultPrompt": ["<一句 ≤50 字的启动提示>"]
  }
}
```

要点：`interface` 必含 `displayName` / `shortDescription` / `capabilities`(string 数组) / `defaultPrompt`(≤3 条、每条 ≤128 字)。仅当 `.mcp.json` / `.app.json` 真实存在时才在 manifest 写 `mcpServers` / `apps`。**不要**写 `hooks` 字段。

## 2. marketplace 清单

`codex/.agents/plugins/marketplace.json`，`name: "excalivibe"`，每个 plugin 一个条目：

```json
{
  "name": "<plugin-name>",
  "source": { "source": "local", "path": "./plugins/<plugin-name>" },
  "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
  "category": "Developer Tools"
}
```

## 3. Skill 内容改写规则（存异点）

技能**结构与正文整体保留**（求同），仅替换 Claude 专属的机制 / 工具 / 路径引用（存异）。逐项替换：

| Claude 写法 | Codex 改写 |
|---|---|
| `claude --chrome` / `mcp__claude-in-chrome__*` / Claude in Chrome | Codex 原生浏览器 `@Chrome` / 内置 `@Browser`（桌面 App）；CLI 降级到 chrome-devtools MCP / Playwright（即引用 `graceful-browser` skill） |
| `deep-research` workflow / `Workflow` 工具 / dynamic workflow | Codex 多代理（multi-agent v2）：spawn 多个子代理并行 |
| `Agent` 工具 / “dispatch subagent” / “派子代理” | Codex “spawn agent”（自然语言显式请求），子代理定义见 `codex/agents/*.toml` |
| `AskUserQuestion` / `EnterPlanMode` / `ExitPlanMode` | 用普通措辞“向用户提问 / 先给出方案再实施” |
| `ToolSearch` / `select:` | Codex 工具直接可用，删除 ToolSearch 步骤，改为“检测会话内是否有 `mcp__<server>__*` 工具” |
| `claude plugin ...` / `claude -c` / `~/.claude.json` / `.claude/` | `codex plugin ...` / 新开 thread / `~/.codex/config.toml` / `.codex/` |
| `${CLAUDE_PLUGIN_ROOT}` | 保留（Codex 注入同名变量） |
| “Claude Code” / “Claude”（指代理本体处） | “Codex” |
| slash 命令名 `/opsx:*` `/project-init` 等 | Codex 中作为 skill / prompt 触发；按语义改为技能名或“运行 X 流程” |

**不要改**：与 Agent 无关的纯方法论 / 规约正文（dba / develop / devops / middleware / docs / research-* / tdd / vcs / spec-review 的主体内容），它们两侧通用。frontmatter 的 `name` 保持不变；`description` 如含 Claude 专属触发词按上表微调。删除 Claude 专属 frontmatter 字段（`color` / `memory` / `model` 等非 Codex skill 字段；保留 `name` / `description`，`disable-model-invocation` 若存在必须为 false）。

## 4. Command → Skill

每个 `commands/<c>.md` 转成 `skills/<c>/SKILL.md`：

- frontmatter：`name: <c>`；`description`: 用源命令的 `description`，并补足“何时使用”使其可被模型自动触发。删除 `argument-hint` / `allowed-tools`（非 skill 字段）。
- 正文：保留源命令正文，按 §3 改写；`$ARGUMENTS` 改为“用户在请求中提供的补充说明”。
- 涉及 Claude 专属产物的语义按 Codex 调整（如 `CLAUDE.md` → `AGENTS.md`；“调用内置 /init” → “扫描仓库生成初稿”；登记 subagent 时指向 `codex/agents/*.toml`）。

## 5. Agent（subagent）→ `codex/agents/<a>.toml`

Codex subagent 是独立 TOML，**无法**随 plugin 安装；统一放 `codex/agents/<a>.toml`，安装时复制到 `~/.codex/agents/`（personal）或项目 `.codex/agents/`。

```toml
name = "<同源 name>"
description = "<同源 description；去掉转义、可精简>"
developer_instructions = """
<源 agent 的 markdown 正文，按 §3 改写后整体放这里>
"""
```

- 可选：对明显只读的角色（researcher / arch-reviewer / code-reviewer / e2e-runner）加 `sandbox_mode = "read-only"`。
- 不设 `model`（继承会话默认，避免硬编码不存在的模型）。删除 `color` / `memory` / `tools` 等无对应字段。

## 6. 安装与校验

```bash
codex plugin marketplace add ./codex
codex plugin add <plugin>@excalivibe
# subagent：cp codex/agents/*.toml ~/.codex/agents/   （或项目 .codex/agents/）
python3 ~/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py codex/plugins/<plugin>
```
