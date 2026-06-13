---
name: setup-gen-ai
description: 初始化本项目以顺畅使用 gen-ai-development 管线——确保各子 Agent 落盘的管线产物目录（研究报告 / code-review 报告 / openspec 变更产物 / e2e 报告）在 Codex 沙箱下可写，并把这些目录约定登记进项目配置。当用户要"配置 gen-ai 管线"、"让子 agent 能写盘"、"准备 openspec / e2e 报告目录"时使用。
---

# setup-gen-ai — 让管线产物稳定落盘（Codex 版）

你的任务：确保 gen-ai-development 各子 Agent 落盘**管线产物**所需的目录在**当前项目**里可写、且约定清晰，使产物能被 git 提交、随仓库分发给团队。

## 背景（为什么需要这一步）

管线的多个子 Agent 需要写盘，且它们的产物是 merge 门禁的检查对象：

- `researcher`(synthesize) 写 `docs/research/<datetime>-<topic>/`
- `code-reviewer` 写 `docs/code-review/<datetime>/`（其 CHECKLIST 是门禁要件）
- `planner` / `arch-reviewer` / `quality-assurance` / `e2e-runner` 写 `openspec/changes/<id>/` 下的 spec、arch-review、manifest 与 e2e 报告（同为门禁要件）
- `e2e-runner` 在没有 change dir 时把报告写到 `docs/e2e/`

涉及的产物目录（均以项目根为锚）：

```
docs/research/**        # researcher synthesize
docs/code-review/**     # code-reviewer 四件套 → 门禁要件
docs/e2e/**             # e2e-runner 无 change dir 时的报告位
openspec/changes/**     # spec / arch-review / manifest / e2e-report / PIPELINE.md
```

## Codex 与 Claude 的差异（存异点）

Codex 没有 Claude 的 `permissions.allow` 工具白名单机制；写盘能否放行取决于**会话的 sandbox / approval 策略**。被 spawn 的子 Agent **继承会话的沙箱策略**，因此让产物稳定落盘的正确做法是：

1. 保证这些目录落在**项目工作区内**（它们本就以项目根为锚，默认在工作区内可写）——不要把产物写到工作区之外。
2. 运行管线时，会话的沙箱模式需允许写工作区（`workspace-write` 或更高）。若以只读 / 受限沙箱启动，子 Agent 的写操作会被拒——此时请提示用户用可写工作区的模式重开会话。
3. 对明显只读的角色（researcher 探查 / arch-reviewer / code-reviewer / e2e-runner 的验证读取）其 TOML 可声明 `sandbox_mode = "read-only"`，但**负责写产物的步骤**（synthesize / 写报告）必须在可写工作区下进行。

> 与 Claude 侧主流程求同（同样是"预先约定好产物目录、保证可写、纳入 git"），仅把"项目 `.claude/settings.json` 的 allow 规则"换成 Codex 的"工作区内 + 可写沙箱"模型。

## 执行步骤

1. 定位项目根：优先 `git rev-parse --show-toplevel`，失败则用当前工作目录。
2. 确保上述四个产物目录已被项目接纳：
   - 若项目用 `.gitignore` 排除了 `docs/` 或 `openspec/`，提醒用户管线产物需要纳入版本控制（它们是门禁要件），按需调整忽略规则。
   - 可选地在项目根创建占位 `docs/research/`、`docs/code-review/`、`docs/e2e/`、`openspec/changes/` 目录（放 `.gitkeep`），让团队成员一眼看到产物去向。
3. 在 `AGENTS.md` 里登记这些产物目录约定（若 `AGENTS.md` 不存在，建议先运行 `project-init`）：一段简短说明"管线产物落在哪、为何要提交"。
4. 检查当前会话沙箱：若不是可写工作区模式，提示用户用 `workspace-write`（或更高）模式重开会话后再跑管线。

## 收尾说明

- 向用户汇报：确认了哪几个产物目录、是否调整了 `.gitignore`、`AGENTS.md` 是否登记、当前沙箱模式是否满足写盘需求。
- 不要扩大授权范围（不要顺手放开工作区外的写路径或额外网络访问）——本流程刻意保持最小改动；源码 / 数据 / 接口探查的命令仍按正常沙箱审批走。
- 若用户更想要个人、不提交的配置，可把目录约定写在个人 `~/.codex/config.toml` 注释或个人 `AGENTS.md` 里，而非项目共享文件。
