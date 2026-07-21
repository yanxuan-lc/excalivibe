---
name: research-pipeline
description: "The research orchestration pipeline for the main agent: clarify with the user, plan, route sub-questions to deep-research / researcher subagents / inline answers, then synthesize into docs/research/ (REPORT.mdx + PROPOSAL.md). Use whenever the user wants something researched, investigated, compared, or feasibility-checked — \"调研一下X\", \"对比A和B\", \"这个方案可行吗\", \"帮我看看这些资料\" — and for the research phase of autonomy-controller. A single hands-on probe of ONE source goes directly to research-source-code / research-data-source / research-api; this pipeline is for multi-subtask or comparative research needing clarification, routing, and synthesis."
---

# Research Pipeline — Orchestration for the Main Agent

This skill is for the **main agent**: it owns the conversation (clarifying,
confirming, following up) and the control flow of a research task. The `researcher`
subagent is a **pure execution unit** — it receives a scoped question, probes, and
returns structured findings; it never talks to the user. That split is the point:
subagents cannot ask the user anything, so everything interactive lives here.

This is the expansion of the autonomy-controller's research phase, and also stands alone
for research not attached to any development change. Output contract is unchanged:
`docs/research/<YYYY-MM-DD_HH-mm-ss>-<topic>/REPORT.mdx + PROPOSAL.md`.
- **REPORT.mdx** is the human-facing research record — MDX, presented via plugin-infra's
  `mdx-artifact` skill (`npm run preview -- <REPORT.mdx 路径>` for a local URL, or `npm run
  render` for a self-contained HTML to share); the main agent hands the user that view + a digest.
- **PROPOSAL.md** stays **Markdown** — it is the machine input to planner / `opsx:propose`,
  so it is not converted to MDX (that would break consumption).

## Step 0 — Routing (not every question deserves the ceremony)

- **Quick lookup** (one concept, one library question, one known source) → answer
  inline or fire a single researcher dispatch; skip Steps a–b entirely.
- **Real research** (feasibility, solution comparison, anything that will feed a
  spec or a decision) → walk Steps a–e.
- Resuming? If `docs/research/` already has a matching `<datetime>-<topic>/` in
  progress, read what's there before redoing anything.

## Step a — Socratic Clarification (user-facing)

Clarify the request with **AskUserQuestion**, Socratic style: one purposeful
question at a time, each driving at goals, constraints, context, or implicit
assumptions; continue until ambiguities are resolved. Don't interrogate for sport —
if the request is already clear, say so and move on.

## Step b — Conclusion Confirmation (user-facing)

Synthesize the dialogue into a structured digest and confirm it with the user
before spending research effort:

- **核心目标** — what the research must decide or enable
- **关键约束** — technical / resource / time constraints
- **上下文背景** — what shapes the solution space
- **隐含假设与已排除方向** — assumptions surfaced, directions ruled out

This digest travels with every dispatch in Step d and into the synthesis in
Step e — it is the research's contract.

## Step c — Research Plan (routing decision per subtask)

Decompose into subtasks and route each one. Produce an explicit plan table:

```markdown
| # | 子问题 | 执行方 | 方法 | 模型 | 预期产出 |
|---|--------|--------|------|------|----------|
| S-a | 业界方案盘点 | deep-research（主 agent 直接调用） | fan-out web | — | 带引用的方案清单 |
| S-b | 库 X 的内部实现确认 | researcher | research-source-code | opus | SHA 级出处的结论 |
| S-c | 现有数据量级摸底 | researcher | research-data-source | sonnet | 查询口径 + 计数 |
| S-d | 服务 Y 接口行为 | researcher | research-api | sonnet | 脱敏请求/响应样例 |
```

Routing rules:

- **Broad multi-source fact-finding / wide solution scans** → the **`deep-research`
  skill**, invoked BY THE MAIN AGENT directly (you can trigger workflows; subagents
  often can't — this is why Tier-3 no longer lives inside researcher).
  `deep-research` is an external skill, not shipped with this plugin — if it isn't
  available, degrade explicitly: split the broad question into narrower subtopics
  and dispatch them as parallel researcher investigations (each using web search /
  context7 within its scope), then note the degradation in REPORT.mdx.
- **Hands-on probing or a focused subtopic** → a **`researcher` dispatch**, naming
  the method skills it should use (research-source-code / research-data-source /
  research-api / context7 / web search).
- **Light conceptual questions** → answer inline; don't dispatch what you can
  settle yourself.
- Pick the **model per dispatch** (Agent tool `model` param): judgment-heavy
  subtopics → opus; mechanical probing → sonnet. Default: researcher's own
  frontmatter (opus).

For plans with more than a couple of subtasks, show the plan to the user briefly
before dispatching — it's their token budget.

## Step d — Dispatch (parallel)

Dispatch independent subtasks **in one message**. Each dispatch follows the task
protocol in [references/protocols.md](references/protocols.md): scoped question +
the Step-b digest + suggested methods + depth + the output schema. Researchers
return findings **inline** (they do not write `docs/research/` — parallel writers
conflict and each holds only a partial view).

## Step e — Synthesis, Follow-ups, and the Loop

1. Read every result. **Judgment stays home**: you weigh conflicting findings,
   you own the conclusion — never paste subagent output through unread.
2. Collect all `open_questions` from the results and ask the user in one batch
   (AskUserQuestion). This replaces mid-research interruptions — researchers park
   questions instead of blocking on them.
3. **Loop**: if answers or findings change the picture (a direction dies, a new
   subtopic appears via `suggested_next`), go back to Step c for a follow-up round.
   Convergence = no open questions left and the goal from Step b is answerable.
4. **Synthesize via one final researcher dispatch** (`mode: synthesize`, see
   protocols.md): input = all findings + the Step-b digest + the user's follow-up
   answers; output = REPORT.mdx + PROPOSAL.md written to
   `docs/research/<YYYY-MM-DD_HH-mm-ss>-<topic>/` (this dispatch is the one that
   writes to disk; if its write genuinely fails it returns both files inline for
   you to persist). Review and edit the drafts yourself before presenting — the
   synthesis agent didn't sit in the conversation; you did.
5. Present the user the key points and the artifact paths. If this ran as a
   autonomy-controller phase, tick the research row in PIPELINE.md with the path.

## Ground Rules

- **All user interaction happens here** — a researcher that "asked the user" in
  its final message has actually asked *you*; relay it in Step e, never answer on
  the user's behalf.
- **Provenance survives synthesis**: REPORT.mdx keeps each conclusion's grounding
  (commit SHA / query口径 / endpoint sample / cited source); anything ungrounded is
  marked inference, not fact.
- **Honesty over completeness**: dead ends and rejected directions go in the
  report; a research report that only contains what worked is half a report.
