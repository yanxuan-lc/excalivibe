---
name: debug
description: "Hypothesis-driven debugging for bugs, errors, and test failures across 8 stacks (React, React Native, Flutter, Go, Rust, Tauri, Node.js, Python). Use when a bug, crash, non-zero exit, or unexpected behaviour appears during development and you need a structured investigation loop. Do NOT use as a substitute for: running an existing test suite (use `e2e-test`); red-green test-first development (use `tdd`); front-end or browser-level inspection (use `graceful-browser`)."
---

# Debug Skill

A structured, hypothesis-driven debugging workflow with deterministic cleanup. Three loops cover the dominant debug scenarios; pick the one that matches the symptom.

## Stack Routing

Before starting, identify the language/stack in play and open the corresponding reference guide for probe syntax, run commands, and debugger invocation:

| Stack | Reference |
|---|---|
| React | [references/react/guide.md](references/react/guide.md) |
| React Native | [references/react-native/guide.md](references/react-native/guide.md) |
| Flutter / Dart | [references/flutter/guide.md](references/flutter/guide.md) |
| Go | [references/go/guide.md](references/go/guide.md) |
| Rust | [references/rust/guide.md](references/rust/guide.md) |
| Tauri 2.0 | [references/tauri/guide.md](references/tauri/guide.md) |
| Node.js | [references/nodejs/guide.md](references/nodejs/guide.md) |
| Python | [references/python/guide.md](references/python/guide.md) |

For the `[debug:<id>]` tag convention and cleanup procedure, see [references/common/cleanup.md](references/common/cleanup.md).

## Triage — Choose a Loop

Read the symptom, then route to the correct loop:

| Symptom | Loop |
|---|---|
| Behaviour is wrong but there is no crash, no failing test, and no non-zero exit code | **Loop A** — hypothesis-driven log-loop |
| A test fails, the build exits non-zero, or stderr shows an error / stack trace | **Loop B** — error-driven exit-code convergence |
| Variable values, call stack, or runtime state need direct inspection at a specific code point | **Loop C** — agent-driven CLI-debugger cognitive loop |
| Symptom is in the browser: wrong rendering, network issue, console error in the live app | **graceful-browser** — invoke the `graceful-browser` skill; do not attempt to debug browser symptoms in this skill |

> When in doubt between Loop A and Loop B: if there is a non-zero exit code or a failing test, always start with Loop B — it gives the most direct signal.

---

## Loop A — Hypothesis-Driven Log-Loop

Use when the behaviour is wrong but no test or exit-code signal points to the cause.

### Steps

1. **Form a hypothesis.** State the suspected root cause in one sentence before adding any probes. Do not add logging without a hypothesis.

2. **Choose a session id.** Pick a short kebab-case identifier for this session (e.g., `null-ref-login`). All probes for this session use the same `[debug:<session-id>]` tag.

3. **Inject tagged probes.** Add log statements at the locations your hypothesis predicts will be informative. Use the language-idiomatic probe form from the stack reference guide with the `[debug:<session-id>]` tag on the same line. See [references/common/cleanup.md](references/common/cleanup.md) for the exact tag syntax per language.

4. **Execute the reproduce command.** Run the command that triggers the bug (from the stack reference guide). Read the output in full.

5. **Read runtime data.** Analyse the probe output against your hypothesis. Either the hypothesis is confirmed (proceed to step 6) or refuted (revise and repeat from step 1 with a new hypothesis — do not pile on more probes without a revised hypothesis).

6. **Locate the root cause.** Identify the exact file, line, and variable or logic path responsible.

7. **Apply a minimal fix.** Change only what is necessary to correct the root cause. No incidental refactoring.

8. **Verify.** Re-run the reproduce command. Confirm the symptom is gone. If a test exists for this behaviour, confirm it passes.

9. **Mandatory cleanup.** See the [Cleanup section](#cleanup) below. This step is not optional.

---

## Loop B — Error-Driven Exit-Code Convergence

Use when a non-zero exit code, failing test, or build error is the signal.

### Steps

1. **Run the reproduce command** (from the stack reference guide). Capture stdout and stderr in full. Do not ask the user to paste the error — read the command output directly.

2. **Read the exit code and stderr.** Identify: the failing test name or build target; the assertion message or error type; the file:line where the failure occurred.

3. **Locate the failing assertion or error in source.** Open the file at the reported line. Understand the gap between what the code does and what the test or caller expects.

4. **Apply a minimal fix.** Change only what is needed to satisfy the failing assertion or resolve the error.

5. **Rerun the command.** If exit code is 0 and all targets pass, the loop is complete. If non-zero, read the new output and repeat from step 3 with the updated information.

> The convergence criterion is exit code 0 (or the user explicitly interrupts). Do not stop at "most tests pass" — every non-zero is a failure still requiring a fix.

---

## Loop C — CLI-Debugger Cognitive Loop

Use when you need to inspect live variable values, the call stack, or execution flow at a specific code point that cannot be inferred from log output alone.

### Steps

1. **Select the stack-appropriate debugger** from the stack reference guide:
   - Go → `dlv` (Delve)
   - Rust → `rust-lldb` / `rust-gdb`
   - Python → `pdb` / `debugpy`
   - Node.js → `node --inspect` / `node --inspect-brk`
   - Dart / Flutter → Dart DevTools / Observatory
   - React Native → Hermes inspector / React Native DevTools

2. **Set a targeted breakpoint** at or near the suspected location (identified via Loop A hypothesis or Loop B error line). Avoid scattering breakpoints without a hypothesis.

3. **Run under the debugger** using the command from the stack reference guide.

4. **Inspect state.** At the breakpoint, examine: local variables, the call stack, and the values of any expressions your hypothesis depends on.

5. **Step through execution** (step over / step into) to observe how state changes at each line.

6. **Form or confirm the hypothesis.** Use the observed values and call stack to identify the root cause.

7. **Quit the debugger** and apply a minimal fix.

8. **Verify** by re-running the reproduce command (Loop A/B style) without the debugger.

> **Interactive terminal required.** CLI debuggers (`dlv`, `rust-lldb`, `pdb`) require a TTY. In headless or CI environments, Loop C is not available. Fall back to Loop A (tagged log probes) instead.

> **Phase-3 note.** DAP-bridge MCP integration (enabling breakpoint debugging without an interactive TTY) is a future enhancement. It is not available in the current version of this skill.

---

## Cleanup

**Mandatory after any loop that added tagged probes.**

1. Run the grep command from the project root:

   ```bash
   grep -rn '\[debug:' <project-root>
   ```

2. For every file and line reported, open the file and delete the tagged line(s).

3. Save each modified file.

4. Run the self-check:

   ```bash
   git diff | grep '\[debug:'
   ```

   The result MUST be empty. Any remaining `[debug:` line means the probe was not fully removed — repeat the removal.

See [references/common/cleanup.md](references/common/cleanup.md) for language-specific comment wrapper forms and the full cleanup procedure.

---

## Guardrails

- **No probe without a hypothesis.** Every `[debug:...]` line you add must correspond to a stated hypothesis about what it will reveal. Shotgun logging (adding probes everywhere without a hypothesis) is prohibited.
- **No incidental refactoring.** During a debug session, change only what is necessary to fix the bug. Do not clean up unrelated code, rename variables, or restructure modules.
- **Tag-and-cleanup is mandatory.** Every probe added during a session MUST be tagged and MUST be removed via the cleanup procedure before the session ends. Leaving tagged probes in the codebase is a violation.
- **No secrets or PII in log output.** Do not log passwords, tokens, private keys, or personally identifiable information. If the bug requires inspecting sensitive data, use the CLI debugger (Loop C) with in-process inspection instead of emitting to stdout/stderr.

---

## Integration — After the Fix

Once the fix is verified and cleanup is complete:

- If no regression test existed for this bug, suggest creating one using the `tdd` skill. A confirmed bug with no test coverage is likely to regress.
- If the fix touches a behaviour already covered by a test, confirm that test still passes.
- If the fix reveals a design issue (not just a coding error), note it as a follow-up and keep the fix minimal.
