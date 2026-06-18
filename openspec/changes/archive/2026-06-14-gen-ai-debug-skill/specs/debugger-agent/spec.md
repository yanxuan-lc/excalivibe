## ADDED Requirements

### Requirement: debugger agent exists on Claude end

The `gen-ai-development` plugin SHALL provide a `debugger` agent definition at `claude/plugins/gen-ai-development/agents/debugger.md`. The file MUST follow the same frontmatter format as existing agents (e.g., `developer.md`, `planner.md`): `name`, `description` (with trigger examples), `model`, `color`, `memory` fields. The agent body MUST define the debugger persona: hypothesis-first investigation, minimal-fix discipline, mandatory cleanup, deference to `graceful-browser` for browser symptoms, and handoff to `tdd` after a fix is confirmed.

#### Scenario: debugger.md exists on Claude end

- **WHEN** `claude/plugins/gen-ai-development/agents/debugger.md` is read
- **THEN** the file exists and contains a frontmatter block with `name: debugger` and a `description` field

#### Scenario: debugger agent frontmatter follows existing agent format

- **WHEN** `claude/plugins/gen-ai-development/agents/debugger.md` frontmatter is compared to `claude/plugins/gen-ai-development/agents/developer.md`
- **THEN** both share the fields `name`, `description`, `model`, `color`, `memory` in the same YAML frontmatter format

#### Scenario: debugger agent body defines the persona

- **WHEN** the body of `claude/plugins/gen-ai-development/agents/debugger.md` is read
- **THEN** it specifies: (a) hypothesis-first investigation discipline; (b) mandatory `[debug:<id>]` tag and cleanup; (c) delegation to `graceful-browser` for browser/UI symptoms; (d) handoff to `tdd` after fix is verified

### Requirement: debugger agent exists on Codex end as a TOML file

The `debugger` subagent on the Codex end SHALL live at `codex/agents/debugger.toml` (not inside the plugin manifest — Codex manifests cannot bundle subagents). The TOML file MUST follow the format defined in ADAPTING-FROM-CLAUDE.md §5: `name`, `description`, `developer_instructions` fields. The `developer_instructions` field SHALL be the agent body from `agents/debugger.md` adapted per ADAPTING-FROM-CLAUDE.md §3 (Claude-specific tool references replaced with Codex equivalents; `color`/`model`/`memory` fields removed). The file MAY include `sandbox_mode = "read-only"` only if the agent is genuinely read-only (it is not — it edits files during fixes, so do NOT set this).

#### Scenario: debugger.toml exists on Codex end

- **WHEN** `codex/agents/debugger.toml` is read
- **THEN** the file exists and contains TOML fields `name`, `description`, `developer_instructions`

#### Scenario: debugger.toml follows ADAPTING-FROM-CLAUDE.md §5 format

- **WHEN** `codex/agents/debugger.toml` is read
- **THEN** it does NOT contain `color`, `model`, or `memory` fields; it does NOT have `sandbox_mode = "read-only"`

#### Scenario: debugger.toml developer_instructions are Codex-adapted

- **WHEN** the `developer_instructions` field of `codex/agents/debugger.toml` is read
- **THEN** it contains no Claude-specific tool references (no `mcp__claude-in-chrome__*`, no `AskUserQuestion`, no `EnterPlanMode`); browser delegation refers to Codex `@Chrome` / `graceful-browser` / chrome-devtools MCP

### Requirement: Install-time copy procedure is documented

Because Codex plugin manifests cannot bundle subagents, the installation of `debugger.toml` MUST be documented. The `codex/agents/debugger.toml` file SHALL include a comment at the top (or accompany a note in the README or ADAPTING-FROM-CLAUDE.md) stating: copy this file to `~/.codex/agents/` (personal) or `.codex/agents/` (project-scope) at install time.

#### Scenario: Install-time note present

- **WHEN** `codex/agents/debugger.toml` is read OR the plugin README is read
- **THEN** a note or comment states that `debugger.toml` must be copied to `~/.codex/agents/` or `.codex/agents/` at install time

### Requirement: debugger agent is reachable from CLAUDE.md subagent table

The existing subagent dispatch table in `CLAUDE.md` SHALL be updated to include a row for `debugger` so the main agent knows when to dispatch it.

#### Scenario: debugger row in CLAUDE.md subagent table

- **WHEN** the subagent table in `CLAUDE.md` is read
- **THEN** a `debugger` row is present with trigger scenario ("bug/failure/stack-trace context during development") and "not for" boundary ("spec creation, implementation without a bug context")
