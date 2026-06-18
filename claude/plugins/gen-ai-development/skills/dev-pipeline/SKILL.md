---
name: dev-pipeline
description: The gen-ai-development orchestration pipeline for product-code development — how the main agent routes a coding task through research → ux → propose → arch-review → apply ∥ QA → e2e ∥ code-review → merge → archive/docs, with artifact gates at each irreversible moment. Use this skill when the task builds or changes runnable product code and is substantial: a new feature, a database schema or migration, a public API or contract, a cross-module change, or a bugfix whose blast radius is high ("做个新功能", "走流程", "按 openspec 来") — or when RESUMING an in-flight change (an `openspec/changes/<id>/` directory exists, or the user says "继续 xxx"). It is NOT for non-coding work — authoring or editing skills / agents / commands / prompts (that is skill-creator's job), writing docs, or research-only tasks. The research phase has its own expansion: the companion research-pipeline skill.
---

# Development Pipeline — Orchestration for the Main Agent

This skill is for the **main agent**: it defines how to route a task through the
gen-ai-development subagents, which gates block which transitions, and where the
pipeline's state lives. The capabilities themselves (researcher, planner, developer,
quality-assurance, arch-reviewer, code-reviewer, e2e-runner, and the guideline skills)
do the work — this skill is the wiring between them.

Design philosophy: **flexible entry, rigid rails once entered.** Whether a task
enters the pipeline is the main agent's engineering judgment. Once entered, phase
order is enforced by artifact gates — not by anyone's memory.

## Step 1 — The Routing Decision (explicit, one-way)

Make this decision ONCE, out loud, at task start:

- **Simple** — single file, config tweak, small bugfix, copy change, anything where
  the blast radius is obvious and small → handle directly. No ceremony, no change
  dir, none of the gates below apply. (Guideline skills still auto-trigger as usual.)
- **Complex** — touches multiple modules, needs research or design first, changes a
  schema or a public contract, or the cost of getting it wrong is high → enter the
  pipeline: create `openspec/changes/<id>/` (via `opsx:propose` when reaching that
  phase). **The existence of that directory IS the pipeline-activated marker.**
- **Not a development task at all** — work that doesn't build or change runnable
  product code: authoring/editing skills, agents, commands, or prompts (→ owned by
  the **`skill-creator`** skill), writing docs, or research-only exploration. These
  never enter the pipeline, no matter how many files or modules they span. File
  count or "cross-end" reach alone does **not** make prompt/skill/doc editing
  "Complex" — only changes to runnable product code can be.

Rules:

- **One-way commitment 【强制】**: once a change dir exists, either walk the pipeline
  to archive or explicitly abandon the change. Never silently downgrade a half-walked
  change to "simple mode".
- **Mid-flight escalation**: if a "simple" task grows (suddenly touches a schema,
  spreads across modules), stop and enter the pipeline — create the change dir and
  backfill the checklist.
- Optional phases (research, ux-design, arch-review) are skipped at the main agent's
  discretion — but a skip is **recorded with a reason**, never silent (see Step 3).

## Step 2 — The Phase Map

```
researcher ──(opt)──▶ app-ux-design ──(opt)──▶ planner ──▶ arch-reviewer ──(opt, 裁量)──▶
        opsx:propose 产物: openspec/changes/<id>/（含人审文档 REVIEW.md）   闭环: planner 改 spec + 重生成 REVIEW.md

  ┌─ developer (opsx:apply, TDD: 业务逻辑 + 单测 + lint) ─┐
  │                                                      ├──▶  e2e-runner ∥ code-reviewer ──▶ merge → dev ──▶ archive + docs
  └─ quality-assurance (e2e 测试代码 + manifest) ─────────┘        (read-only, 同消息并行派发)        (vcs-workflow)     (docs-guideline)
```

Phase notes:

- **researcher / app-ux-design are optional inputs**, not mandatory phases. When their
  artifacts exist (`docs/research/<…>/PROPOSAL.md`, `docs/ued/<…>/`), pass the paths to
  planner — it is required to read what exists, not to demand what doesn't. When the
  research phase IS needed, run it via the **`research-pipeline`** skill (clarify →
  confirm → plan → dispatch → synthesize); its REPORT.md/PROPOSAL.md output is exactly
  what this phase's checklist row points to. (`app-ux-design` ships in the separate
  `opc-workflow` plugin — if it isn't installed, the ux phase degrades to a manual
  design doc or a `[-]` skip with reason.)
- **arch-reviewer** is discretionary: dispatch it when the spec contains DDL, a new or
  changed API surface, or cross-module boundaries. Its findings close by planner
  revising the spec — no standing checklist.
- **developer ∥ quality-assurance** start from the same confirmed spec and can be
  dispatched in the same message — but QA's work is **two-phase**, because a
  subagent runs once and returns; it cannot wait for developer:
  - **Phase 1** (parallel with developer): QA delivers what the contract alone
    supports — API tests, DB-verification queries, UI-test skeletons, and a
    **draft** manifest. UI tests are not expected to be green yet.
  - **Phase 2** (after developer delivers AND the main agent boots the app —
    the same boot duty as before e2e-runner): **continue the same QA agent**
    (SendMessage) with "app is running at <url>, finalize" — it fixes selectors
    against the real DOM, runs its suite to green, and finalizes the manifest.
  - If QA cannot reach green because the **product** is wrong, it hands off red
    tests plus a product-bug finding — that is a valid handoff (route the finding
    to developer), not a QA failure.
- **e2e-runner ∥ code-reviewer** are both read-only — always dispatch them in one
  message. Pass code-reviewer `mode: incremental` explicitly. Before dispatching
  e2e-runner, the main agent boots the app and dependencies (project Makefile /
  run entry) and confirms reachability — e2e-runner validates a running system,
  it never boots one.
- **Automation-coverage escalation 【强制】**: before booting + dispatching
  e2e-runner, read the finalized QA manifest and compute the non-scripted set
  (agent-driven + non-automatable). If it crosses the threshold — **`> 5` scenarios
  or `≥ 20%` of M** — do not let e2e-runner grind through a long, costly agent-driven
  pass silently. **Ask the user** (subagents can't), presenting per non-scripted
  scenario why it isn't scripted, and offer a class-aware menu — *manual* (user
  verifies by hand and reports evidence, incl. the DB write) / *agent-driven (LLM
  auto)* / *waive*; non-automatable scenarios offer only *manual* / *waive*. Record
  each decision in PIPELINE.md (`manual:` / `waived:`) before dispatching. Full
  contract: [references/e2e-manifest.md](references/e2e-manifest.md). (Below the
  threshold, skip the ask — agent-driven runs automatically.)
- **Fix loop (convergence protocol)**: e2e failures classified "product bug" route
  to developer; "test bug" route to quality-assurance; review findings route **by
  code ownership** — findings on product code → developer, findings on e2e test
  code → quality-assurance (the reviewed diff contains both). Run the loop in
  rounds, not per-finding:
  1. Batch all fixes from BOTH reports into one round; land them as commit(s).
  2. Re-dispatch in one message: code-reviewer (fix diff only, **pass it the
     existing report directory** so it updates CHECKLIST statuses in place instead
     of opening a new one) ∥ e2e-runner (re-run = full scripted suite — it's
     zero-LLM, don't ration it — plus only the agent-driven scenarios that failed
     or whose flows the fixes touched).
  3. Both artifacts are re-stamped with the current commit. **Any code change
     invalidates both verdicts** — a green e2e report from before a review fix is
     stale evidence, and vice versa.
  4. Repeat until a round produces no new findings and no new failures.
- **merge → dev** follows the vcs-workflow skill; the gate below must hold first.
- **archive + docs**: after merge, run `openspec archive` and curate documentation
  per the docs-guideline skill. The pipeline is not done at merge.

## Human Checkpoint — the Four Contracts 【强制】

Exactly one human review is mandatory in the pipeline, placed where it has the most
leverage: **after arch-review closes, before dispatching developer ∥ QA**. Present
the user the four contracts from the spec — the things that are expensive to change
later and whose correctness only the user can judge:

1. **Project structure & module design** — the module decomposition (delta for an
   existing project; the full layout for a greenfield one). This is where the
   user's and the agents' understanding of the business must match.
2. **Protocol** — the external surface: RESTful API / RPC / event contracts. What
   capability is being promised to the outside.
3. **Database design** — what data is stored, in what shape; whether it can be
   extended later without migration pain.
4. **Use cases** — the requirement scope and the e2e scenarios (`S1/S2/…`). The
   user signing these off IS the definition of done: these scenarios passing means
   acceptance.

Rules:

- **The checkpoint's carrier is `openspec/changes/<id>/REVIEW.md`** — the
  human-review document planner derives from the spec per the **`spec-review`**
  skill. Before presenting: re-run the skill's `scripts/spec-hash.sh` and compare
  with the header stamp — stale means the user would be confirming an old design;
  send planner to regenerate first. Then give the user the REVIEW.md file path to
  read directly (IDE preview / Git platform render GFM and Mermaid fine) and give
  a short digest in conversation alongside. A contract absent from this change
  (no schema, no new API) is marked absent in REVIEW.md's overview table, not
  padded.
- User feedback on REVIEW.md routes to planner as spec revisions, after which
  REVIEW.md is regenerated — never edited in place. Downstream agents
  (developer / quality-assurance) read the spec, never REVIEW.md.
- Record the confirmation as the `spec-confirm` row in PIPELINE.md. **developer and
  quality-assurance are not dispatched while it is unchecked.**
- If a fix loop or arch-review round later changes any of the four contracts
  materially, the checkpoint reopens — planner regenerates REVIEW.md and the user
  re-confirms the changed contract only.
- Everything else stays machine-judged: the merge gate is mechanical (report the
  evidence digest to the user, don't block on a signature), and the outward
  boundary keeps its existing hard gate — vcs-workflow never pushes, and nothing
  publishes, without an explicit user request.

## Step 3 — Pipeline State (PIPELINE.md)

Track phase status in `openspec/changes/<id>/PIPELINE.md` so any session can resume
without relying on conversation memory. Create it when the change dir is created;
backfill phases that happened before activation (research, ux).

```markdown
# Pipeline — <change-id>

ultracode: off   （Claude-only 可选；on 时在对应相位行记录被包裹片段的 runId，如 code-review → … (wf_…)）

- [x] research      → docs/research/2026-06-11_10-00-00-topic/
- [-] ux-design     （跳过：纯后端，无 UI 面）
- [x] propose       → openspec/changes/<id>/
- [x] arch-review   意见已消化进 spec（或 [-] 跳过：无 DDL / 新接口）
- [ ] spec-confirm  用户确认四件套（直接查看 REVIEW.md）：模块 / 协议 / 库表 / 用例（缺席项注明）
- [ ] apply         developer：单测 ✅ 覆盖率 ≥80% lint ✅
- [ ] qa            quality-assurance → e2e-manifest.md（Phase 1 草稿 / Phase 2 定稿）
- [ ] e2e           e2e-runner → e2e-report.md（全绿，executed + manually-verified + waived = M）
- [ ] code-review   → docs/code-review/<datetime>/（CHECKLIST P0/P1 全部 Resolved）
- [ ] merge → dev
- [ ] archive + docs

manual: （无；或 S3 — 用户手动验证：下单后 orders 表新增 1 行、库存 -1）
waived: （无；或 S5 — 依赖第三方扫码回调，用户已豁免）
```

- `[x]` done (with artifact pointer) · `[-]` skipped **with reason** · `[ ]` pending.
- Update it at every phase transition. On resume, read it first — it outranks memory.

## Step 4 — Gates (what blocks what)

| Moment | Gate | Checked how |
|--------|------|-------------|
| developer starts | spec exists and is complete | developer's own pre-flight (`openspec/changes/<id>/`) |
| e2e-runner dispatched | app/deps running and reachable | main agent boots them first |
| **merge → dev** | review CHECKLIST P0/P1 all Resolved **and** e2e report on disk, all green, coverage executed + manually-verified + waived = M, both fresh (commit == HEAD) | main agent + vcs-workflow's proactive catch |
| archive | merge landed | then docs-guideline curation |

Gate details and exact artifact checks: [references/gates.md](references/gates.md).
The e2e manifest contract between quality-assurance and e2e-runner:
[references/e2e-manifest.md](references/e2e-manifest.md).

## Delegation Discipline

- **Parallel-first**: independent subagent dispatches go in one message
  (developer ∥ QA; e2e-runner ∥ code-reviewer).
- **Judgment stays home**: subagent outputs are inputs to the main agent's decision,
  not verdicts to forward blindly. Read the key artifacts yourself before acting.
- **Subagents can't talk to the user**: if a subagent returns questions instead of
  results, relay them to the user verbatim and continue the same agent with the
  answers — never answer on the user's behalf.

## Ultracode Mode (optional, Claude-only)

An optional acceleration: when the user explicitly opts in, the main agent **may** run
certain deterministic, no-human segments via the Workflow tool (scripted fan-out / loop)
instead of plain "dispatch in one message". **Off by default** — the default path is the
unchanged model-driven dispatch, identical to the Codex side, and ultracode never changes
the canonical phase order, gates, or artifacts (only *how* a marked segment runs).

Before reaching for it, read [references/ultracode-mode.md](references/ultracode-mode.md):
the opt-in gate (why it is a user-gated **MAY**, not an imperative), the wrap / no-wrap
boundary rule and per-segment table, the `ultracode:` PIPELINE.md row, and the write-back
+ resume rules.
- **What may be wrapped, what may not, and why** — the boundary rule, the per-segment
  allow/deny table, write-back + resume-layer rules, and the dual-end note:
  [references/ultracode-mode.md](references/ultracode-mode.md).
