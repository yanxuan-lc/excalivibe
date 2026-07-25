# Codex Spawn Policy

TOML defaults are deliberate cost controls. Dispatch overrides are allowed only for the
conditions below; always use full model identifiers so policy is explicit and auditable.

| Role | Default model | Effort | Upgrade rule |
|---|---|---|---|
| planner | `gpt-5.6-sol` | high | none |
| arch-reviewer | `gpt-5.6-sol` | high | none |
| developer | `gpt-5.6-terra` | high | use Sol/high for cross-module concurrency, difficult migrations, security-critical code, or repeated failed implementation rounds |
| debugger | `gpt-5.6-sol` | high | none |
| code-reviewer | `gpt-5.6-sol` | high | none |
| e2e-author | `gpt-5.6-terra` | medium | use Sol/high only for novel protocols or unusually stateful scenarios |
| e2e-runner | `gpt-5.6-terra` | low | use Terra/medium when live diagnosis is required |
| researcher | `gpt-5.6-terra` | medium | use Sol/high for synthesis, conflicting evidence, or architecture judgment |
| release-coordinator | `gpt-5.6-terra` | medium | use Sol/high only for a breaking-release risk analysis |

## Context and dispatch rules

- Start bounded roles with `fork_turns = "none"` and pass artifact paths plus a concise
  dispatch contract. Fresh context is mandatory for reviewers, e2e roles, and research
  workers; it is the default for every other role.
- Continue an existing agent only when it owns unpersisted working state or is answering
  relayed `open_questions`. Otherwise start a fresh dispatch from on-disk artifacts.
- Parallel writers get disjoint file/module ownership. State the ownership in every
  implementation or test-authoring prompt; agents must preserve unrelated work.
- Record the producer model and verifier model in gate artifacts. `gpt-5.6-sol` and
  `gpt-5.6-terra` are different tiers in one GPT-5.6 family; they do not satisfy a
  different-model-family audit requirement.
- A dispatch override changes only the named run. The TOML remains the stable default.
