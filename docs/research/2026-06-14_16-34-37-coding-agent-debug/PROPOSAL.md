# Proposal — a `debug` capability for ExcaliVibe's `gen-ai-development` plugin

> Consumable by `planner` / `opsx:propose`. Derived from REPORT.md (same directory).
> Reflects the agreed design after review:
> - **No new plugin** — land inside the existing `gen-ai-development` plugin, alongside `tdd` / `e2e-test`.
> - **Skill, not command** — debugging should be model-invocable when a bug/failure context appears.
> - **Core-loop-first** — D1 (log-loop) + D3 (error-driven); D4 delegates to `graceful-browser`/`plugin-infra`; D2 = agent-driven CLI-debugger cognitive loop (no real DAP in v1).
> - **Stack coverage requirement (user)** — at minimum: React (front-end), Flutter + React Native (app), Go (backend), Rust, Tauri 2.0, Node.js, Python.

## 1. Deliverables (v1)

Add to `gen-ai-development` (both `claude/` and `codex/` ends, symmetric main flow):

| Unit | Name | Location | Notes |
|---|---|---|---|
| **skill** | `debug` | `gen-ai-development/skills/debug/SKILL.md` | Hypothesis-driven log-loop + error-driven run-test-fix + CLI-debugger cognitive loop. Sits next to `tdd`/`e2e-test`. |
| **skill references** | per-stack guides | `gen-ai-development/skills/debug/references/<stack>/guide.md` | Stack-specific instrumentation + CLI debugger + reproduce/run commands (see §3). |
| **skill references** | `common/cleanup.md` | `.../references/common/cleanup.md` | Tag convention + deterministic grep-and-remove cleanup. |
| **agent** | `debugger` | Claude: `gen-ai-development/agents/debugger.md`; Codex: `codex/agents/debugger.toml` (+ install-time copy) | Debugger persona subagent, alongside planner/developer/etc. |
| reuse | `plugin-infra` | unchanged | D4 browser (console/network/DOM) via `graceful-browser` + chrome-devtools MCP. |
| optional / Phase 2 | hooks | `gen-ai-development/hooks/` | Claude `PostToolUseFailure`/`Stop` accelerators; Codex via `config.toml` injection. **v1 must NOT depend on hooks.** |

**Not in scope for v1**: real DAP/breakpoints (Phase 3 `debug-dap` MCP add-on), Codex event-automation layer (Phase 2, after interactive hook-firing is verified — REPORT §4 L3).

## 2. The `debug` skill — content shape

Frontmatter `description` must encode trigger boundaries + division of labour vs `tdd` (red-green), `e2e-test` (suite runs), `graceful-browser` (front-end), so recall is precise and it doesn't mis-fire.

Body sections:
- **Triage** — pick the loop: A log-loop / B error-driven / C runtime-state / (front-end → `graceful-browser`).
- **Loop A — hypothesis-driven log-loop** (the value-add): hypothesis → inject **tagged** temporary instrumentation (`// [debug:<id>]`) → reproduce/trigger → read runtime data → locate → minimal fix → verify → **cleanup**.
- **Loop B — error-driven run-test-fix**: non-zero exit code is the trigger; read stderr/stack → locate → minimal fix → rerun until exit 0 / target test green.
- **Loop C — runtime-state cognitive loop**: agent-driven CLI debugger (no DAP); escalate-to-DAP-bridge-MCP note for the future.
- **Cleanup** (mandatory): grep the unique tag → remove all probes; self-check `git diff` shows only the real fix.
- **Guardrails**: no shotgun logging without a hypothesis; no incidental refactor; tag-and-cleanup mandatory; no secrets/PII in logs.
- **Integration**: after-fix → suggest a regression test (`tdd`).

## 3. Stack coverage (`references/<stack>/guide.md`)

Each guide documents, for that stack: (i) how to inject a tagged temporary log/probe; (ii) the reproduce/run command; (iii) the error-driven test/exit-code convention; (iv) the CLI debugger for Loop C; (v) any front-end handoff to `graceful-browser`.

| Stack | Loop A probe | Loop B run / exit-code | Loop C CLI debugger | D4 browser |
|---|---|---|---|---|
| **React (front-end)** | `console.*` / temporary effect logs | `vitest`/`jest` exit code; build errors | `node --inspect` (SSR) / browser devtools | → `graceful-browser` (console/network/DOM) |
| **React Native (app)** | `console.*` / LogBox; Flipper | `jest` exit; Metro errors | Hermes inspector / `node --inspect` | RN debugger / devtools where applicable |
| **Flutter (app)** | `debugPrint` / `dart:developer log` | `flutter test` exit code | `dart`/`flutter` DevTools, observatory | n/a (native) |
| **Go (backend)** | `log`/`slog` tagged lines | `go test ./...` exit; panic stack | `dlv` (delve) | n/a |
| **Rust** | `dbg!` / `tracing`/`eprintln!` | `cargo test`/`cargo build` exit | `rust-lldb` / `rust-gdb` | n/a |
| **Tauri 2.0** | Rust-side `tracing` + JS-side `console.*` (split: core process vs webview) | `cargo test` (core) + front-end test exit | `rust-lldb` (core) + webview devtools | webview console/network → devtools / `graceful-browser` |
| **Node.js** | `console.*` / `debug` pkg | `node`/test runner exit code | `node --inspect` / `node --inspect-brk` | n/a |
| **Python** | `logging` / `print` tagged | `pytest` exit code; traceback | `pdb` / `debugpy` | n/a |

> Tauri 2.0 is the cross-cutting case: a debug session may span the **Rust core process** and the **webview front-end** at once — the guide must tell the agent to identify which side the symptom is on and route to the right probe/debugger (and to `graceful-browser` for the webview).

## 4. Dual-end design (求同存异)

- Main flow (Triage + Loops A/B/C + Cleanup + Guardrails) and all `references/` are **identical** across ends.
- Claude `debug/SKILL.md` frontmatter may carry `color`/`model`; the Codex copy drops them (validator/format).
- `debugger` agent ships inside the Claude plugin; on Codex it lives as `codex/agents/debugger.toml` + install-time copy.
- D4 and the future DAP escalation are **MCP-based on both ends** (the only truly portable primitive).
- Marketplaces already list `gen-ai-development` — no marketplace change needed (we're extending it, not adding a plugin).

## 5. The one asymmetry to design around (D3)

Claude fires `PostToolUseFailure`/`Notification` at the instant of failure; Codex has neither. So **v1's error-loop is skill-driven** (the agent runs the command and inspects the exit code itself) — identical on both ends, no hook dependency. The Claude failure-hook is a Phase-2 optional accelerator, never the mechanism.

## 6. Risks / open items for planning

1. **Codex hook firing unverified** (REPORT §4 L3) — Phase-2 blocker; v1 must not depend on hooks.
2. **Cleanup reliability** — the tag must be a unique, greppable marker so cleanup is deterministic, not LLM-recall. Encode the convention in `references/common/cleanup.md` and reference it from every stack guide.
3. **Codex manifest hygiene** — do NOT add `hooks` to `.codex-plugin/plugin.json`; keep to allowed_keys; re-run `validate_plugin.py`.
4. **Stack guide consistency** — 8 stacks (React, RN, Flutter, Go, Rust, Tauri, Node.js, Python) must share one template so the skill body stays thin and guides stay uniform. Tauri spans two of the others (Rust + webview) — write it as a router, not a duplicate.
5. **Doc correction** (separate small change) — fix CLAUDE.md / AGENTS.md / `codex/ADAPTING-FROM-CLAUDE.md` "Codex 禁写 hooks (无 hooks)" → precise framing (REPORT §4).

## 7. Acceptance criteria sketch (for the spec)

- On a seeded bug in **each supported stack**, the D1 loop runs and ends with **zero residual instrumentation** (`git diff` shows only the real fix) — verifiable on both Claude and Codex.
- D3 error-loop detects a failing test via non-zero exit code and converges to green without manual error paste.
- D4 console/network inspection works through `graceful-browser`/`plugin-infra` (no new browser code).
- Tauri 2.0 session correctly routes a core-process bug to `rust-lldb`/`tracing` and a webview bug to devtools.
- `gen-ai-development` still passes `validate_plugin.py` on the Codex side; `debug` skill is model-invocable on both ends.
