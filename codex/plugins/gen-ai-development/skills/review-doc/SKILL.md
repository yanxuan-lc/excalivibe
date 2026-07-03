---
name: review-doc
description: Generate the four-layer human-review document (REVIEW.md) from an OpenSpec change, with its freshness stamp — invoked by name from planner and at the architecture gate.
---

# Review Doc — 架构门人审文档（REVIEW.md）的生成

机器消费的 spec 写到执行级精度，人类很难直接读、也评不动「架构是否合理」。本 skill 把
「给人审」的内容独立成一份 **REVIEW.md**——**架构门（Architecture Gate）**的人审载体：
在写代码之前，人据此评估**架构边界是否合理、是否可扩展、是否守得住领域规则**。此刻改动
只值一次 spec 编辑，而非重写。

REVIEW.md 不是结论清单，而是**能被评审**的文档：它分四层——① 框定 → ②结构（领域模型 +
模块/接口/库表/用例四契约）→ ③审议（关键决策的备选与权衡）→ ④横切（质量视角，每项给可测
场景）。其中 **③审议层是关键**：只有看到「为什么这么选、否决了什么、代价是什么」，人才评得动
合理性。

完整模板与逐节指引：[references/review-template.md](references/review-template.md)。
成品示例（先看一遍它长什么样，再动手）：[references/worked-example.md](references/worked-example.md)。

## 三条硬要求（生成 REVIEW.md 时必须遵守）

1. **承载 markdown；内容形式优先级 图（UML/mermaid）＞ 表格 ＞ DSL（如 DDL）＞ 文字。**
   每个点先问「能不能图说清」，逐级回退；文字只留给「决策理由与权衡」这类无法图表化的，且一段内。
   不生成 HTML、不起服务——REVIEW.md 本身就是审阅载体。
2. **自包含**：本流程是 AI 自驱的，**用户没读过 spec / proposal / 任何中间产物**。REVIEW.md
   必须独立成篇——不要写「见 spec 第 X 节」就当读者已知；出现的每个领域名词/系统名，首次出现处
   一句话讲清它是什么。
3. **术语首现双语**：技术/领域术语首次出现写成「中文（English）」（如「聚合（Aggregate）」
   「最终一致（Eventual Consistency）」）。

## 防漂移三原则（本 skill 的存在前提）

1. **spec 是唯一事实源**：REVIEW.md 永远从 `openspec/changes/<id>/` 下的 spec 产物**单向派生**。
   用户对 REVIEW.md 的任何意见，回流给 planner 改 spec、再重新生成 REVIEW.md——**绝不直接编辑
   REVIEW.md**（直接编辑 = 两份事实源，机制失效）。
2. **新鲜度戳可机检**：REVIEW.md 头部记录生成时刻的 spec 内容指纹（见下文 spec-hash）。
   架构门的 human-confirm 校验用同一脚本重算比对——戳不匹配 = 审的是旧方案，门禁不放行。
3. **下游 agent 禁读**：developer / e2e-author / arch-reviewer 的输入契约是 spec 本身，不是
   REVIEW.md。REVIEW.md 为人裁剪过（图表化、省略执行级细节），拿它当实施输入会丢信息。

## 架构门 vs 意图门（分工，别混）

- 本 skill 产出的是**架构门**内容——评的是**结构合理性**（领域模型对不对、模块/接口/库表/用例
  的划分相对领域是否合理、关键决策的取舍）。它在**写代码前**由人签。
- **行为意图**（如「超额是硬拦还是留缓冲」这类「对不对是看了才知道」的事）**不在架构门定**。
  生成 REVIEW.md 时，把这类项在 ③审议层标注「→ 留意图门（对运行切片确认）」并简述，**不要替
  用户在此拍板**。意图门是另一回事：人对一个能跑的薄切片反应，迭代到「对，就是这个」。

## 谁做什么

| 角色 | 职责 |
|------|------|
| **planner** | 按 [references/review-template.md](references/review-template.md) 的结构与顺序，从 spec 派生 `openspec/changes/<id>/REVIEW.md`；每次 spec 修订（arch-review 意见消化、用户反馈回流）后**重新生成**并更新新鲜度戳 |
| **主 Agent** | 在架构门（human-confirm 检查点）：先用 spec-hash 校验 REVIEW.md 新鲜，再把文件路径给到用户直接查看，对话里同步给出要点摘要；收集确认/意见，意见回流 planner |

## 深度档（按变更缩放）

| 档位 | REVIEW.md 写什么 |
|------|------------------|
| **novel-core** | 满档：①框定 + §0 领域模型 + §1–§4 四契约 + ③审议 + ④横切（含可测场景）|
| **supporting** | 框定一两行 + 实际涉及的契约 + 关键决策 + 触发到的横切面 |
| **generic / 可逆** | 框定一行 + 仅动到的契约；§0 领域模型常可省（无新领域概念）；横切按需 |

缺席的契约/层在概览表显式标注「本变更不涉及」，保留编号、节内只写一行。

## 新鲜度戳（spec-hash）

```bash
scripts/spec-hash.sh openspec/changes/<id>/
# → 12 位十六进制，对 change 目录下的 spec 输入文件（*.md，排除 REVIEW.md /
#   PIPELINE.md / arch-review.md / e2e-manifest.md / e2e-report.md）做内容哈希
```

- planner 生成 REVIEW.md 时把输出写进头部元信息表的「Spec 版本」行；
- 架构门校验时重算比对；不一致 → REVIEW.md 过期，退回 planner 重新生成。
- **退出码即契约【强制】**：`spec-hash.sh` 退出非零即失败（spec 文件为空集、目录不存在、
  哈希中途出错），此时 stdout 不携带指纹、**禁止当指纹使用**——planner 写头部前、架构门比对前
  都必须先确认退出码为 0。
- 指纹覆盖 spec 输入文件的**内容与相对路径**：重命名/移动 spec 文件同样使戳失效（刻意如此）。
- 排除清单的含义：派生物与过程产物不参与指纹。管线将来新增过程产物时，脚本里的排除清单与本节要
  **同步更新**，否则该产物一变动就会误判 stale、让 planner 空转。

## 呈现（直接查看 markdown）

- 主 Agent 在架构门把 `openspec/changes/<id>/REVIEW.md` 的路径给到用户，由用户在自己的 markdown
  查看器（IDE 预览、Git 平台页面）中直接阅读；对话里同步给出要点摘要。
- REVIEW.md 里正常写 GFM markdown——表格、mermaid（`classDiagram`/`erDiagram`/
  `stateDiagram-v2`/`sequenceDiagram`/`flowchart`）、```sql / ```jsonc 代码块在主流查看器中均可
  渲染，无需任何渲染指令。
- **不要**为审阅生成 HTML、手写自定义页面或起 HTTP 服务——REVIEW.md 本身就是审阅载体；额外产物
  只会制造第二份事实源和清理负担。
