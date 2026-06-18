# debug-skill Specification

## Purpose

Defines the `debug` skill shipped by the `gen-ai-development` plugin on both the Claude and Codex ends: a model-invocable, hypothesis-driven debugging skill with a Triage decision tree, three debug loops (A — log-loop, B — error-driven run-test-fix, C — CLI-debugger), mandatory tagged-probe cleanup, guardrails, and a handoff to the `tdd` skill. The skill body is byte-identical across ends and references only cross-end-common primitives.

## Requirements

### Requirement: Debug skill exists on both ends

The `gen-ai-development` plugin SHALL provide a `debug` skill at `skills/debug/SKILL.md` on both the Claude end (`claude/plugins/gen-ai-development/skills/debug/SKILL.md`) and the Codex end (`codex/plugins/gen-ai-development/skills/debug/SKILL.md`). The skill SHALL be model-invocable (not a slash command) so the agent can auto-invoke it when a bug, error, or test-failure context is detected. The skill body (everything after the frontmatter) MUST be identical between the two ends. The Claude frontmatter MAY include `color`, `model`, `memory` fields; the Codex frontmatter MUST drop all three per ADAPTING-FROM-CLAUDE.md §3.

**Byte-identical body constraint (B1)**: The skill body achieves byte-identity across ends ONLY if it never names a Claude-specific primitive. The body MUST reference solely cross-end-common primitives: the `graceful-browser` skill, the `plugin-infra` chrome-devtools MCP tools, and language-native CLI debuggers (`node --inspect`, `dlv`, `rust-lldb`/`rust-gdb`, `pdb`/`debugpy`, Dart/Flutter DevTools). The body MUST NOT name any of the following: `claude --chrome`, `mcp__claude-in-chrome__*`, `Agent`, `AskUserQuestion`, `EnterPlanMode`, `ToolSearch`. Browser handoff MUST be expressed as "invoke the `graceful-browser` skill" — never as an inline framework priority list with Claude-specific fallbacks. Note: the byte-identical invariant applies to the SKILL.md body only; the per-end frontmatter sections differ by design (Claude adds `color`/`model`/`memory`, Codex drops them). Separately, the `references/` files are also byte-identical between ends — this is a distinct invariant tracked in the `debug-stack-references` spec; a browser-rewrite in the body must not spill into the shared reference files.

**Scope of verification (B2)**: The deliverable for this spec is the existence and content-correctness of the skill artifact, not runtime agent behavior. Verification of Loop A/B/C behavior is done by asserting that the SKILL.md body prescribes the correct procedure (tagged injection, deterministic cleanup, exit-code convergence) — statically verifiable via grep/diff. Runtime loop execution during an actual debug session is NOT e2e-gated: the QA/e2e-runner agents MUST NOT attempt to build seeded-bug fixtures or run a live Loop A session to verify cleanup. They assert artifact presence and content shape only.

#### Scenario: Skill file exists on Claude end

- **WHEN** `claude/plugins/gen-ai-development/skills/debug/SKILL.md` is read
- **THEN** the file is present and its frontmatter contains `name: debug` and a `description` field

#### Scenario: Skill file exists on Codex end

- **WHEN** `codex/plugins/gen-ai-development/skills/debug/SKILL.md` is read
- **THEN** the file is present, its frontmatter contains `name: debug` and `description`, and it does NOT contain `color`, `model`, or `memory` fields

#### Scenario: Skill bodies are identical

- **WHEN** the body sections (after frontmatter delimiters `---`) of the Claude and Codex `SKILL.md` files are diffed
- **THEN** the diff is empty (byte-identical bodies)

#### Scenario: Skill body contains no Claude-specific primitives (B1 — artifact assertion)

- **WHEN** `grep -E 'claude --chrome|mcp__claude-in-chrome__|AskUserQuestion|EnterPlanMode|ToolSearch|\bAgent\b' codex/plugins/gen-ai-development/skills/debug/SKILL.md` is run (body only, after stripping frontmatter)
- **THEN** the result is empty — zero matches

#### Scenario: Browser handoff uses skill reference not inline priority list (B1 — artifact assertion)

- **WHEN** the SKILL.md body is read
- **THEN** any browser/front-end routing instruction says "invoke the `graceful-browser` skill" (or references the `plugin-infra` chrome-devtools MCP tools) and does NOT contain an inline ordered-priority list of Claude-specific browser primitives

### Requirement: Skill provides a Triage decision tree

The debug skill MUST open with a Triage section that routes the agent to the correct loop based on the symptom: Loop A for "behaviour wrong but no crash/failing test", Loop B for "non-zero exit code / failing test / build error", Loop C for "need to inspect runtime state / variable values / call stack". Front-end browser symptoms SHALL route to `graceful-browser` skill and `plugin-infra` chrome-devtools MCP rather than any loop.

#### Scenario: Triage section prescribes Loop A routing (B2 — artifact assertion)

- **WHEN** the SKILL.md body Triage section is read
- **THEN** it contains text directing the agent to Loop A when the symptom is unexpected behaviour with no failing test or non-zero exit code

#### Scenario: Triage section prescribes Loop B routing (B2 — artifact assertion)

- **WHEN** the SKILL.md body Triage section is read
- **THEN** it contains text directing the agent to Loop B when a non-zero exit code, failing test, or build error is observed

#### Scenario: Triage section prescribes Loop C routing (B2 — artifact assertion)

- **WHEN** the SKILL.md body Triage section is read
- **THEN** it contains text directing the agent to Loop C when live variable or call-stack inspection is needed

#### Scenario: Triage section prescribes graceful-browser routing (B2 — artifact assertion)

- **WHEN** the SKILL.md body Triage section is read
- **THEN** it contains text directing browser/front-end symptoms to invoke the `graceful-browser` skill or `plugin-infra` chrome-devtools MCP tools, and does not invoke new browser code from within the debug skill itself

#### Scenario: Description frontmatter names the negative mis-fire boundary (N1)

- **WHEN** the `description` frontmatter field of either SKILL.md file is read
- **THEN** it explicitly names at least one negative boundary skill that this skill should NOT replace, such as: "for running an existing test suite use `e2e-test`; for red-green test-first use `tdd`; for browser/front-end use `graceful-browser`"

### Requirement: Loop A — hypothesis-driven log-loop

The debug skill MUST provide a Loop A section prescribing: (1) form a hypothesis about the root cause; (2) inject tagged temporary probes (`// [debug:<id>]` syntax); (3) execute the reproduce command; (4) read runtime output; (5) locate root cause; (6) apply a minimal fix; (7) verify; (8) mandatory cleanup (grep tag and remove all probes). The skill SHALL reference `references/common/cleanup.md` for the tag convention and cleanup procedure.

NOTE: Runtime loop execution during an actual debug session is NOT e2e-gated (see B2 constraint above). The scenarios below are document-presence assertions — they verify the SKILL.md body prescribes the correct procedure, not that a session executed it.

#### Scenario: Loop A section prescribes tagged probe injection (B2 — artifact assertion)

- **WHEN** the Loop A section of the SKILL.md body is read
- **THEN** it contains text prescribing that probe lines MUST include the `[debug:<id>]` tag marker in the language-appropriate comment syntax, as specified in the stack-specific reference guide

#### Scenario: Loop A section prescribes mandatory cleanup (B2 — artifact assertion)

- **WHEN** the Loop A section of the SKILL.md body is read
- **THEN** it contains text prescribing that the cleanup step requires: grep for `[debug:` across the project root, remove every matching line, and confirm via `git diff` that only the real fix remains

#### Scenario: Loop A section prescribes zero-residual self-check (B2 — artifact assertion)

- **WHEN** the Loop A section or the dedicated Cleanup section of the SKILL.md body is read
- **THEN** it contains the requirement that `git diff` after cleanup must show zero lines containing `[debug:`

### Requirement: Loop B — error-driven run-test-fix

The debug skill MUST provide a Loop B section prescribing: (1) run the reproduce command; (2) capture non-zero exit code + stderr/stack trace; (3) locate the failing assertion or error in source; (4) apply a minimal fix; (5) rerun until exit code 0 or target test green. The loop SHALL NOT require manual error paste by the user — the agent reads the command output directly.

NOTE: Runtime convergence of an actual Loop B session is NOT e2e-gated (see B2 constraint above). The scenarios below verify the SKILL.md body prescribes the correct procedure.

#### Scenario: Loop B section prescribes non-zero-exit-code trigger (B2 — artifact assertion)

- **WHEN** the Loop B section of the SKILL.md body is read
- **THEN** it contains text prescribing that the loop is triggered by a non-zero exit code and that the agent reads stderr/stdout directly without asking the user to paste the error

#### Scenario: Loop B section prescribes fix-rerun convergence (B2 — artifact assertion)

- **WHEN** the Loop B section of the SKILL.md body is read
- **THEN** it contains text prescribing that the agent reruns the same command after each fix and repeats until exit code is 0 or the user interrupts

### Requirement: Loop C — CLI-debugger cognitive loop

The debug skill MUST provide a Loop C section describing agent-driven use of a CLI debugger (language-specific, per stack guide): set a breakpoint, run under the debugger, inspect variables, step through execution, read the output, hypothesise. The skill SHALL note that Loop C requires an interactive terminal and that DAP-bridge MCP integration is a future Phase-3 enhancement.

#### Scenario: Loop C section prescribes CLI debugger routing (B2 — artifact assertion)

- **WHEN** the Loop C section of the SKILL.md body is read
- **THEN** it contains text prescribing that the agent use the stack-appropriate debugger (`dlv` for Go, `rust-lldb`/`rust-gdb` for Rust, `pdb`/`debugpy` for Python, `node --inspect` for Node.js, etc.) as specified in the stack reference guide

#### Scenario: Loop C section prescribes interactive-terminal note (B2 — artifact assertion)

- **WHEN** the Loop C section of the SKILL.md body is read
- **THEN** it contains text noting that CLI debugger interaction requires a TTY and suggests falling back to Loop A in non-interactive or CI contexts

### Requirement: Cleanup is mandatory and spec'd in skill body

The debug skill body MUST contain a dedicated Cleanup section (not just a bullet in Loop A) that: (a) states cleanup is mandatory after any loop that added tagged probes; (b) provides the grep command (`grep -rn '\[debug:' <project-root>`); (c) states that `git diff` after cleanup must show zero `[debug:` lines.

#### Scenario: Cleanup section present in skill body (B2 — artifact assertion)

- **WHEN** the SKILL.md body is read
- **THEN** a `## Cleanup` (or equivalent heading) section is present, distinct from the Loop A section, containing the grep command and the zero-residual requirement

### Requirement: Guardrails section

The debug skill MUST include a Guardrails section specifying: no shotgun logging without a hypothesis; no incidental refactoring during a debug session; tag-and-cleanup is mandatory; no secrets or PII in log output.

#### Scenario: Guardrails present (B2 — artifact assertion)

- **WHEN** the SKILL.md body is read
- **THEN** a Guardrails section is present listing the four guardrails above

### Requirement: Integration — handoff to tdd after fix

The debug skill MUST include an Integration note stating that after a bug is fixed, the agent SHOULD suggest creating a regression test using the `tdd` skill to prevent recurrence.

#### Scenario: Integration handoff note present (B2 — artifact assertion)

- **WHEN** the SKILL.md body is read
- **THEN** an Integration section or note directs the agent to suggest invoking `tdd` after the fix is verified
