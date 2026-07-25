# 修复 ExcaliVibe Codex 运行契约与原生适配

## 做什么

在不改变 Claude/Codex 共同主流程的前提下，分阶段修复 Codex 侧 pipeline、agent、skill、browser、hook、安装与文档契约。

本变更属于 skill / agent / prompt / plugin 内容迭代，**不走 OpenSpec 产品研发流程**；按 `skill-creator` / `plugin-creator` 与直接内容迭代、双端一致性审查、validator/冒烟轨道执行。

### Phase 0：契约与静态测试

- 建立唯一产物表：
  - `docs/research/<...>/REPORT.mdx`
  - `docs/research/<...>/PROPOSAL.md`
  - `openspec/changes/<id>/REVIEW.mdx`
  - `CHECKLIST.md`
  - `e2e-manifest.md`
  - `e2e-report.md`
  - `RELEASE.md`
- 增加 producer/consumer 一致性检查。
- 增加 Codex 禁用残留扫描：`AskUserQuestion`、`Agent tool`、`WebFetch`、`opus`、`sonnet`。
- 检查只有 autonomy-controller 更新 `PIPELINE.md`。

### Phase 1：修复关键契约

- research-pipeline、protocol、researcher 统一输出 `REPORT.mdx` + `PROPOSAL.md`。
- review-doc、planner、developer、release-coordinator、controller 统一使用 `REVIEW.mdx`。
- e2e-runner 只写 `e2e-report.md`，controller 验证后更新 PIPELINE。
- 为 controller 增加统一 spawn policy：fresh verifier 使用 `fork_turns=none`；continuation 复用原 agent；明确并发文件所有权。

### Phase 2：Codex 原生运行时

- 将 research 用户交互改为 Codex request-input；researcher 只返回 `open_questions`。
- browser 先 capability discovery，再走 native browser/computer-use → Chrome connector → bundled chrome-devtools MCP → Playwright。
- app-ux-design 使用 Codex PTY/session-id/write_stdin，定义 server/watcher 的重连、轮询、终止、联网安装和 approval。
- 为 9 个 agent 配置 model / model_reasoning_effort，并在 controller 定义 lane override。
- 为 verifier 区分“行为上不改产品/测试代码”和“文件系统仍需 workspace-write 以写报告”；用文件所有权与 hook 收紧实际写入范围。
- 按 Codex hook 协议实现 plugin `hooks/hooks.json` 与 guardrail，完成 trust-gated 交互冒烟；不在 manifest 增加 `hooks` 字段。

### Phase 3：Skill 路由和 Agent 分发

- 将 27 个 skill descriptions 从当前约 12,112 bytes 压缩到 catalog 预算内，触发词前置。
- 为适用 skill 增加 `agents/openai.yaml`，声明 `allow_implicit_invocation` 和 `dependencies.tools`。
- 验证 agent-local `skills.config` 相对路径在 plugin cache 下可移植；不把它作为权限控制。
- 通过项目 `.codex/config.toml [agents.<role>] config_file` 或 setup 安装，把 agent TOML 与 plugin 版本绑定，减少手工全局 copy 漂移。

### Phase 4：安装、可复现性和文档

- 固定 `chrome-devtools-mcp` 版本，说明首次联网和离线降级。
- 补全 marketplace upgrade、plugin refresh、cachebuster 的可复制命令。
- 修正两侧 gen-ai README 版本、Codex plugin-infra 的 mdx-artifact 列表、根 README graceful-browser 差异。
- 明确 opc-workflow 是占位能力，或隐藏无能力的安装入口。

## 为什么做

- 当前 research 和 review 的产物扩展名互相冲突，会让关键 gate 找不到 producer 输出。
- 当前 agent 全量继承父会话，fresh reviewer/e2e independence 未兑现。
- README 宣称的 model/effort/sandbox 与 TOML 实际配置不一致。
- browser、WebFetch、AskUserQuestion、opus/sonnet 和后台 watcher 属于 Claude 语义或未探测能力。
- 27 个长 description 超过 Codex 初始 skill catalog 的保守预算，关键 skill 可能被截断或省略。
- Codex 当前已支持 plugin hooks，应利用其原生协议，而不是只靠提示词或误认为不可分发。

## 技术方向

- 保持 Claude/Codex 的研发、调研、架构门、意图门、验证三角、merge gate、release 主流程一致。
- Codex 侧使用自身的 agent TOML、spawn/fork、model/effort、sandbox/approval、hooks、apps/MCP、browser/computer-use 和 PTY session。
- producer/consumer 契约采用单一事实源，禁止 `.md`/`.mdx` 双轨。
- verifier 默认 fresh context；不同 OpenAI 模型不宣称 different family。
- 跨 family audit 使用 Claude/外部 adapter；不可用时在 PIPELINE 明确记录未满足，不静默降级。
- hook 是第二道机械兜底，不能替代 runtime approval、sandbox 和用户发布同意。

### 建议 Agent 默认值

| Agent | Model | Effort | Fork |
|---|---|---|---|
| planner | Sol | high（复杂 xhigh） | none |
| arch-reviewer | Sol | high | none |
| developer | Terra（复杂升 Sol） | high | none |
| e2e-author | Terra | medium | none |
| e2e-runner | Terra | low | none |
| debugger | Sol（明确故障可 Terra） | high | none |
| code-reviewer | Sol（spot 可 Terra） | high / medium | none |
| release-coordinator | Terra | medium | none |
| researcher | Terra（复杂 synthesis 升 Sol） | medium / high | none |

## 约束条件

- 最高原则仍是“求同存异”；不能为迁就某一端降低两端架构。
- 不修改 marketplace 的版本字段设计；版本仍以 plugin manifest/package 同步点为准。
- Codex manifest 不增加 validator 拒绝的 `hooks` 字段；hook 通过约定目录发现。
- 不把所有 verifier 粗暴设为全局 read-only，因为它们必须写报告。
- 不把 `skills.config` 当安全权限。
- 不使用 MCP `@latest`。
- 不让非 controller 角色写 `PIPELINE.md`。
- 不让 researcher/e2e/reviewer 直接与用户交互；问题返回 orchestrator。
- 不允许 Sol/Terra 被表述为 different model family。
- Agent 不自动 commit；全部变更由人工审阅后提交。

## 验收标准

1. 三个 Codex plugin validator 与全部 JSON/TOML 解析通过。
2. 静态检查证明 research 全链路只使用 `REPORT.mdx`，review 全链路只使用 `REVIEW.mdx`。
3. 除 autonomy-controller 外，无角色写 `PIPELINE.md`。
4. Codex skills/agents 中不存在可执行语义的 `AskUserQuestion`、`Agent tool`、`WebFetch`、`opus`、`sonnet` 残留。
5. 9 个 agent 的实际 model/effort/fork/sandbox 解析值与配置表一致。
6. reviewer、arch-reviewer、e2e-author/e2e-runner 的新 run 使用 `fork_turns=none`，且 continuation 可复用原 agent。
7. research 流程完成 clarify → parallel investigate → synthesize，并落盘 `REPORT.mdx` + `PROPOSAL.md`。
8. planner → review-doc → freshness gate → release 全链路消费同一 `REVIEW.mdx`。
9. e2e-runner 写 commit-stamped report 和 DB 证据，但不修改 PIPELINE。
10. browser 在 native、有 MCP、无 browser 三种环境下均能 discovery、选择或明确降级。
11. app-ux dev server 与 apply watcher 可跨 turn 由 session-id 接管，结束时可回收。
12. Codex hook 经 trust prompt 后，对 publish/push-main/reset-hard 等按设计 ask/deny；hook 不可用时 approval/sandbox 仍生效。
13. 27 个 skill catalog 不因 description 预算被截断，关键 orchestration skill 可隐式触发。
14. agent TOML 随项目/plugin 升级不依赖易漂移的手工全局复制。
15. README 版本、能力列表、marketplace upgrade/cachebuster、MCP pin 和 opc-workflow 状态与实际一致。
