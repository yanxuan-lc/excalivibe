# Ultracode Mode — Optional Workflow Acceleration (Claude-only)

Ultracode mode lets the main agent execute **certain deterministic, no-human pipeline
segments** through the Workflow tool (scripted fan-out / loop / structured output)
instead of plain "dispatch the subagents in one message". It is an **optional overlay**:
when it is off — the default — the pipeline runs exactly as it does without this file,
and identically to the Codex side. Enabling it changes only the *execution mechanism*
of the marked segments, never the phase order, the gates, or the artifacts.

This is the **存异** half of 求同存异: Workflow is a Claude-exclusive primitive, so *how*
Claude runs a fan-out may differ from Codex — but the main process stays **求同**.

## When ultracode is active (the gate)

- **Default OFF.** The canonical path is model-driven dispatch. Treat ultracode as a
  capability you may reach for, not a mode you fall into.
- **One session-scoped decision, surfaced once.** Offer the choice **only at pipeline
  start**, and only on a genuine **user signal**: they wrote "ultracode" this turn, or
  session ultracode is on. You *may also* surface the same one-time offer when the task
  is plainly heavy/long-running — but that stays an **offer the user answers**, never
  self-activation (the heaviness is your read, not the user's opt-in). Otherwise default
  OFF **silently** — do not add an ultracode prompt to every run.
- **Why gated this strictly.** dev-pipeline auto-triggers on most development tasks, and
  one of the Workflow tool's opt-in paths is "the user invoked a skill whose instructions
  tell you to call Workflow." An *unconditional* "use Workflow" written here would
  therefore switch ultracode on for **every** flow — inflating cost and silently drifting
  Claude's behavior away from Codex. The gate is what keeps default behavior identical
  across both ends. So this whole file describes a **user-gated MAY**, never an imperative.
- **Record the decision** as the `ultracode:` row in PIPELINE.md (`on` / `off`) — this
  logs the user's stated *preference* plus the runId trail. It does **not** by itself
  authorize a resumed session to call Workflow: file content is not an opt-in signal
  (the same reason the gate above is a MAY, not an imperative). Within the original
  session the opt-in already holds, so no re-ask. A **new** session resuming on
  "继续 xxx" has no live signal — read `on` as "the user wanted this before, re-offer
  it", and absent a fresh signal fall back to the default model-driven path (the safe
  side). The row spares you re-deliberating intent; it never stands in for authorization.
- **The decision toggles mechanism only.** It never removes or relaxes a gate or a human
  checkpoint. spec-confirm and the automation-coverage escalation still happen; the merge
  gate's checks are unchanged.

## The boundary rule (the spine)

> A Workflow may wrap any **contiguous** segment that needs **neither (a) user
> interaction nor (b) a main-agent-only action**. Every such touchpoint is a hard
> boundary that ends a wrappable segment.

Main-agent-only actions are **not just sign-offs** — they include **booting the app +
probing reachability** and **git merge / push / publish**. A subagent (and therefore a
Workflow agent) cannot talk to the user, cannot boot and own the app process, and must
never push or publish. Wherever one of those is required, the wrappable segment stops.

## What may be wrapped, what may not

| Segment | Wrap? | Why |
|---------|-------|-----|
| **code-review gate** | ✅ | Read-only once dispatched; benefits from dimension fan-out (correctness / security / perf / maintainability) + adversarial verify (N skeptics per finding, majority-refute kills it). Writes the normal CHECKLIST. |
| **fix-loop, review side** | ✅ | The "repeat until no new findings" convergence is a natural loop-until-dry over re-review rounds. |
| **research, single-round fan-out** | ✅ | Parallel `investigate` dispatch + the terminal `synthesize` dispatch within one round — pure executor calls, no user contact. |
| spec-confirm four contracts | ❌ | **User** decision (the one mandatory human checkpoint). |
| automation-coverage escalation | ❌ | **User** decision (manual / agent-driven / waive, per scenario). |
| boot app + probe reachability | ❌ | **Main-agent-only**; precedes e2e-runner. |
| merge / push / publish | ❌ | **Main-agent-only** outward boundary. |
| developer ∥ quality-assurance | ❌ | QA is two-phase: Phase 2 **continues the same QA agent instance (SendMessage)** after the main agent boots the app. A Workflow-spawned `agent()` can't be continued by the main agent once the Workflow has returned, so wrapping Phase 1 would **strand that instance** (Phase 1 itself returns fine — the problem is the later continuation). The boot between the phases is also a hard boundary. |
| the whole e2e pass | ❌ | Sliced by the boot touchpoint and the escalation ask; only sub-segments qualify. |

**Loop nuance.** Both the research convergence loop and the e2e fix loop cross
user/boot touchpoints *between* rounds (research feeds back on the user's answers to
batched `open_questions`; each e2e round may need a re-boot). Only the contiguous
fan-out *within a single round* is wrappable — the loop control that depends on a user
answer or a re-boot stays with the main agent.

## After a wrapped segment finishes

- **Judgment stays home (理解不外包).** Read the produced artifacts yourself before acting.
  A Workflow's structured output is an *input* to your decision, not a verdict to forward
  unread — the same rule that already governs subagent results.
- **Write back to the normal artifacts.** The durable record the gates consume is
  unchanged: code-review `CHECKLIST.md`, `e2e-report.md`, research `REPORT.md` /
  `PROPOSAL.md`. Ultracode changes how a segment is *run*, never *what artifact it
  produces*.
- **Leave a trail.** Note the segment's Workflow `runId` on its PIPELINE.md phase row
  (e.g. `code-review → docs/code-review/<dt>/  (wf_…)`). This is the audit trail and lets
  a same-session resume reuse the Workflow journal.

## Two resume layers (complementary, not competing)

- **PIPELINE.md** — the cross-session, cross-phase **source of truth**. Read first on
  resume; it outranks memory and outranks any journal.
- **Workflow journal** — intra-segment, same-session resume of a *single* fan-out (via
  `resumeFromRunId`). It accelerates re-running one wrapped segment; it does not track
  pipeline phase state and never replaces PIPELINE.md.

## Scope guardrail (求同存异)

Ultracode is a **Claude-only execution-mechanism overlay**. The hard constraint: it
changes only *how* the marked segments run — never the canonical pipeline (phase order,
the four gates, the artifact set), which stays identical to the Codex build. With
ultracode off (the default), the two ends behave identically. Do not import any Workflow
surface into the Codex plugin.

(Why this change is Claude-only, and whether/how a Codex counterpart could be built, is a
maintainer concern — recorded in the change's commit message and project notes, not here;
a runtime agent doesn't need it.)
