## 1. Common Cleanup Reference

- [x] 1.1 Create `claude/plugins/gen-ai-development/skills/debug/references/common/cleanup.md` — canonical `[debug:<id>]` tag body, language-specific comment wrappers for all 8 stacks, the grep command `grep -rn '\[debug:' <project-root>`, and the deterministic removal + `git diff` self-check procedure
- [x] 1.2 Copy `references/common/cleanup.md` byte-for-byte to `codex/plugins/gen-ai-development/skills/debug/references/common/cleanup.md`

## 2. Stack Reference Guides (Claude end)

- [x] 2.1 Create `claude/plugins/gen-ai-development/skills/debug/references/react/guide.md` — `console.*` tagged probe, `vitest`/`jest` run command + exit code, `node --inspect` for Loop C, `graceful-browser`/chrome-devtools MCP handoff for D4; reference to `../common/cleanup.md`
- [x] 2.2 Create `claude/plugins/gen-ai-development/skills/debug/references/react-native/guide.md` — `console.*`/LogBox tagged probe, `jest` exit code, Hermes inspector/`node --inspect` for Loop C, RN devtools handoff; reference to `../common/cleanup.md`
- [x] 2.3 Create `claude/plugins/gen-ai-development/skills/debug/references/flutter/guide.md` — `debugPrint`/`dart:developer log` tagged probe, `flutter test` exit code, `dart`/flutter DevTools observatory for Loop C, n/a for browser; reference to `../common/cleanup.md`
- [x] 2.4 Create `claude/plugins/gen-ai-development/skills/debug/references/go/guide.md` — `log`/`slog` tagged probe, `go test ./...` exit code + panic stack, `dlv` (delve) for Loop C, n/a for browser; reference to `../common/cleanup.md`
- [x] 2.5 Create `claude/plugins/gen-ai-development/skills/debug/references/rust/guide.md` — `dbg!`/`tracing`/`eprintln!` tagged probe, `cargo test`/`cargo build` exit code, `rust-lldb`/`rust-gdb` for Loop C, n/a for browser; reference to `../common/cleanup.md`
- [x] 2.6 Create `claude/plugins/gen-ai-development/skills/debug/references/tauri/guide.md` — dual-side router: triage checklist (panic/core crash → Rust side; UI wrong/network wrong → webview side); Rust side → `rust-lldb`/`tracing` + cross-ref `references/rust/guide.md`; webview side → `graceful-browser`/devtools + cross-ref `references/react/guide.md`; `cargo test` for core; reference to `../common/cleanup.md`
- [x] 2.7 Create `claude/plugins/gen-ai-development/skills/debug/references/nodejs/guide.md` — `console.*`/`debug` pkg tagged probe, `node`/test-runner exit code, `node --inspect`/`node --inspect-brk` for Loop C, n/a for browser; reference to `../common/cleanup.md`
- [x] 2.8 Create `claude/plugins/gen-ai-development/skills/debug/references/python/guide.md` — `logging`/`print` tagged probe, `pytest` exit code + traceback, `pdb`/`debugpy` for Loop C, n/a for browser; reference to `../common/cleanup.md`

## 3. Stack Reference Guides (Codex end — byte-identical copies)

- [x] 3.1 Copy all 8 stack guides byte-for-byte from `claude/plugins/gen-ai-development/skills/debug/references/` to `codex/plugins/gen-ai-development/skills/debug/references/` (react, react-native, flutter, go, rust, tauri, nodejs, python)
- [x] 3.2 Verify all 9 files (8 guides + common/cleanup) are byte-identical across both ends using `diff`

## 4. Debug Skill SKILL.md (Claude end)

- [x] 4.1 Create `claude/plugins/gen-ai-development/skills/debug/SKILL.md` with Claude frontmatter (name, description, color, model, memory); description MUST encode the trigger boundary vs `tdd`/`e2e-test`/`graceful-browser` AND explicitly name the negative mis-fire boundary (N1): e.g. "for running an existing test suite use `e2e-test`; for red-green test-first use `tdd`; for browser/front-end use `graceful-browser`"
- [x] 4.2 Write the Triage section — decision tree routing to Loop A/B/C or `graceful-browser` for browser symptoms; browser handoff MUST say "invoke the `graceful-browser` skill" (never an inline Claude-specific priority list) (B1)
- [x] 4.3 Write the Loop A section — hypothesis → tagged probe injection (`[debug:<id>]`) → reproduce → read runtime data → locate → minimal fix → verify → cleanup; reference `references/common/cleanup.md`; body must not name `claude --chrome`, `mcp__claude-in-chrome__*`, `Agent`, `AskUserQuestion`, `EnterPlanMode`, or `ToolSearch` anywhere in the body (B1)
- [x] 4.4 Write the Loop B section — run command → capture non-zero exit + stderr → locate failing assertion → minimal fix → rerun until exit 0; no manual error paste required
- [x] 4.5 Write the Loop C section — agent-driven CLI debugger; route to stack guide for the specific binary (`dlv`, `rust-lldb`/`rust-gdb`, `pdb`/`debugpy`, `node --inspect`, Dart/Flutter DevTools); note interactive terminal requirement; note future DAP-bridge MCP as Phase-3
- [x] 4.6 Write the dedicated Cleanup section — mandatory after any loop with tagged probes; grep command; `git diff` zero-residual self-check
- [x] 4.7 Write the Guardrails section — no shotgun logging without hypothesis; no incidental refactor; tag-and-cleanup mandatory; no secrets/PII in logs
- [x] 4.8 Write the Integration section — after fix, suggest regression test via `tdd` skill

## 5. Debug Skill SKILL.md (Codex end)

- [x] 5.1 Create `codex/plugins/gen-ai-development/skills/debug/SKILL.md` — copy body from Claude SKILL.md exactly (byte-identical body); rewrite frontmatter to Codex format (keep name, description; drop color, model, memory)
- [x] 5.2 Verify the diff between the two SKILL.md files shows only frontmatter differences
- [x] 5.3 Run `grep -E 'claude --chrome|mcp__claude-in-chrome__|AskUserQuestion|EnterPlanMode|ToolSearch|\bAgent\b' codex/plugins/gen-ai-development/skills/debug/SKILL.md` (body only) and confirm zero matches (B1 artifact verification)

## 6. Debugger Agent (Claude end)

- [x] 6.1 Create `claude/plugins/gen-ai-development/agents/debugger.md` with frontmatter matching existing agent format (name: debugger, description with trigger examples, model: sonnet, color, memory: project)
- [x] 6.2 Write the agent body: persona (hypothesis-first, minimal-fix, cleanup-mandatory); describe when to use each loop (A/B/C) by referencing the debug skill; delegate browser symptoms to `graceful-browser`; handoff to `tdd` after fix; dispatch to `debugger` agent noted for: "bug/failure/stack-trace context during development"

## 7. Debugger Agent (Codex end)

- [x] 7.1 Create `codex/agents/debugger.toml` with fields: `name = "debugger"`, `description`, `developer_instructions` (Codex-adapted body per ADAPTING-FROM-CLAUDE.md §3: replace Claude tool refs with Codex equivalents, remove color/model/memory); do NOT set `sandbox_mode = "read-only"` (agent edits files during fixes)
- [x] 7.2 Add a comment at the top of `codex/agents/debugger.toml` stating that this file must be copied to `~/.codex/agents/` or `.codex/agents/` at install time

## 8. Update CLAUDE.md Subagent Table and Hooks Framing

- [x] 8.1 Add a `debugger` row to the subagent dispatch table in `CLAUDE.md` with: trigger scenario ("bug/failure/stack-trace context during development"), not-for boundary ("spec creation, feature implementation without a bug context")
- [x] 8.2 Apply the hooks framing correction in `CLAUDE.md` (~L16): the existing clause "…禁写 `hooks` 字段），不要套用 Claude 的结构假设。" SHALL be edited so the prohibition gains the three nuance clauses: (a) `validate_plugin.py` rejects the manifest `hooks` field; (b) Codex runtime hooks capability exists via `config.toml`/`hooks.json`; (c) non-interactive exec firing is unverified/trust-gated; (d) v1 does not depend on hooks. No other lines in `CLAUDE.md` changed. (B3)

## 9. Update AGENTS.md Hooks Framing

- [x] 9.1 Apply the hooks framing correction in `AGENTS.md` (~L68): the existing line "Codex 的 `plugin.json` **不要写 `hooks` 字段**（validator 拒绝）；…" SHALL have two missing clauses ADDED after the `（validator 拒绝）` parenthetical: (b) Codex runtime hooks capability exists via `config.toml`; (c) non-interactive exec firing is unverified/trust-gated. Do NOT wholesale replace the line — only append the missing nuances. No other lines changed. (B3)

## 10. Update codex/ADAPTING-FROM-CLAUDE.md Hooks Row

- [x] 10.1 Update the `plugins/<p>/hooks/` row (~L19) in the §1 mapping table of `codex/ADAPTING-FROM-CLAUDE.md`: expand the current "manifest 拒绝 `hooks` 字段" note to the precise three-layer framing — (a) `validate_plugin.py` rejects manifest `hooks` field (exit 1); (b) hooks capability exists via `config.toml` TOML `[[hooks.<Event>]]`; (c) non-interactive exec triggering unverified (trust-gated); (d) Phase-2 via install-time `config.toml` injection. No other rows changed. (B3)

## 11. Validation

- [x] 11.1 Run `python3 ~/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py codex/plugins/gen-ai-development` and confirm exit code 0 (Codex manifest unchanged — no `hooks` field added)
- [x] 11.2 Confirm `gen-ai-development` plugin `skills/` listing now includes `debug/` on both ends
- [x] 11.3 Confirm `codex/agents/debugger.toml` is present and parseable as valid TOML (`python3 -c "import tomllib; tomllib.load(open('codex/agents/debugger.toml','rb'))"`)
- [x] 11.4 Verify byte-identity of all 9 reference files (8 stack guides + common/cleanup) between Claude and Codex ends using `diff -r` on the two `references/` directories
- [x] 11.5 Verify SKILL.md bodies are byte-identical across ends (frontmatter diff only)
- [x] 11.6 Run `grep -E 'claude --chrome|mcp__claude-in-chrome__|AskUserQuestion|EnterPlanMode|ToolSearch|\bAgent\b' codex/plugins/gen-ai-development/skills/debug/SKILL.md` (on body section only) and confirm zero matches (B1)
- [x] 11.7 Verify CLAUDE.md, AGENTS.md, and codex/ADAPTING-FROM-CLAUDE.md each contain all three nuance clauses for hooks (config.toml path, validator rejection, non-interactive unverified) by running targeted grep checks (B3)
