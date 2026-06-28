---
name: e2e-test
description: Execute end-to-end tests against an already-running application and verify the outcome — both the user-visible/API result AND the resulting database writes. Three modes — (1) GUI-driven full-functional suites that drive the real UI, (2) API-only tests that start from an endpoint call, and (3) agent-driven scenario execution for scenarios no suite covers (live browser driving via the graceful-browser skill). Covers Web (Playwright), Flutter on device/emulator (integration_test + flutter drive, ADB), React Native on device/simulator (Detox), and Tauri desktop (tauri-driver + WebdriverIO), with MySQL/PostgreSQL write verification over an env connection string. Use this skill whenever asked to run e2e / end-to-end / smoke tests, to verify a feature works through its UI or API, to confirm a flow "actually wrote to the database", or before merge to validate a running build. This is end-to-end execution, NOT unit/red-green TDD (use the tdd skill for that).
---

# End-to-End Testing

This skill **runs** end-to-end tests and **verifies their effects**. It assumes the application/service under test is already running. Test suites are executed when they exist; scenarios that no suite covers can be executed **agent-driven** (mode 3) — either way, your job is to confirm the outcome reached both the interface and the database.

An end-to-end test is only trustworthy if you check *both* halves of the result:

1. **The observable result** — what the GUI shows, or what the API returns.
2. **The persisted result** — what actually landed in the database.

A green UI assertion with no row in the table is a false pass. Always verify the write.

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

1. **Pick the framework via the `graceful-browser` skill** (from the `plugin-infra`
   plugin): Codex's native browser (`@Chrome` / `@Browser`) first, then the
   chrome-devtools MCP, then the Playwright MCP. If graceful-browser isn't installed,
   probe those tool families directly in the same priority order.
2. Execute the scenario's WHEN steps one by one against the running app; assert each
   THEN observation (page state, visible text, navigation) as you go.
3. Verify the DB writes exactly as in the scripted modes.

Cost discipline: every agent-driven step is an LLM (often multimodal) call —
**never use this mode for a scenario that scripted tests already cover**, and when a
scenario set is stable enough to re-run often, recommend investing in scripted tests
instead. Failed scripted tests may be reproduced agent-driven for diagnosis, but the
scripted result stands.

Keep each step cheap and fast: prefer a **text read** (get-page-text) over a
screenshot for assertions, **batch** an action with its observation where the tool
allows, and **wait on a condition** (element/text appears) rather than a fixed
sleep — fixed sleeps are the main reason an agent-driven pass feels slow. When this
mode is being invoked under the autonomy-controller and a *large fraction* of scenarios
would need it (the threshold: non-scripted `> 5` or `≥ 20%`), that is a
signal to **escalate to the user** rather than grind through — this `> 5` / `≥ 20%`
threshold is the `qa-author` agent's non-scripted-ratio flag, surfaced via its
`e2e-manifest.md`; the `autonomy-controller` skill (Step 7) governs verification
intensity more broadly.

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
Clarify what's being tested (a flow / a feature / a specific suite or file), which **mode** (GUI vs API vs both), and for GUI which **client platform**. If the request implies a DB check ("确认写库正确", "data persisted"), plan the verification queries up front.

### 2. Discover the project's e2e setup — don't assume
Read the project before running anything. Look for:
- **Config / runner**: `playwright.config.*`, `wdio.conf.*`, `integration_test/`, `test_driver/`, `pytest.ini`/`pyproject.toml`, `*_test.go`, `hurl`/`newman` files.
- **Existing scripts**: `package.json` `scripts` (`test:e2e`, `e2e`), a `Makefile` target, `pubspec.yaml` dev_dependencies.
- **How the app is reached**: base URL, ports, device IDs — usually in env or a `.env`/config.
- **DB access**: the connection string in env (see db-verification.md for the variable names checked).

Prefer the project's **existing command** for running the suite over a hand-built one. The references tell you how to read/parameterize that command, not to replace it.

### 3. Confirm preconditions
Before executing, verify (and report clearly if any fails — do not silently proceed):
- The app/service under test is **running and reachable** (the skill does not boot it unless the user asks).
- For GUI: the target is available — a browser for Playwright, a connected device/emulator for Flutter (`adb devices` / `flutter devices`), a built debug binary + a booted simulator/emulator for React Native (Detox), the built debug binary + a running `tauri-driver` for Tauri.
- The database is reachable with the env connection string, and you're pointed at a **test/staging** database — never production.

### 4. Run the suite
Execute via the platform/API reference. Capture full output (and machine-readable reporter output where available — JSON reporters, JUnit XML). Scope to the requested feature when the runner supports filtering (`-g`/`--grep`, a test path, a tag) rather than always running everything.

### 5. Verify database writes
After the run (or after the specific action), follow [references/db-verification.md](references/db-verification.md): query the affected tables with the env connection, assert the rows/columns the feature should have written, and account for our conventions (e.g. logical delete via `is_deleted`, `created_time`/`updated_time`) — cross-check schema expectations against the `dba-guideline` skill. Allow for async writes (poll/wait rather than asserting instantly).

### 6. Analyze and report
Distinguish a **product bug** (the app did the wrong thing) from a **test/infra issue** (flaky selector, stale fixture, env not up). Then report in the format below.

## Report Format

```
## E2E Test Results

- **Mode**: GUI (Web/Flutter/React Native/Tauri) / API / both
- **Scope**: <what was tested>
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

## Guardrails

- **Read-only to test and source code.** Run and report; don't edit tests or product code to make them pass. If a test is wrong, flag it.
- **Never run destructive or unscoped DB statements.** Verification is `SELECT` with a `WHERE` scoped to the test's data. No `UPDATE`/`DELETE` without an explicit, scoped reason and confirmation. Never touch production.
- **Don't fabricate results.** If you couldn't reach the app, the device, or the DB, report the blocker — do not infer a pass.
- **Don't boot the app or seed prod data on your own** unless the user asks; this skill validates a running system.
