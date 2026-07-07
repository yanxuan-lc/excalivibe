# Issue: e2e-runner stops mid-run to "wait for background commands"

Status: FIXED 2026-07-06 (same day) — all four recommended changes applied: e2e-runner.md
gained the "Execution model (single-run agent — HARD RULES)" section + completion contract;
developer.md / e2e-author.md gained the condensed paragraph; e2e-test SKILL.md gained the
cross-reference line.
2026-07-07: synced to the Codex scaffold (same trap, same root cause — single-run subagents):
codex/agents/{e2e-runner,developer,e2e-author}.toml + codex .../e2e-test/SKILL.md cross-ref,
with tool-agnostic wording (no Bash-tool / 600000 ms specifics) per ADAPTING-FROM-CLAUDE §3.
Committed on dev.
Originally: reported 2026-07-06 · Owner: gen-ai-development plugin maintainer agent
Affected: `agents/e2e-runner.md` (primary), `agents/developer.md` / `agents/e2e-author.md` (preventive), `skills/e2e-test/SKILL.md` (cross-reference only)

## Symptom

During two real dispatches on 2026-07-06 (project: unreal, changes `fix-tui-toolcall-toggle-garble`
and `langfuse-config-surface`), the e2e-runner agent repeatedly launched its long test commands
(`make check`, full-workspace `cargo test`) **in the background and then ended its run** with final
messages like:

> "Standing by for the make check background task to finish."
> "I'll wait for that notification now rather than polling."
> "Waiting for the workspace regression suite to finish (background monitor armed); will proceed
> to finalize the report once it reports back."

It did this **three times across two dispatches**, each time requiring the controller (main agent)
to notice the stall and re-dispatch it with a resume message before the acceptance report
(`e2e-report.md`) got written. No work was lost, but each stall cost a full round-trip and blocked
the merge gate.

## Root cause

Two factors compound:

1. **Execution-model mismatch with the generic Bash tool's hint.** The Bash tool's
   `run_in_background` affordance says "you will be notified when it completes." That is true for
   a persistent main session, but FALSE for a subagent: a subagent is single-run — the moment it
   ends its run it is terminated, and no notification can wake it. Only the caller can resume it.
   The e2e-runner is the one role whose core job is 5–10 minute commands (full-workspace test,
   make check), so it is structurally the role most tempted by this trap.

2. **The agent definition carries no execution-model constraint.** Keyword audit on 2026-07-06:
   `agents/e2e-runner.md` and `skills/e2e-test/SKILL.md` contain ZERO occurrences of
   background/synchronous/timeout/wait rules. Nothing in the system-prompt layer counters the
   tool hint.

**Evidence that per-dispatch instructions are insufficient:** on the second dispatch the
controller explicitly wrote "work synchronously — do not launch long background commands and stop
to wait for notifications" in the task prompt, and the agent still stalled the same way. The
constraint must live in the agent definition (system-prompt layer), where it does not decay
against the tool hint, not in per-task prompts.

## Recommended changes

### 1. `agents/e2e-runner.md` — add an "Execution model" section (REQUIRED)

Hard rules, verbatim intent:

- You are a single-run agent. Ending your run means termination; no notification mechanism can
  wake you. NEVER end your run before your deliverables (e2e-report.md + verdict, PIPELINE.md row
  tick) exist on disk.
- Run long commands in the FOREGROUND with an explicit large timeout (the Bash tool accepts up to
  600000 ms — a full workspace test fits).
- A command expected to exceed 10 minutes must be split into smaller batches (e.g. per-crate test
  runs) instead of gambling on one timeout.
- If you do start a background command, you must poll its output file in a loop WITHIN THE SAME
  RUN until it completes. Stopping "to wait for a notification" is never valid.

### 2. `agents/e2e-runner.md` — add a completion contract (REQUIRED)

Your final message must contain the gate verdict. Being about to end your run while the report
file does not yet exist is itself a failure state: do not stop — continue executing until it does.

### 3. `agents/developer.md`, `agents/e2e-author.md` — condensed version of rule 1 (RECOMMENDED)

Both roles also run long builds/tests; they simply have not tripped over this yet. One short
paragraph (single-run agent + foreground-with-timeout + poll-in-run) suffices.

### 4. `skills/e2e-test/SKILL.md` — cross-reference only (RECOMMENDED)

Do NOT duplicate the rules into the skill; add one line pointing at the agent definition's
Execution model section. Duplicated rules drift.

## Acceptance for the fix

- Keyword audit of `agents/e2e-runner.md` finds the four hard rules + completion contract.
- A dispatched e2e-runner on a workspace whose full test run takes ≥5 minutes produces its
  commit-stamped report in a single run, with zero controller resume messages.
