# Research Report — Debug Capabilities of Coding Agents (Cursor / Codex / Claude Code / Windsurf / Cline / Aider)

- **Date**: 2026-06-14
- **Goal**: Understand how leading coding agents implement "debugging", then distil the product-decoupled, portable patterns so a cross-Claude/Codex **debug capability plugin** can be landed in the ExcaliVibe marketplace.
- **Method**: deep-research (6-angle web fan-out, 25 sources fetched, 116 claims → 25 adversarially verified, 24 confirmed / 1 refuted) for the external landscape; a `researcher` source-code/context7 probe for both ends' primitives + repo scaffold; plus a **local empirical test** of the Codex hooks crux on this machine (codex-cli v0.137.0).
- **Provenance discipline**: every conclusion carries its grounding (cited URL / repo file path / context7 doc / empirical command result). Anything not directly observed is marked **inference**.

---

## 1. Research Contract (Step-b digest)

- **Core objective** — decide how to build a reusable, cross-end (Claude + Codex) debug capability plugin, grounded in how the field actually does it.
- **Key constraint (求同存异)** — both ends run the *same* debug-loop main flow; each end lands details with its most-fitting primitives. Claude: `commands/` · `agents/` · `skills/` · `hooks/` · `.mcp.json`. Codex: `.codex-plugin/plugin.json` with `interface.capabilities`/`defaultPrompt`.
- **Four debug dimensions** — (1) log-loop (add log → trigger → read log → locate → fix → verify → remove log); (2) runtime/breakpoint debugging (DAP / variables / stepping); (3) error-driven fix loop (error · stack · test-failure → auto-locate-and-fix); (4) browser/front-end debugging (console / network / DOM · devtools · Chrome).
- **User decisions taken during research** — landing target = ExcaliVibe dual-end plugin; first version = **core loop first** (log-loop + error-driven), browser reuses existing `plugin-infra`, DAP downgraded to an agent-driven CLI-debugger cognitive loop; PROPOSAL granularity to be recommended from findings.

---

## 2. Cross-Agent Capability Matrix (four dimensions)

Legend: ✅ native / first-class · 🟡 partial or via add-on · ➖ no native primitive (agent-driven workaround only) · ❔ evidence gap.

| Agent | D1 Log-loop | D2 Runtime/Breakpoint (DAP) | D3 Error-driven fix loop | D4 Browser/front-end |
|---|---|---|---|---|
| **Cursor** | ✅ **Debug Mode** — most complete: hypothesis → auto-inject temporary logging → user reproduces → agent reads runtime vars/exec-path/timing → fix → **auto-removes all instrumentation** | ➖ no native DAP | 🟡 agent loop + browser console/network feed | ✅ built-in browser tool: full console + network access; logs written to file for context-efficient grep |
| **OpenAI Codex** | 🟡 no documented dedicated "debug mode"; log-loop is agent-orchestrated | ➖ no native DAP | 🟡 hooks-driven possible (see §4); agent loop | ✅ **three channels**: in-app browser (click/type/inspect/screenshot/read-only JS), Developer-mode controlled **CDP** (profile JS / console / network / DOM / styles), Chrome extension (real logged-in browser) |
| **Claude Code** | 🟡 agent-orchestrated via skills/commands; community Debug-Mode clone exists | ➖ no native DAP (issue #29173 is an open feature request as of 2026-02) | ✅ **strongest event surface**: `PostToolUseFailure` + `Notification` hooks fire at the instant of failure | ✅ chrome-devtools MCP (already wired in repo `plugin-infra`) + `graceful-browser` 3-tier fallback |
| **Windsurf** | ❔ evidence gap | ❔ | ❔ | 🟡 Wave-10 browser (blog source only) |
| **Cline** | 🟡 agent-orchestrated | ➖ | ✅ **category-based auto-approve** → unattended run-test-fix loop (`npm test`/`build` auto-approved; install/`rm`/`mv` gated) | ✅ chrome-devtools MCP client |
| **Aider** | 🟡 | ➖ | ✅ **non-zero exit code triggers auto-fix** (`--auto-test` + `--test-cmd`; default auto-lint on edited files, `--no-auto-lint` to disable) | ➖ no built-in browser tool |

**Headline**: no single agent covers all four dimensions natively. The dimensions where products differ most are D1 (Cursor leads) and D3 (Aider/Cline/Claude lead, each differently); D2 is a **universal gap**; D4 is increasingly commoditised by **Chrome DevTools MCP**.

---

## 3. Portable, product-decoupled patterns (the part that matters for landing)

These are the loop structures that survive being lifted out of any one product — the reusable core for our plugin.

1. **D1 — Hypothesis-driven temporary instrumentation loop** (from Cursor Debug Mode):
   `form hypothesis → inject temporary log statements to test it → (user) reproduce → read runtime data (vars / exec path / timing) → locate root cause → targeted fix → verify → remove ALL instrumentation, leaving a clean minimal diff`. The cleanup step is the differentiator — only Cursor documents automatic removal. Source: cursor.com/blog/debug-mode. An open-source reverse clone exists (`github.com/doraemonkeys/claude-code-debug-mode`) showing the pattern is product-independent.

2. **D3 — Exit-code-as-trigger + tiered auto-approval**:
   - Aider: a command's **non-zero exit code** is the explicit trigger for the fix attempt (requires errors on stdout/stderr). Source: aider.chat/docs/usage/lint-test.html.
   - Cline: **per-action-category** auto-approval (read / edit / run-command / browser each gated separately; safe commands like `npm test` auto-approved, destructive gated), with a max-request ceiling. Source: docs.cline.bot/features/auto-approve.
   - Combined portable rule: *"exit code is the signal; gate automation by action category, not all-or-nothing."*

3. **D2 — DAP↔MCP bridge** (the only portable runtime-debug form):
   Wrap a language-specific DAP adapter (debugpy / vscode-js-debug / java-debug) behind an MCP server exposing ~23 `debug_*` tools (breakpoints / stepping / variable inspection). Because it "speaks standard MCP," the *same* server works for Claude Code, Cursor, Windsurf, Cline, custom agents, and CI — runs headless, no IDE. Source: github.com/bastiencb/claude-mcp-debugger (+ peers debugger-mcp, mcp-debugger, microsoft/DebugMCP). **This is the single most portable debug primitive found.**

4. **D4 — Chrome DevTools MCP as the agent-agnostic browser-debug substrate**:
   One MCP server gives any MCP client full DevTools: `list_console_messages` / `get_console_message` / `list_network_requests` / `get_network_request` (the core front-end debug primitives) + `performance_start_trace` + DOM/CSS inspection. 20+ listed clients, no vendor lock-in; connects via Puppeteer over a standard CDP endpoint (`--browser-url` / `--ws-endpoint`). Sources: developer.chrome.com/blog/chrome-devtools-mcp, github.com/ChromeDevTools/chrome-devtools-mcp. **Already wired in this repo on both ends** via `plugin-infra`.

> **Central takeaway**: the portable forms are (a) a **skill/command-orchestrated loop** for D1/D3 (works on every agent), and (b) **MCP servers** for D2 (DAP bridge) and D4 (CDP bridge). MCP is the only thing that is *truly* identical across Claude and Codex.

---

## 4. The Codex hooks crux (resolved empirically)

The repo's standing assumption — *"Codex has no hooks / 禁写 hooks"* — drove the worry that Codex couldn't do event-triggered debug automation (error-driven fix, auto-log-cleanup). The research **corrects and refines** this in three layers:

**Layer 1 — Capability exists (fact).** Codex CLI has a 10-event hook system nearly symmetric to Claude: `SessionStart` · `SubagentStart` · `PreToolUse` · `PermissionRequest` · `PostToolUse` · `PreCompact` · `PostCompact` · `UserPromptSubmit` · `SubagentStop` · `Stop`. Declared as TOML `[[hooks.<Event>]]` in `config.toml` **or** as a Claude-compatible `hooks.json`. Source: developers.openai.com/codex/hooks + /config-advanced#hooks; cross-checks S2's source reading of `codex-rs` `hook_config.rs`.
- Asymmetry: Claude-only `PostToolUseFailure` + `Notification` (instant-of-failure triggers — directly relevant to error-driven debug); Codex-only `PermissionRequest`.

**Layer 2 — Validator rejects the manifest field, runtime ingests it (empirically confirmed on this machine, codex-cli v0.137.0):**
- `validate_plugin.py` (the plugin-creator distribution validator; allowed_keys lines 95-109 exclude `hooks`) → a manifest with top-level `"hooks"` **fails**: `plugin.json field \`hooks\` is not accepted by plugin validation` (exit 1). Removing it passes.
- `codex plugin add` of the *same* manifest **succeeds** — plugin shows `installed, enabled` and `hooks/hooks.json` is copied into `~/.codex/plugins/cache/...`. So the engine ingests `hooks`; only the distribution lint rejects it.
- The official `plugin-json-spec.md` is itself self-contradictory: documents `hooks` as a real field ("Hook config path", "supplemented on top of default component discovery" — lines 18/64/94) **and** says "Validation rejects unsupported manifest fields such as `hooks`" (line 191).

**Layer 3 — Firing is NOT verified in non-interactive mode (honest residual):**
- Under `codex exec --skip-git-repo-check --sandbox read-only`, **no hook fired** — neither a plugin-manifest-bundled `SessionStart` hook nor user-level `config.toml` hooks (`SessionStart` / `UserPromptSubmit` / `Stop`, with and without `matcher`) wrote their sentinel, despite a real session starting (model replied). 
- Consistent with the docs' note that **plugin-bundled hooks "require manual trust review before execution"** and with non-interactive `exec` having no trust-review step (or not running lifecycle hooks). Interactive-TUI firing after trust review was **not** testable headlessly here.
- **Conclusion**: manifest `hooks` are *ingested* (verified ✅) and *source-parsed/documented* (✅), but *firing* is **unverified** (❔) and gated by trust review. Treat event-triggered automation on Codex as an interactive-only, trust-gated enhancement — **not** a clean headless guarantee.

**Decision impact**: this kills "just write `hooks` in `plugin.json`" as a clean, de-risked path (fails the bundled validator AND firing unverified). It pushes the design toward: **skill/command-orchestrated core loop (works everywhere) + hooks as an optional enhancement layer**, and on Codex prefer **install-time injection into `config.toml`** over a manifest `hooks` field.

---

## 5. Repo scaffold for a new debug plugin (from S2)

Both ends already have a clean dual-end exemplar (`plugin-infra`) and an `ADAPTING-FROM-CLAUDE.md` mapping manual.

**Claude** `claude/plugins/<debug-plugin>/`: `.claude-plugin/plugin.json` (name/semver/description/author/keywords) · `commands/*.md` · `agents/debugger.md` · `skills/<dim>/SKILL.md` · `hooks/hooks.json` (optional enhancement) · `.mcp.json` (only if DAP-bridge/devtools needed).

**Codex** `codex/plugins/<debug-plugin>/`: `.codex-plugin/plugin.json` (validator-enforced allowed_keys; `interface{displayName, shortDescription, longDescription, developerName, category, capabilities[], defaultPrompt[]}` required) · `skills/<dim>/SKILL.md` (commands → skills) · `.mcp.json` (same format) · **hooks NOT via manifest field** (see §4 → inject into `config.toml` at install time). Subagents (e.g. `debugger`) can't ship inside a Codex plugin → ship as `codex/agents/debugger.toml` + install-time copy.

Both marketplace manifests must gain the new entry (`claude/.claude-plugin/marketplace.json`, `codex/.agents/plugins/marketplace.json`).

---

## 6. Caveats, evidence gaps, and dead ends

- **Refuted claim**: "Without DAP, debugging runtime state in Claude Code requires leaving the tool entirely for a separate IDE." Killed 1-2 — agent-driven CLI debuggers (`lldb`/`gdb`/`node --inspect`/`debugpy`) are a valid in-tool path. This directly supports the user's "cognitive-loop is enough" decision for D2.
- **Windsurf evidence gap**: deep-research found no independently-verified Windsurf debug mechanism this round (only a Wave-10 browser blog). The matrix row is ❔, not "no capability". Not blocking for a Claude/Codex landing.
- **DAP staleness**: "no native DAP" is anchored to Claude issue #29173 (2026-02, community-filed, not an Anthropic statement); still unshipped as of 2026-06. If native DAP lands, D2 changes. Does **not** affect first-version scope (cognitive-loop chosen).
- **Source strength**: most external claims are single-primary (vendor docs) — appropriate for "capability exists", not multi-source cross-checked for reliability. Cursor/Codex browser tools have community-reported connection/format bugs; Chrome DevTools MCP is self-described public preview (local-Chrome-only, weak multi-agent concurrency).
- **Hooks firing**: the one link I could not close (see §4 Layer 3). Recorded as ❔, not asserted.

---

## 7. Sources (primary unless noted)

- Cursor Debug Mode — cursor.com/blog/debug-mode ; cursor.com/docs/agent/debug-mode ; browser tool: cursor.com/docs/agent/tools/browser
- Aider lint/test loop — aider.chat/docs/usage/lint-test.html
- Cline auto-approve — docs.cline.bot/features/auto-approve
- Claude Code DAP request — github.com/anthropics/claude-code/issues/29173 ; DAP↔MCP bridge — github.com/bastiencb/claude-mcp-debugger
- Chrome DevTools MCP — developer.chrome.com/blog/chrome-devtools-mcp ; github.com/ChromeDevTools/chrome-devtools-mcp
- Codex browser/CDP/extension — developers.openai.com/codex/app/browser ; /codex/app/chrome-extension
- Codex hooks — developers.openai.com/codex/hooks ; /codex/config-advanced#hooks
- Cursor Debug Mode OSS clone — github.com/doraemonkeys/claude-code-debug-mode
- Autohand run-test-fix tutorial — autohand.ai/docs/tutorials/fix-failing-tests-debugging (smaller/newer; partial via snapshot)
- Local repo + empirical: `~/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py`, `.../references/plugin-json-spec.md`; `codex plugin add/list/remove`, `codex exec` (codex-cli v0.137.0, 2026-06-14)
