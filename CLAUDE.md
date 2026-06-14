# CLAUDE.md — ExcaliVibe（Claude Code 专属）

See [AGENTS.md](./AGENTS.md) for project facts shared across agents.（项目简介、目录结构、marketplace/plugin 规范、安装调试命令、Git 约定等不在此重复。）

本文件只记录 **Claude Code 专属**的偏好、机制与 Subagent 协作规则。

## 最高优先级原则：求同存异

原则本身见 [AGENTS.md「核心原则：求同存异」](./AGENTS.md#核心原则求同存异所有迭代必须遵循)（架构与主流程两侧一致，实现细节各自最优）。以下是该原则**对 Claude Code 的硬性要求**：

- 任何迭代改进，先确认它在 Claude 与 Codex 两侧**走同样的主流程**，再用 Claude 最契合的 primitives 落地实现细节。
- 改 `claude/` 时，**同步考虑 `codex/` 的对应实现**：两侧要么一起改、保持主流程一致，要么显式说明为何只动一侧。
- **不要**为了和 Codex 对齐而把 Claude 的能力拉低到折中方案，反之亦然。这是「存异」，不是「将就」。
- 修改 `codex/` 下的文件时，遵循 Codex 的 manifest 规范（`.codex-plugin/plugin.json` 必含 `interface.capabilities`/`defaultPrompt`，**不要**在 `.codex-plugin/plugin.json` 里写 `hooks` 字段：`validate_plugin.py` 会拒绝该字段（exit 1）；注意 Codex 运行时本身具备 hooks 能力（`config.toml`/`hooks.json` 途径），但非交互式 exec 下触发未经验证（trust-gated）；v1 无任何 hooks 依赖），不要套用 Claude 的结构假设。

## Claude 侧能力与 primitives

实现 Claude 侧能力时，优先使用 Claude 独有/最契合的 primitives：

- **plugin 单元**：`commands/`（slash 命令）、`agents/`（subagent）、`skills/`（SKILL.md）、`hooks/`、`.mcp.json`。
- **浏览器**：优先 `claude --chrome`（在 graceful-browser skill 决策下），兜底 chrome-devtools MCP / Playwright。
- **调研**：可用 `deep-research` 与 dynamic workflow（对应 Codex 侧的常规 subagent）。
- **库 / API 文档**：需要查任何库 / 框架 / SDK 用法时，优先用 **Context7**（无需用户显式要求）。

## OpenSpec / dev-pipeline

本仓库内置 OpenSpec（`openspec/`）与 `opsx:*` 命令。dev-pipeline / OpenSpec **只服务于「可运行产品代码」的研发**——新增功能代码、改 schema/迁移、动公共接口或契约、跨模块业务实现、或**高影响面的 bugfix**，且影响面不明时才走（planner → arch-review → apply ∥ QA → e2e ∥ code-review → archive）；小而明确的改动可直接做。

> **改 skill / agent / command / prompt / 文档本身不算研发，不走 OpenSpec。** 这类工作以 **`skill-creator`** 为权威轨道（结构、eval、描述触发率优化）。**文件数多或「双端都要动」本身不构成「跨模块」**——只有可运行产品代码的变更才会。本仓库的产物绝大多数是 Markdown 形式的 skill/agent/prompt + JSON manifest，因此日常迭代基本都走 skill-creator + 下面的「双端同步」约定，而非 dev-pipeline。
>
> **双端同步约定**：改 `claude/` 必同步考虑 `codex/`（见顶部「求同存异」），两侧 marketplace 清单 `plugins[]` 同步追加，改完用 `validate_plugin.py`（Codex）/ `jq`（JSON）做最小校验。

## Subagents

下表列出本项目可用的 Subagent。**遇到匹配场景，必须优先通过 `Agent` 工具委派**，而不是在主 Agent 里硬做。表中为能力摘要，具体行为以各 agent 定义为准。

| 名称 | 来源 | 触发场景 | 不要用于 |
|------|------|----------|----------|
| researcher | plugin (gen-ai-development) | research-pipeline 派发的调研执行单元；快速 scoped 查证 | 直接面向用户的调研入口（用 research-pipeline）；广域 web 扫描（主 Agent 调 deep-research） |
| planner | plugin (gen-ai-development) | 走 OpenSpec 流程提案新功能 / 大重构（opsx:propose） | 单文件修复 |
| arch-reviewer | plugin (gen-ai-development) | spec 含 DDL / 新接口 / 跨模块时，apply 前设计审查 | 纯逻辑小 spec（跳过留痕）；审实现代码 |
| developer | plugin (gen-ai-development) | OpenSpec apply 阶段的 TDD 实施（spec 已就绪） | 缺少 spec 时禁用；e2e 测试代码 |
| debugger | plugin (gen-ai-development) | bug / failure / stack-trace 出现时的假设驱动调试会话 | spec 创建；无 bug 背景的功能实现 |
| quality-assurance | plugin (gen-ai-development) | spec 声明脚本化载体后写 e2e 测试代码（与 developer 并行） | 改产品代码；agent 驱动载体的变更 |
| code-reviewer | plugin (gen-ai-development) | merge 进 dev 前的增量审查（门禁）；全量仅显式要求 | 一次性脚本 |
| e2e-runner | plugin (gen-ai-development) | 实施 + QA 交付后的 E2E 验收（先拉起应用） | 单测验证；写 / 改任何代码 |
| Explore | built-in | 跨多文件的代码定位、"在哪定义 / 有哪些命名约定" | 已知路径直接 Read |
| Plan | built-in | 设计实施方案 | 单行修改 |
| general-purpose | built-in | 多步开放式搜索 / 调研 | 单次明确查找 |

### 委派规则

- **并行原则**：多个相互独立的子任务，在同一条消息里一次性发起多个 `Agent` 调用。
- **理解不外包**：不要把「基于结果再做判断 / 修复」完全交给 Subagent —— 主 Agent 必须读关键文件并做综合决策。
- **复杂研发按 `gen-ai-development:dev-pipeline` skill 编排**：分流决策、相位顺序、人工检查点、merge 门禁、PIPELINE.md 状态落盘均以该 skill 为准，这里只写指针、不复制内容。（注意本仓库约束：dev-pipeline 只服务「可运行产品代码」，改 skill/agent/command/prompt/文档不走，见上节。）
- **调研需求按 `gen-ai-development:research-pipeline` skill 编排**：澄清、确认、追问都留在主 Agent；`researcher` 仅作为执行单元被派发。
- **场景匹配示例**（结合本项目，每条 1 行）：
  - 改动跨 ≥3 文件且影响面不明 → 先 `Explore`
  - 调研 / 对比 / 可行性 → `research-pipeline` skill（`researcher` 仅执行单元；或主 Agent 直接用 Context7）
  - 提议新能力 plugin / 大重构 → `planner` 走 OpenSpec
  - spec 含 DDL / 新接口 → apply 前 `arch-reviewer` 设计审查
  - spec 已就绪、进入实施 → `developer`（TDD）∥ `quality-assurance`（e2e 测试代码）
  - bug / failure / stack-trace → `debugger` 假设驱动调试
  - merge 进 dev 前 → `code-reviewer`（增量）∥ `e2e-runner`（验收），同消息并行

## Do / Don't

- **Don't** 自动 `git commit`；改动交人工审阅后再提交。
- **Don't** 单独改一侧而破坏双端主流程一致性（除非显式说明）。
- **Do** 改完 manifest 后用 `validate_plugin.py`（Codex）/ `jq`（JSON）做最小校验。
- **Do** 新增 plugin 时两侧 marketplace 清单的 `plugins[]` 同步追加。
