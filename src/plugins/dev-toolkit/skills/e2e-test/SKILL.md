---
name: e2e-test
description: Execute end-to-end tests against a running application and verify both what the interface shows and what actually landed in the database — Playwright, Detox, flutter drive, tauri-driver. A green UI assertion sitting on top of a row that was never written is a false pass, and catching that is the whole point. Use when acceptance has to be checked against a real running app, on "run the e2e tests", "verify this flow end to end", "does signup actually work", or when a scenario must be walked by hand because no test code covers it yet. The app has to be up first — this skill does not build or deploy it.
description-claude: Execute end-to-end tests against a running application and verify both what the interface shows and what actually landed in the database — Playwright, Detox, flutter drive, tauri-driver. A green UI assertion sitting on top of a row that was never written is a false pass, and catching that is the whole point. Use when acceptance has to be checked against a real running app, on "run the e2e tests", "verify this flow end to end", "does signup actually work", or when a scenario must be walked by hand because no test code covers it yet. The app has to be up first — this skill does not build or deploy it.
description-codex: Execute end-to-end tests against a running application and verify both what the interface shows and what actually landed in the database — Playwright, Detox, flutter drive, tauri-driver. A green UI assertion sitting on top of a row that was never written is a false pass, and catching that is the whole point. Use when acceptance has to be checked against a real running app, on "run the e2e tests", "verify this flow end to end", "does signup actually work", or when a scenario must be walked by hand because no test code covers it yet. The app has to be up first — this skill does not build or deploy it.
---

# End-to-End Testing

This skill **runs** end-to-end tests and **verifies their effects**. It assumes the application/service under test is already running. Test suites are executed when they exist; scenarios that no suite covers can be executed **agent-driven** (mode 3) — either way, your job is to confirm the outcome reached both the interface and the database.

An end-to-end test is only trustworthy if you check *both* halves of the result:

1. **The observable result** — what the GUI shows, or what the API returns.
2. **The persisted result** — what actually landed in the database.

A green UI assertion with no row in the table is a false pass. Always verify the write.

> Long-running suites: run them in the FOREGROUND with an explicit, generous timeout, and split
> anything longer into batches. Background a command only to overlap it with other useful work, and
> then read its **recorded exit code** (`cmd > log 2>&1; echo EXIT=$? >> log`) rather than a
> `tail`/`grep` pipe, which swallows it. Never stop and wait for a notification, and never call a
> slow suite hung from a process-table glance — compiler and browser gaps look identical to death.

## Three Test Modes

Pick the mode from the request; a task may mix them (e.g. run the scripted suite for covered scenarios, agent-drive the rest, assert the DB for all).

| Mode | Starts from | Asserts | Reference |
|------|-------------|---------|-----------|
| **GUI-driven full-functional** (scripted) | An existing suite driving the real UI | UI/functional result **+ DB writes** | the matching platform file below |
| **API-only** (scripted) | A direct endpoint call | Response value/status **+ DB writes** | [references/api-e2e.md](references/api-e2e.md) |
| **Agent-driven scenario execution** | A scenario description (WHEN/THEN steps) with no covering test code | UI observations **+ DB writes** | the section below |

Database verification applies to **all** modes — see [references/db-verification.md](references/db-verification.md).

### Agent-Driven Mode

For scenarios no suite covers (no e2e infrastructure yet, or gaps declared in a QA
manifest), execute the scenario live:

1. **Pick the framework via the `graceful-browser` skill**:
<!--@claude-->
   claude --chrome first, then the chrome-devtools MCP, then the Playwright
   MCP. If graceful-browser isn't installed, probe those tool families directly in
   the same priority order.
<!--@codex-->
   Codex's native browser (`@Chrome` / `@Browser`) first, then the
   chrome-devtools MCP, then the Playwright MCP. If graceful-browser isn't installed,
   probe those tool families directly in the same priority order.
<!--@end-->
2. Execute the scenario's WHEN steps one by one against the running app; assert each
   THEN observation (page state, visible text, navigation) as you go.
3. Verify the DB writes exactly as in the scripted modes.

Cost discipline: every agent-driven step is an LLM (often multimodal) call —
**never use this mode for a scenario that scripted tests already cover**, and when a
scenario set is stable enough to re-run often, recommend investing in scripted tests
instead. Failed scripted tests may be reproduced agent-driven for diagnosis, but the
scripted result stands.

<!--@claude-->
Keep each step cheap and fast: prefer a **text read** (`read_page` / get-page-text)
over a screenshot for assertions, **batch** an action with its observation where the
tool allows, and **wait on a condition** (element/text appears) rather than a fixed
<!--@codex-->
Keep each step cheap and fast: prefer a **text read** (get-page-text) over a
screenshot for assertions, **batch** an action with its observation where the tool
allows, and **wait on a condition** (element/text appears) rather than a fixed
<!--@end-->
sleep — fixed sleeps are the main reason an agent-driven pass feels slow. When this
mode is being invoked under the flow and a *large fraction* of scenarios
would need it (the threshold: non-scripted `> 5` or `≥ 20%`), that is a
signal to **escalate to the user** rather than grind through — this `> 5` / `≥ 20%`
threshold is the ceiling a scripted-suite author is held to, and it is a decision for a person
rather than something to grind through.

## Platform Routing (GUI mode)

The client stack varies per project, so load only the reference for the stack actually in play. Detect it first (see Workflow step 2), then read one file:

| Client | Stack | Reference |
|--------|-------|-----------|
| Web (browser) | Playwright | [references/web-playwright.md](references/web-playwright.md) |
| Flutter (Android/iOS, real device or emulator) | `integration_test` + `flutter drive`, ADB | [references/flutter-integration-test.md](references/flutter-integration-test.md) |
| React Native (Android/iOS, emulator or simulator) | Detox (gray-box, Jest runner) | [references/react-native-detox.md](references/react-native-detox.md) |
| Tauri (desktop) | `tauri-driver` + WebdriverIO | [references/tauri-webdriverio.md](references/tauri-webdriverio.md) |

Don't load all of them — read the one that matches the project. If a project ships its own e2e runner that differs from these defaults, follow the project's runner and use the reference only for the concepts.

## Workflow

### 1. Determine scope and mode
Clarify what's being tested (a flow / a feature / a specific suite or file), which **mode** (GUI vs API vs both), and for GUI which **client platform**. If the request implies a DB check ("make sure it really persisted", "data persisted"), plan the verification queries up front.

### 2. Discover the project's e2e setup — don't assume
Read the project before running anything. Look for:
- **Config / runner**: `playwright.config.*`, `wdio.conf.*`, `integration_test/`, `test_driver/`, `pytest.ini`/`pyproject.toml`, `*_test.go`, `hurl`/`newman` files.
- **Existing scripts**: `package.json` `scripts` (`test:e2e`, `e2e`), a `Makefile` target, `pubspec.yaml` dev_dependencies.
- **How the app is reached**: base URL, ports, device IDs — usually in env or a `.env`/config.
- **DB access**: the connection string in env (see db-verification.md for the variable names checked).

Prefer the project's **existing command** for running the suite over a hand-built one. The references tell you how to read/parameterize that command, not to replace it.

### 3. Confirm preconditions
Before executing, verify (and report clearly if any fails — do not silently proceed):
- The app/service under test is **running, reachable, and is actually the system under test**
  (the skill does not boot it unless the user asks). An open port is not the check: on a
  developer's machine several projects' services are usually up at once, and a TCP connect or
  even an HTTP response only proves *something* is listening. Confirm identity — a known
  endpoint of *this* app returns the expected status **and** recognisable content (`/healthz`
  naming the service, a known route rendering, the API's version payload). Port 8080 answering
  with someone else's Nacos console is a failed precondition, not a reachable app.
- For GUI: the target is available — a browser for Playwright, a connected device/emulator for Flutter (`adb devices` / `flutter devices`), a built debug binary + a booted simulator/emulator for React Native (Detox), the built debug binary + a running `tauri-driver` for Tauri.
- The database is reachable with the env connection string, and you're pointed at a **test/staging** database — never production.

### 4. Run the suite
Execute via the platform/API reference. Capture full output (and machine-readable reporter output where available — JSON reporters, JUnit XML). Scope to the requested feature when the runner supports filtering (`-g`/`--grep`, a test path, a tag) rather than always running everything.

**Fix rounds are scoped — in the fixing loop.** While iterating on a fix, re-run only the previously-failed specs (`--last-failed`, a title/tag filter, the failing file) — not the whole suite. One full confirmation run happens at the end, once, and is what the report records; when this skill is invoked as the acceptance pass, that full run IS the pass — run it once directly. In every case, reuse a build already produced at the current commit (by the developer role or a prior round) instead of rebuilding the binary under test.

### 5. Verify database writes
After the run (or after the specific action), follow [references/db-verification.md](references/db-verification.md): query the affected tables with the env connection, assert the rows/columns the feature should have written, and account for our conventions (e.g. logical delete via `is_deleted`, `created_time`/`updated_time`) — cross-check schema expectations against the `dba-guideline` skill. Allow for async writes (poll/wait rather than asserting instantly).

### 6. Analyze and report
Classify every non-pass into one of **three** buckets, not two:
- **product bug** — the app did the wrong thing. The suite ran and the result is real.
- **test bug / infra** — flaky selector, stale fixture, broken harness. The suite ran; the
  result says nothing about the product.
- **precondition not met** — the suite **did not run at all** (app unreachable, no device, DB
  identity unconfirmed, no suite exists). There is no result to interpret. This is the bucket
  that gets lost when only the first two exist, and losing it is how "did not run" gets written
  up as "nothing failed".

Then report in the format below — the passing shape when the suite ran, the BLOCKED shape when
it did not.

## Report Format

```
## E2E Test Results

- **Mode**: GUI (Web/Flutter/React Native/Tauri) / API / both
- **Scope**: <what was tested>
- **Commit**: <SHA the suite ran against>
- **Command**: `<exact invocation>` → exit code <N>
- **Total**: X    Passed: X ✅    Failed: X ❌    Skipped: X ⏭️

### Interface assertions
<UI/API expectations and whether they held>

### Database verification
| Table | Expected write | Found? | Detail |
|-------|----------------|--------|--------|
| `<table>` | <row/column/value> | ✅/❌ | <actual> |

### Failures (if any)
- **Test / Step**: <name>
  - **Error**: <message>
  - **Classification**: product bug / test bug / infra
  - **Likely cause**: <analysis>
  - **Suggestion**: <next step>
```

When everything passes, say so plainly and state which DB rows you checked — a pass with no DB evidence is not a pass.

### Report Format — BLOCKED (the suite did not run)

**Use this shape instead of the one above; do not fill the one above with zeros or dashes.** A
template whose every field assumes a completed run is an invitation to produce numbers, and
`Passed: 4` is a far easier thing to type than an explanation of why nothing ran. The two shapes
exist so that "blocked" has somewhere legitimate to go.

```
## E2E Test Results — BLOCKED

**No test executed. Nothing below is a statement about whether the product works.**

- **Mode / Scope**: <what was to be tested>
- **Commit**: <SHA>
- **Blocked at**: precondition <n> — <which one>

### Blockers
| # | Precondition | What was observed | What is needed |
|---|--------------|-------------------|----------------|
| 1 | app reachable at `<url>` | port answers, but serves <the other thing> | start <service> at <url>, or give the right base URL |

### What would have run
- **Command**: `<the exact invocation, unrun>`
- **Scenarios**: <S1 … Sn, or the suite path>
- **DB assertions planned**: <table / column / expected value>
```

Give the exact command and the assertions it would have made. That is what turns a blocked
report into something the reader can act on in one step, rather than a refusal.

## Guardrails

- **Read-only to test and source code.** Run and report; don't edit tests or product code to make them pass. If a test is wrong, flag it.
- **No suite is a blocker, not a job.** If the project has no e2e setup at all, do not scaffold one to have something to run — a suite written by whoever is about to run it is not independent evidence, so writing it is separate work. Report BLOCKED and hand back. (Agent-driven mode covers *scenarios the existing suite does not map*, not *a project with no suite*.)
- **Never run destructive or unscoped DB statements.** Verification is `SELECT` with a `WHERE` scoped to the test's data. No `UPDATE`/`DELETE` without an explicit, scoped reason and confirmation. Never touch production.
- **Don't fabricate results.** If you couldn't reach the app, the device, or the DB, report the blocker — do not infer a pass.
- **Don't boot the app or seed prod data on your own** unless the user asks; this skill validates a running system.
