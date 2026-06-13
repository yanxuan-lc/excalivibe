---
name: spec-review
description: Generate the human-review document (REVIEW.md) for an OpenSpec change — the four-contract digest (project structure & module design / external protocol / database design / use cases & e2e scenarios) that the user personally confirms at the dev-pipeline's spec-confirm checkpoint, read directly as markdown. Use this skill whenever a spec is heading for user confirmation — planner consults it to write REVIEW.md from the spec; the main agent consults it to present the document at the Human Checkpoint and to regenerate it after any spec revision. Trigger it when the user mentions 人审文档 / 设计审查文档 / 查看 REVIEW / 四件套确认 / spec-confirm, or whenever a proposal is being presented for human sign-off — even if no one says "spec-review".
---

# Spec Review — 四件套人审文档的生成

机器消费的 spec 写到执行级精度（稳定场景 ID、WHEN/THEN、DB 期望），人类很难直接读。
本 skill 把"给人审"的内容独立成一份 **REVIEW.md**，用户直接以 markdown 阅读
（IDE 预览 / Git 平台均可渲染 GFM 与 Mermaid）——spec 照旧服务下游 agent，
REVIEW.md 专门服务 spec-confirm 检查点上的人。

## 防漂移三原则（本 skill 的存在前提）

1. **spec 是唯一事实源**：REVIEW.md 永远从 `openspec/changes/<id>/` 下的 spec 产物
   **单向派生**。用户对 REVIEW.md 的任何意见，回流给 planner 改 spec、再重新生成
   REVIEW.md——**绝不直接编辑 REVIEW.md**。直接编辑意味着两份事实源，整个机制即告失效。
2. **新鲜度戳可机检**：REVIEW.md 头部记录生成时刻的 spec 内容指纹（见下文
   spec-hash）。dev-pipeline 的 Gate 1 用同一脚本重算并比对——戳不匹配 = 审的是旧
   方案，门禁不放行。
3. **下游 agent 禁读**：developer / quality-assurance / arch-reviewer 的输入契约是
   spec 本身，不是 REVIEW.md。REVIEW.md 为人裁剪过（省略执行级细节），拿它当实施
   输入会丢信息。

## 谁做什么

| 角色 | 职责 |
|------|------|
| **planner** | 按 [references/review-template.md](references/review-template.md) 的结构与顺序，从 spec 派生 `openspec/changes/<id>/REVIEW.md`；每次 spec 修订（arch-review 意见消化、用户反馈回流）后**重新生成**并更新新鲜度戳 |
| **主 Agent** | 在 Human Checkpoint（spec-confirm）：先用 spec-hash 校验 REVIEW.md 新鲜，再把文件路径给到用户直接查看，对话里同步给出要点摘要；收集确认/意见，意见回流 planner |

## REVIEW.md 的结构（顺序固定）

四件套按**自顶向下**顺序呈现——先架构、再契约、再数据、最后验收口径：

1. **项目结构与模块设计** — 目录增量、模块依赖图、职责边界表
2. **外部协议** — RESTful API / RPC / 事件契约：端点属性、请求/响应示例、错误码表
3. **数据库设计** — ER 图、完整 DDL、索引预算与扩展性决策
4. **用例设计** — e2e 场景总表（S1/S2/…）+ 主路径时序图；用户确认本节即确认验收口径

头部固定带：元信息表（变更 ID / 生成时间 / spec 版本戳 / arch-review 状态）+
四件套概览表（缺席项在此显式标注"本变更不涉及"，正文对应节省略）。
结尾固定带：深究指针（指回 spec 文件）+ 逐项确认清单。

完整骨架与逐节写作指引：[references/review-template.md](references/review-template.md)。
写之前先看一遍成品长什么样：[references/worked-example.md](references/worked-example.md)。

呈现偏好：**表格 > 图 > 散文**。Mermaid（`sequenceDiagram` / `erDiagram` /
`flowchart`）、```sql DDL 块、JSON 示例在主流 markdown 查看器（IDE 预览、
GitHub / GitLab）中都能正确展示；大段散文不会被认真读。每节末尾给指回 spec
的指针，深究的人自己跳。

## 新鲜度戳（spec-hash）

```bash
scripts/spec-hash.sh openspec/changes/<id>/
# → 12 位十六进制，对 change 目录下的 spec 输入文件（*.md，排除 REVIEW.md /
#   PIPELINE.md / arch-review.md / e2e-manifest.md / e2e-report.md）做内容哈希
```

- planner 生成 REVIEW.md 时把输出写进头部元信息表的「Spec 版本」行；
- Gate 1 校验时重算比对；不一致 → REVIEW.md 过期，退回 planner 重新生成。
- **退出码即契约【强制】**：`spec-hash.sh` 退出非零即失败（spec 文件为空集、
  目录不存在、哈希中途出错），此时 stdout 不携带指纹、**禁止当指纹使用**——
  planner 写头部前、Gate 1 比对前都必须先确认退出码为 0。
- 指纹覆盖 spec 输入文件的**内容与相对路径**：重命名/移动 spec 文件同样使戳
  失效（刻意如此——结构变化也是设计变化）。
- 排除清单的含义：派生物与过程产物不参与指纹，勾 PIPELINE.md、重发 REVIEW.md
  本身不会使戳失效。管线将来新增过程产物时，脚本里的排除清单与本节要**同步
  更新**，否则该产物一变动就会误判 stale、让 planner 空转。

## 呈现（直接查看 markdown）

- 主 Agent 在 spec-confirm 检查点把 `openspec/changes/<id>/REVIEW.md` 的路径给到
  用户，由用户在自己的 markdown 查看器（IDE 预览、Git 平台页面）中直接阅读；
  对话里同步给出要点摘要。
- REVIEW.md 里正常写 GFM markdown 即可——表格、Mermaid、```sql / JSON 代码块在
  主流查看器中均可渲染，无需任何渲染指令。
- **不要**为审阅生成 HTML、手写自定义页面或起 HTTP 服务——REVIEW.md 本身就是
  审阅载体；额外产物只会制造第二份事实源和清理负担。
