---
name: review-doc
description: Generate the four-layer human-review document (REVIEW.mdx) from an OpenSpec change, with its freshness stamp — invoked by name from planner and at the architecture gate.
---

# Review Doc — 架构门人审文档（REVIEW.mdx）的生成

机器消费的 spec 写到执行级精度，人类很难直接读、也评不动「架构是否合理」。本 skill 把
「给人审」的内容独立成一份 **REVIEW.mdx**——**架构门（Architecture Gate）**的人审载体：
在写代码之前，人据此评估**架构边界是否合理、是否可扩展、是否守得住领域规则**。此刻改动
只值一次 spec 编辑，而非重写。

REVIEW.mdx 不是结论清单，而是**能被评审**的文档：它分四层——① 框定 → ②结构（领域模型 +
模块/接口/库表/用例四契约）→ ③审议（关键决策的备选与权衡）→ ④横切（质量视角，每项给可测
场景）。其中 **③审议层是关键**：只有看到「为什么这么选、否决了什么、代价是什么」，人才评得动
合理性。

完整模板与逐节指引：[references/review-template.md](references/review-template.md)。
成品示例（先看一遍它长什么样，再动手）：[references/worked-example.mdx](references/worked-example.mdx)。

## 三条硬要求（生成 REVIEW.mdx 时必须遵守）

1. **承载 MDX（Markdown 超集 + 组件），由 plugin-infra 的 `mdx-artifact` skill 渲染成富 HTML 查看；
   内容形式优先级 图（mermaid / graphviz）＞ 表格 ＞ DSL（如 DDL）＞ 文字。**
   每个点先问「能不能图说清」，逐级回退；文字只留给「决策理由与权衡」这类无法图表化的，且一段内。
   正文能用 Markdown 就用 Markdown，图/决策/元信息用组件增强。**MDX 是唯一的源**，HTML 只是可随时
   重生的渲染产物——不手写 HTML、不在 MDX 之外另造页面。
2. **自包含**：本流程是 AI 自驱的，**用户没读过 spec / proposal / 任何中间产物**。REVIEW.mdx
   必须独立成篇——不要写「见 spec 第 X 节」就当读者已知；出现的每个领域名词/系统名，首次出现处
   一句话讲清它是什么。
3. **术语首现双语**：技术/领域术语首次出现写成「中文（English）」（如「聚合（Aggregate）」
   「最终一致（Eventual Consistency）」）。

## 防漂移三原则（本 skill 的存在前提）

1. **spec 是唯一事实源**：REVIEW.mdx 永远从 `openspec/changes/<id>/` 下的 spec 产物**单向派生**。
   用户对 REVIEW.mdx 的任何意见，回流给 planner 改 spec、再重新生成 REVIEW.mdx——**绝不直接编辑
   REVIEW.mdx**（直接编辑 = 两份事实源，机制失效）。
2. **新鲜度戳可机检**：REVIEW.mdx 头部记录生成时刻的 spec 内容指纹（见下文 spec-hash）。
   架构门的 human-confirm 校验用同一脚本重算比对——戳不匹配 = 审的是旧方案，门禁不放行。
3. **下游 agent 禁读**：developer / e2e-author / arch-reviewer 的输入契约是 spec 本身，不是
   REVIEW.mdx。REVIEW.mdx 为人裁剪过（图表化、省略执行级细节），拿它当实施输入会丢信息。

## 架构门 vs 意图门（分工，别混）

- 本 skill 产出的是**架构门**内容——评的是**结构合理性**（领域模型对不对、模块/接口/库表/用例
  的划分相对领域是否合理、关键决策的取舍）。它在**写代码前**由人签。
- **行为意图**（如「超额是硬拦还是留缓冲」这类「对不对是看了才知道」的事）**不在架构门定**。
  生成 REVIEW.mdx 时，把这类项在 ③审议层标注「→ 留意图门（对运行切片确认）」并简述，**不要替
  用户在此拍板**。意图门是另一回事：人对一个能跑的薄切片反应，迭代到「对，就是这个」。

## 谁做什么

| 角色 | 职责 |
|------|------|
| **planner** | 按 [references/review-template.md](references/review-template.md) 的结构与顺序，从 spec 派生 `openspec/changes/<id>/REVIEW.mdx`；每次 spec 修订（arch-review 意见消化、用户反馈回流）后**重新生成**并更新新鲜度戳 |
| **主 Agent** | 在架构门（human-confirm 检查点）：先用 spec-hash 校验 REVIEW.mdx 新鲜，再通过 plugin-infra 的 `mdx-artifact` skill 起预览（`npm run preview -- <REVIEW.mdx 路径>`）把本地服务地址给用户、对话里同步要点摘要；收集确认/意见，意见回流 planner |

## 深度档（按变更缩放）

| 档位 | REVIEW.mdx 写什么 |
|------|------------------|
| **novel-core** | 满档：①框定 + §0 领域模型 + §1–§4 四契约 + ③审议 + ④横切（含可测场景）|
| **supporting** | 框定一两行 + 实际涉及的契约 + 关键决策 + 触发到的横切面 |
| **generic / 可逆** | 框定一行 + 仅动到的契约；§0 领域模型常可省（无新领域概念）；横切按需 |

缺席的契约/层在概览表显式标注「本变更不涉及」，保留编号、节内只写一行。

## 新鲜度戳（spec-hash）

```bash
scripts/spec-hash.sh openspec/changes/<id>/
# → 12 位十六进制，对 change 目录下的 spec 输入文件（*.md，排除 REVIEW.mdx /
#   PIPELINE.md / arch-review.md / e2e-manifest.md / e2e-report.md）做内容哈希
```

- planner 生成 REVIEW.mdx 时把输出写进头部元信息表的「Spec 版本」行；
- 架构门校验时重算比对；不一致 → REVIEW.mdx 过期，退回 planner 重新生成。
- **退出码即契约【强制】**：`spec-hash.sh` 退出非零即失败（spec 文件为空集、目录不存在、
  哈希中途出错），此时 stdout 不携带指纹、**禁止当指纹使用**——planner 写头部前、架构门比对前
  都必须先确认退出码为 0。
- 指纹覆盖 spec 输入文件的**内容与相对路径**：重命名/移动 spec 文件同样使戳失效（刻意如此）。
- 排除清单的含义：派生物与过程产物不参与指纹。管线将来新增过程产物时，脚本里的排除清单与本节要
  **同步更新**，否则该产物一变动就会误判 stale、让 planner 空转。

## 呈现（交给 mdx-artifact 渲染查看）

- REVIEW.mdx 由 **plugin-infra 的 `mdx-artifact` skill** 渲染为主题化、可交互目录、离线自包含的
  富 HTML。架构门上，主 Agent 通过该 skill 起预览（`npm run preview -- <REVIEW.mdx 路径>`）把本地
  服务地址给用户；或 `npm run render` 导出自包含 HTML 分享。对话里同步给出要点摘要。
- REVIEW.mdx 正文写 GFM markdown（表格、```sql / ```jsonc 直接可用）；图用 ```dot（模块依赖/
  架构分层，graphviz 构建期静态）与 ```mermaid（`classDiagram`/`erDiagram`/`stateDiagram-v2`/
  `sequenceDiagram`）围栏；元信息/关键决策/分节用 `<Fields>`/`<Callout>`/`<Section>` 组件——
  具体写法见 mdx-artifact 的 SKILL 与 `references/blocks.md`。
- planner **只产 `REVIEW.mdx`**（唯一的源），渲染与查看交给 mdx-artifact——避免第二份事实源与清理负担。
