## Context

The `gen-ai-development` plugin already ships a full OpenSpec dev-pipeline but lacks a structured debugging workflow. When bugs appear, agents currently fall back to ad-hoc, unlabelled log statements that are never cleaned up, leaving noise in the diff and training agents toward sloppy debugging habits. The research phase (docs/research/2026-06-14_16-34-37-coding-agent-debug/) established that: (a) Cursor's hypothesis-driven Debug Mode is the most complete industry reference; (b) the most portable debug primitive is a skill/command-orchestrated loop, not hook-triggered automation; (c) Codex's plugin manifest `hooks` field fails the bundled validator and non-interactive hook firing is unverified, making skill-orchestration the only safe cross-end foundation; (d) Chrome DevTools MCP is already wired in `plugin-infra` on both ends, so D4 browser debugging is already available.

Both Claude and Codex plugins use `skills/` as the delivery unit. The `gen-ai-development` plugin already follows the pattern: `skills/<name>/SKILL.md` with `references/<stack>/guide.md` files. The `tdd` skill is the closest precedent — same reference structure, same dual-end deployment.

## Goals / Non-Goals

**Goals:**
- Land a `debug` skill inside the existing `gen-ai-development` plugin on both Claude and Codex ends with zero hook dependency.
- Provide three loops covering the dominant debug scenarios: hypothesis-driven log-loop (Loop A), error-driven exit-code convergence (Loop B), CLI-debugger cognitive loop (Loop C).
- Cover 8 stacks (React, React Native, Flutter, Go, Rust, Tauri 2.0, Node.js, Python) via stack reference guides, all byte-identical between Claude and Codex.
- Ensure deterministic cleanup of all debug instrumentation via a standardised `// [debug:<id>]` tag and a mandatory grep-and-remove step.
- Add a `debugger` subagent persona (Claude: `agents/debugger.md`; Codex: `codex/agents/debugger.toml`) to give the pipeline a named debug role alongside planner/developer.
- Correct three documentation files that carry imprecise "Codex has no hooks" language.

**Non-Goals:**
- Real DAP/breakpoint integration (Phase 3, separate `debug-dap` MCP add-on).
- Hook-driven automation for error detection (Phase 2 optional enhancement; Codex firing unverified in non-interactive exec).
- New browser debugging code — D4 delegates entirely to existing `graceful-browser` skill + `plugin-infra` chrome-devtools MCP.
- Marketplace changes — `gen-ai-development` is already listed on both ends.
- React Native debugger (Hermes/Flipper) deep integration — guide covers CLI path only; Flipper is optional and not the agent-driven path.

## Decisions

### D1 — Skill, not command

**Decision**: `debug` is a skill (auto-invocable by model on bug/failure context) not a slash command (user-initiated side-effecting bootstrap).

**Rationale**: `project-init` and `setup-gen-ai` are commands because they are deliberate one-time bootstraps with filesystem side-effects. Debugging is the opposite: it should fire when a bug context appears, without the user needing to invoke a command. The `tdd` and `e2e-test` skills follow the same auto-invocable pattern.

**Alternative rejected**: Command-only — would require the user to manually invoke `/debug` every time a bug appears, defeating the value of skill-based agent orchestration.

### D2 — Core-loop-first, no hook dependency in v1

**Decision**: Loop A (log-loop) + Loop B (error-driven) + Loop C (CLI debugger) are implemented as pure skill-orchestrated loops. Hooks are an optional Phase-2 enhancement and are explicitly NOT required for v1 to function on either end.

**Rationale**: REPORT.md §4 Layer 3 confirmed that Codex hook firing under non-interactive exec is unverified and trust-gated. Making v1 depend on hooks would mean: (a) Codex side is broken in the primary use case; (b) the `hooks` field in plugin manifest fails `validate_plugin.py`. The skill-loop approach is identical and working on both ends today.

**Alternative rejected**: Hook-triggered log-cleanup — would require a `PostToolUseFailure` handler on Claude and an equivalent on Codex. Codex firing unverified; adds asymmetry that violates 求同存异.

### D3 — Tag convention `// [debug:<id>]` for deterministic cleanup

**Decision**: All temporary debug probes MUST be tagged with the comment `// [debug:<id>]` (language-appropriate comment syntax) on the same line. Cleanup is `grep -rn '\[debug:' <project-root>` to locate all probes, then manual removal, then `git diff` self-check.

**Rationale**: LLM-recall-based cleanup ("remove the log statements you added") is unreliable — the agent may miss statements added across multiple file edits or in earlier turns. A unique, greppable tag makes cleanup deterministic and verifiable. Cursor's Debug Mode achieves automatic removal; we achieve guaranteed-greppable removal. The tag is documented in `references/common/cleanup.md` and referenced from every stack guide.

**Alternative rejected**: No tag convention — relies on model memory; misses probes; diff noise persists.

### D4 — Debugger agent as named pipeline role

**Decision**: Add `debugger` as a named subagent alongside planner/developer/quality-assurance/etc. Claude: `agents/debugger.md` (same format as existing agents). Codex: `codex/agents/debugger.toml` (Codex manifest cannot bundle subagents; install-time copy to `~/.codex/agents/`).

**Rationale**: Named agents make the pipeline's roles explicit and discoverable. When the developer agent hits a bug during `opsx:apply`, it can dispatch to `debugger` cleanly. The pattern follows ADAPTING-FROM-CLAUDE.md §5 exactly.

### D5 — Tauri guide as a dual-side router

**Decision**: The Tauri 2.0 stack guide is a router document, not a standalone guide. It identifies whether the symptom is on the Rust core process or the webview front-end, then routes: Rust-side → `rust-lldb`/`tracing` (referencing the rust guide for probe details); webview-side → `graceful-browser`/devtools (referencing the react guide for probe details). It does NOT duplicate the Rust or React probe sections.

**Rationale**: Tauri 2.0 sessions commonly span both sides. A router makes the cross-cutting case explicit and avoids content duplication across three guides.

### D6 — Byte-identical reference files, minimal SKILL.md frontmatter diff

**Decision**: All `references/<stack>/guide.md` and `references/common/cleanup.md` files are byte-identical between Claude and Codex ends. The only diff between the two `SKILL.md` files is the frontmatter: Claude includes `color`, `model`, `memory`; Codex drops all three (per ADAPTING-FROM-CLAUDE.md §3).

**Rationale**: 求同存异 — main flow and reference content are common; only agent-specific primitives differ. One source of truth for the debugging methodology.

## Risks / Trade-offs

- **[Risk] Probe tag cross-language comment syntax** → The tag `// [debug:<id>]` uses C-style line comments. Python uses `#`, HTML/JSX uses `{/* ... */}`. Each stack guide MUST show the language-correct tag form. Mitigation: the `common/cleanup.md` specifies the canonical tag body `[debug:<id>]` and each stack guide shows the language-specific wrapper.

- **[Risk] Loop C CLI debugger requires interactive terminal** → `dlv`, `rust-lldb`, `pdb` etc. require a TTY. In headless or CI contexts Loop C is not available. Mitigation: stack guides note the interactive prerequisite; Loop A (log-loop) is always the primary path and works in any context.

- **[Risk] Tauri 2.0 dual-side routing ambiguity** → The agent must correctly identify which side the symptom is on before choosing the right tools. Mitigation: the Tauri guide includes a triage checklist (panic/core crash → Rust side; UI wrong / network wrong → webview side).

- **[Risk] Codex subagent install-time copy friction** → Unlike Claude where the agent ships inside the plugin, Codex agents must be manually copied to `~/.codex/agents/`. Mitigation: `codex/agents/debugger.toml` file is included in the repo; ADAPTING-FROM-CLAUDE.md §5/§6 already documents the install-time copy step; README will note it.

- **[Risk] Hooks doc correction misread as a capability change** → The three-file edit is documentation only; it must not accidentally alter the meaning of any working feature. Mitigation: the correction is a targeted, surgical replace of the "Codex 禁写 hooks (无 hooks)" shorthand with the precise three-layer framing. The functional prohibition (do NOT add `hooks` to manifest) is preserved.

## Open Questions

*(All design questions from PROPOSAL.md §6 are resolved; no open questions block implementation.)*
