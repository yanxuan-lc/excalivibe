# Codex Subagents (gen-ai-development)

These are **Codex subagents** ported from the Claude `gen-ai-development` plugin's
`agents/*.md`. Codex plugins **cannot bundle subagents**, so each agent lives here as
a standalone TOML file and is installed by copying it into a Codex agents directory.

Each `*.toml` carries:

- `name` / `description` — the agent identity and "when to use" (used for routing).
- `developer_instructions` — the full system prompt (the original markdown body,
  rewritten per `../ADAPTING-FROM-CLAUDE.md` §3 for Codex).
- `sandbox_mode = "read-only"` on the read-only roles (researcher, arch-reviewer,
  code-reviewer, e2e-runner).

No `model` and no per-agent `effort` are set — agents inherit the session default
for both (Codex tunes reasoning effort at the session/config level via
`model_reasoning_effort`, not per agent; the Claude side pins `effort` per agent —
`e2e-runner` low, `qa-author`/`researcher` medium, the rest high). The
Claude-only `color` / `memory` / `tools` frontmatter fields were dropped.

## Install

Copy the TOMLs into either location, then they become spawnable agents:

```bash
# Personal (all projects)
cp codex/agents/*.toml ~/.codex/agents/

# Or project-local
cp codex/agents/*.toml .codex/agents/
```

## The 9 roles

| Agent | Sandbox | Role |
|---|---|---|
| `planner` | read-write | Upstream: draft/refine OpenSpec proposals & specs (propose flow). |
| `arch-reviewer` | read-only | Review the spec/design BEFORE implementation (the AI design pre-check feeding the architecture gate). |
| `developer` | read-write | Implement a confirmed spec via strict TDD (apply phase). |
| `qa-author` | read-write | Author e2e test code from the spec's scenarios; produce `e2e-manifest.md`. Never touches product code. |
| `e2e-runner` | read-only | Execute e2e verification, verify DB writes, write the acceptance report (merge gate). |
| `code-reviewer` | read-only | Code-quality review (incremental / full, two verdicts); produce the review report (merge gate). |
| `debugger` | read-write | Hypothesis-driven debugging; produce `HYPOTHESIS.md` + a failing regression test (diagnoses only — does not change product code). |
| `release-coordinator` | read-write | PREPARE a release (SemVer, version sync-point check, notes, evidence). Never executes merge/push/publish — the main agent does, with user consent. |
| `researcher` | read-only | Execution unit for research: investigate one sub-question, or synthesize findings. |
