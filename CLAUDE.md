# CLAUDE.md — ExcaliVibe（Claude Code 专属）

See [AGENTS.md](./AGENTS.md) for project facts shared across agents.（项目简介、目录结构、marketplace/plugin 规范、安装调试命令、Git 约定等不在此重复。）

本文件只记录 **Claude Code 专属**的偏好、机制与 Subagent 协作规则。

## 最高优先级原则：求同存异

> **架构与主流程保持一致；实现细节针对各 Agent 个性化优化与适配。**

对 Claude Code 的硬性要求：

- 任何迭代改进，先确认它在 Claude 与 Codex 两侧**走同样的主流程**，再用 Claude 最契合的 primitives 落地实现细节。
- 改 `claude/` 时，**同步考虑 `codex/` 的对应实现**：两侧要么一起改、保持主流程一致，要么显式说明为何只动一侧。
- **不要**为了和 Codex 对齐而把 Claude 的能力拉低到折中方案，反之亦然。这是「存异」，不是「将就」。
- 修改 `codex/` 下的文件时，遵循 Codex 的 manifest 规范（`.codex-plugin/plugin.json` 必含 `interface.capabilities`/`defaultPrompt`，**不要**在 `.codex-plugin/plugin.json` 里写 `hooks` 字段：`validate_plugin.py` 会拒绝该字段（exit 1）；注意 Codex 运行时本身具备 hooks 能力（`config.toml`/`hooks.json` 途径），但非交互式 exec 下触发未经验证（trust-gated）；v1 无任何 hooks 依赖），不要套用 Claude 的结构假设。

## Claude 侧能力与 primitives

实现 Claude 侧能力时，优先使用 Claude 独有/最契合的 primitives：

- **plugin 单元**：`commands/`（slash 命令）、`agents/`（subagent）、`skills/`（SKILL.md）、`hooks/`、`.mcp.json`。
- **浏览器**：优先 `claude --chrome`（在 graceful-browser skill 决策下），兜底 chrome-devtools MCP / Playwright。
- **调研**：可用 `deep_research` 与 dynamic workflow（对应 Codex 侧的常规 subagent）。
- **库 / API 文档**：需要查任何库 / 框架 / SDK 用法时，优先用 **Context7**（无需用户显式要求）。

## OpenSpec / dev-pipeline

本仓库内置 OpenSpec（`openspec/`）与 `opsx:*` 命令。**较大、跨模块、影响面不明的需求**走 dev-pipeline（planner → arch-review → apply ∥ QA → e2e ∥ code-review → archive）；小而明确的改动可直接做。双端能力新增通常属于「跨模块」，倾向走 OpenSpec。

## Subagents

下表列出本项目可用的 Subagent。**遇到匹配场景，必须优先通过 `Agent` 工具委派**，而不是在主 Agent 里硬做。

| 名称 | 来源 | 触发场景 | 不要用于 |
|------|------|----------|----------|
| researcher | user (gen-ai-development) | 需要先调研 / 对比方案、查清外部事实再动手 | 已清楚怎么做的小改动 |
| planner | user (gen-ai-development) | 走 OpenSpec 流程提案新功能 / 大重构（opsx:propose） | 单文件修复 |
| arch-reviewer | user (gen-ai-development) | 实施前审 OpenSpec 提案/spec 的设计（schema/API/模块边界/验收标准） | 纯逻辑小 spec 可跳过 |
| developer | user (gen-ai-development) | OpenSpec apply 阶段的 TDD 实施（spec 已就绪） | 缺少 spec 时禁用 |
| debugger | user (gen-ai-development) | bug/failure/stack-trace 出现时的假设驱动调试会话 | spec 创建、无 bug 背景的功能实现 |
| quality-assurance | user (gen-ai-development) | 依据 spec 场景编写 e2e 测试代码（与 developer 并行） | 编写产品代码 |
| code-reviewer | user (gen-ai-development) | 增量 / 全量代码审查 | 一次性脚本 |
| e2e-runner | user (gen-ai-development) | 合并前 / 大功能完成后执行 e2e 并产出验收报告 | 单测验证 |
| Explore | built-in | 跨多文件的代码定位、"在哪定义 / 有哪些命名约定" | 已知路径直接 Read |
| Plan | built-in | 设计实施方案 | 单行修改 |
| general-purpose | built-in | 多步开放式搜索 / 调研 | 单次明确查找 |

### 委派规则

- **并行原则**：多个相互独立的子任务，在同一条消息里一次性发起多个 `Agent` 调用。
- **理解不外包**：不要把「基于结果再做判断 / 修复」完全交给 Subagent —— 主 Agent 必须读关键文件并做综合决策。
- **场景匹配示例**（结合本项目）：
  - 改动跨 ≥3 文件且影响面不明 → 先 `Explore`
  - 提议新能力 plugin / 大重构 → `planner` 走 OpenSpec
  - spec 已就绪、进入实施 → `developer`（TDD）；同时 `quality-assurance` 写 e2e
  - 提案含跨模块 / 新接口 → 实施前 `arch-reviewer` 把关
  - 合并前 → `code-reviewer`（增量模式）+ `e2e-runner`
  - 需要查库 / API 真实用法再下结论 → `researcher`（或主 Agent 直接用 Context7）

## Do / Don't

- **Don't** 自动 `git commit`；改动交人工审阅后再提交。
- **Don't** 单独改一侧而破坏双端主流程一致性（除非显式说明）。
- **Do** 改完 manifest 后用 `validate_plugin.py`（Codex）/ `jq`（JSON）做最小校验。
- **Do** 新增 plugin 时两侧 marketplace 清单的 `plugins[]` 同步追加。
