# 修复 Codex Subagent 配置与双端流程漂移

## 做什么

在不改变 Claude/Codex 共同主流程的前提下，修复 Codex 侧 agent 和 skill 的契约漂移，并利用当前 custom agent TOML 能力建立保守的低成本模型分层：

1. 统一 `REVIEW.mdx`、`REPORT.mdx` 等正式产物路径。
2. 更新 agent 配置与适配文档，准确描述 `model`、`model_reasoning_effort`、`sandbox_mode`、`mcp_servers`、`skills.config` 及配置优先级。
3. 清理 Codex 内容中的 `AskUserQuestion`、`Agent tool`、`opus`/`sonnet`、`WebFetch`、`Claude Code` 等平台漂移。
4. 明确 `PIPELINE.md` 只由主 Agent/autonomy-controller 更新，执行 agent 返回结构化证据。
5. 首批将稳定机械角色静态配置为 `gpt-5.6-terra`，复杂角色保持 `gpt-5.6` 或继承，`researcher` 按 dispatch 动态选择。
6. 增加 agent/skill 一致性与残留词检查。

## 为什么做

当前 9 个 Codex subagent 的职责和主流程总体正确，但错误的 `.md`/`.mdx` 路径会切断 architecture/research 正式门禁与 MDX 展示链；过时配置文档阻碍按角色降本；Claude 专属工具和模型名残留可能引导 Codex 调用不存在的能力。修复这些问题可以在保持双端统一心智模型的同时，发挥 Codex 当前 per-agent 配置与低成本模型的优势。

## 技术方向

- 以 Codex 官方 subagent 配置手册为字段与优先级权威来源。
- 路径契约以对应 skill 为权威：`review-doc` 决定 `REVIEW.mdx`，`research-pipeline` 决定 `REPORT.mdx`。
- 模型策略：
  - `e2e-runner`: `gpt-5.6-terra`, `low`
  - `e2e-author`: `gpt-5.6-terra`, `medium`
  - `release-coordinator`: `gpt-5.6-terra`, `medium`
  - `planner`, `arch-reviewer`, `code-reviewer`: `gpt-5.6`, `high`
  - `developer`, `debugger`: `gpt-5.6` 或继承强模型，`high`
  - `researcher`: 不静态 pin；机械 probe 使用 `gpt-5.6-terra/medium`，复杂源码判断和 synthesize 使用 `gpt-5.6/medium|high`
- 权限策略以职责最小化为目标，但不得使用会阻止报告写盘的统一只读 sandbox；若无路径级写权限，则用 workspace-write 加明确职责边界。
- 增加脚本化检查：TOML 解析、agent 集合、产物扩展名一致性、Codex 目录平台专属残留、JSON/plugin 校验。

## 约束条件

- Claude 与 Codex 的主流程、角色职责和用户心智模型必须一致。
- 不要求两侧模型名、工具、memory、color 或 sandbox 实现完全相同。
- 不把所有角色统一降为低成本模型。
- 不让 verifier 或 researcher 因静态只读 sandbox 无法写规定产物。
- plugin 无法捆绑 subagent 的安装事实不变；需继续支持 personal 和 project-local 复制安装。
- marketplace 不增加版本字段；本变更若未进入发布流程，不做版本 bump。

## 验收标准

1. Codex agent、skill、模板、脚本和门禁对人审产物统一引用 `REVIEW.mdx`。
2. Codex research-pipeline 与 researcher synthesize 统一生成并返回 `REPORT.mdx + PROPOSAL.md`。
3. Codex 目录中不再出现未经解释的 `AskUserQuestion`、`Agent tool`、`opus`、`sonnet`、`WebFetch` 或面向用户的 `Claude Code` 文案。
4. agent README 准确列出实际 TOML 字段、解析优先级、静态/动态模型策略和真实 sandbox 状态。
5. `e2e-runner` 不再直接 tick `PIPELINE.md`；主 Agent 能基于其返回的 path/commit/verdict 更新状态。
6. `e2e-runner`、`e2e-author`、`release-coordinator` 的低成本静态配置可被目标 Codex CLI 成功加载；复杂角色配置符合上表。
7. researcher dispatch 能明确覆盖机械探查和复杂综合两档模型/effort，且不依赖静态单一模型。
8. 9 个 TOML 均可解析并可在新 thread 中被发现；安装说明覆盖目录创建、复制、重开 thread、冒烟和更新方式。
9. 三个 Codex plugin 通过 `validate_plugin.py`，marketplace 与所有 plugin manifest 通过 `jq`。
10. Claude 侧主流程和正式产物契约未被 Codex 特有优化破坏；若仅修改 Codex 侧，变更说明明确这是平台配置/文案适配而非流程分叉。
