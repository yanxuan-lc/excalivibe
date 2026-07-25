# Codex Subagents (gen-ai-development)

These are **Codex subagents** adapted from the Claude roles. Codex plugins do not
auto-register agent TOMLs, so each agent lives here as a standalone file and is copied
into a Codex agents directory during installation.

Each `*.toml` carries:

- `name` / `description` — the agent identity and "when to use" (used for routing).
- `developer_instructions` — the full system prompt (the original markdown body,
  rewritten per `../ADAPTING-FROM-CLAUDE.md` §3 for Codex).
- `model` / `model_reasoning_effort` — explicit full model IDs and role-sized effort.

TOML pins full model IDs (`gpt-5.6-sol` / `gpt-5.6-terra`) intentionally. Sol is used
for planning and review judgment; Terra handles routine implementation and execution.
The controller may upgrade a hard dispatch according to `spawn-policy.md`. Roles called
“read-only” must not edit product/test code, but still inherit a workspace-writable
sandbox because they write reports. Claude-only `color` / `memory` / `tools` fields are
not carried over.

## Install

Copy the TOMLs into either location, then they become spawnable agents:

```bash
# Personal (all projects)
cp codex/agents/*.toml ~/.codex/agents/

# Or project-local
cp codex/agents/*.toml .codex/agents/
```

## The 9 roles

| Agent | Write scope | Role |
|---|---|---|
| `planner` | read-write | Upstream: draft/refine OpenSpec proposals & specs (propose flow). |
| `arch-reviewer` | report-writer | Review the spec/design BEFORE implementation (the AI design pre-check feeding the architecture gate). |
| `developer` | read-write | Implement a confirmed spec via strict TDD (apply phase). |
| `e2e-author` | read-write | Author e2e test code from the spec's scenarios; produce `e2e-manifest.md`. Never touches product code. |
| `e2e-runner` | report-writer | Execute e2e verification, verify DB writes, write the acceptance report (merge gate). |
| `code-reviewer` | report-writer | Code-quality review (incremental / full, two verdicts); produce the review report (merge gate). |
| `debugger` | read-write | Hypothesis-driven debugging; produce `HYPOTHESIS.md` + a failing regression test (diagnoses only — does not change product code). |
| `release-coordinator` | read-write | PREPARE a release (SemVer, version sync-point check, notes, evidence). Never executes merge/push/publish — the main agent does, with user consent. |
| `researcher` | report-writer | Execution unit for research: investigate one sub-question, or synthesize findings. |
