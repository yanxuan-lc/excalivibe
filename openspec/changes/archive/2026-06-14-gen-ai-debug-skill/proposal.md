## Why

The `gen-ai-development` plugin ships a full OpenSpec dev-pipeline (planner → developer → QA → e2e-runner) but has no structured debugging capability: when a bug or test failure appears mid-loop, the agent defaults to ad-hoc print statements that are never cleaned up, or escalates to the user. Cursor's Debug Mode has proven that a hypothesis-driven log-loop with **mandatory deterministic cleanup** is the highest-value debug primitive — and it is fully portable to skill-orchestrated agents on both Claude Code and Codex CLI without any hook dependency.

## What Changes

- **New skill `debug`** added to `gen-ai-development` on both Claude (`claude/plugins/gen-ai-development/`) and Codex (`codex/plugins/gen-ai-development/`) ends. The skill is model-invocable (not a slash command) and covers three loops: Loop A (hypothesis-driven tagged log-loop), Loop B (error-driven exit-code convergence), Loop C (agent-driven CLI-debugger cognitive loop). D4 browser debugging delegates to the existing `graceful-browser` skill and `plugin-infra` chrome-devtools MCP — no new browser code.
- **Stack reference guides** (`skills/debug/references/<stack>/guide.md`) for 8 stacks: React, React Native, Flutter, Go, Rust, Tauri 2.0, Node.js, Python. Plus `references/common/cleanup.md` encoding the `// [debug:<id>]` tag convention and deterministic grep-and-remove procedure. All reference files are byte-identical across both ends.
- **New `debugger` subagent** — Claude: `agents/debugger.md`; Codex: `codex/agents/debugger.toml` (Codex plugin manifests cannot bundle subagents; install-time copy required).
- **Doc correction** in `CLAUDE.md`, `AGENTS.md`, and `codex/ADAPTING-FROM-CLAUDE.md`: the standing "Codex 禁写 hooks (无 hooks)" framing is imprecise. The precise three-layer finding (REPORT.md §4): hooks capability exists in TOML/hooks.json; the plugin manifest `hooks` field fails the bundled `validate_plugin.py` validator; non-interactive exec firing is unverified and trust-gated. v1 has zero hook dependency.

## Capabilities

### New Capabilities

- `debug-skill`: The `debug` SKILL.md on both ends — Triage decision tree, Loop A/B/C bodies, Cleanup section (mandatory), Guardrails, Integration note (handoff to `tdd` after fix). Frontmatter description encodes trigger boundaries vs `tdd`/`e2e-test`/`graceful-browser` to prevent mis-fire.
- `debug-stack-references`: Nine reference files (`react`, `react-native`, `flutter`, `go`, `rust`, `tauri`, `nodejs`, `python` stack guides + `common/cleanup.md`). Each stack guide is a self-contained cheat-sheet covering probe injection, reproduce command, exit-code convention, CLI debugger, and browser handoff. The `tauri` guide is a dual-side router (Rust core vs webview), not a duplicate of rust or react guides.
- `debugger-agent`: The `debugger` subagent definition on both ends. Persona: hypothesis-first, minimal-fix, cleanup-mandatory investigator. Bridges to the `debug` skill loop bodies and defers browser work to `graceful-browser`.
- `hooks-doc-correction`: Targeted edits to three documentation files correcting the hooks framing. Not a functional change — no skill or agent behavior is altered.

### Modified Capabilities

*(none — no existing spec-level behavior changes)*

## Impact

- **Files added**: 11 new files under `claude/plugins/gen-ai-development/skills/debug/`, 11 mirrored files under `codex/plugins/gen-ai-development/skills/debug/`, `claude/plugins/gen-ai-development/agents/debugger.md`, `codex/agents/debugger.toml`.
- **Files edited**: `CLAUDE.md`, `AGENTS.md`, `codex/ADAPTING-FROM-CLAUDE.md` (doc correction only, ≤5 lines each).
- **No manifest changes**: `gen-ai-development` is already listed in both marketplaces. No `hooks` field added to `.codex-plugin/plugin.json`.
- **No new MCP servers or dependencies**: D4 reuses the already-wired `plugin-infra` chrome-devtools MCP.
- **Codex validator**: `validate_plugin.py` must still pass after the change (no new fields added to plugin.json).
