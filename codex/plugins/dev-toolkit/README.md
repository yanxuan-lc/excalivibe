# dev-toolkit

Atomic development skills. Eighteen of them, in four kinds, and the thing they have in common
matters more than the taxonomy: **none of them knows who invoked it.**

| kind | skills |
|---|---|
| conventions — how the artifact should look | `coding-guideline` `dba-guideline` `devops-guideline` `docs-guideline` `middleware-guideline` `spec-guideline` |
| methods — how to run a working loop | `grill` `tdd` `debug` `e2e-test` |
| conventions of process | `vcs-workflow` |
| checks — take an artifact, return a verdict | `a11y-check` `perf-budget` `security-scan` `smell-scan` |
| grounded research — go look instead of recalling | `research-api` `research-data-source` `research-source-code` |

## No skill names its caller

A skill's description answers one question — *when should this be used* — and never
*who will use it*. That is not tidiness; it is what makes the set composable.

A skill that says "invoked by name from the developer agent" has three problems at once. It fails
to trigger when a person asks for the same thing directly, because the description is describing a
dispatch rather than a situation. It breaks the moment that agent is renamed or redesigned, which is
a rewrite triggered by something the skill has no stake in. And it quietly inverts the dependency:
the reusable thing ends up depending on the specific thing.

So the arrow points one way. **An orchestrator names the skills it calls; a skill never names its
orchestrator.** Everything here works the same whether a person asked, a pipeline dispatched, or
another skill delegated.

## Checks report, they do not gate

The four check skills produce a verdict and stop. They do not decide whether that verdict blocks
anything, because the threshold belongs to whoever is doing the blocking — and a check that decides
its own consequences cannot be reused at a different bar.

There is a real distinction underneath this, and it is the same test that decides what belongs in
`dev-workflow` instead: producing a **report** is self-contained, producing a **contract that
another role builds against** is not. `smell-scan` emits a ranked report nobody has to consume in a
particular way, so it lives here. A step that emits a brief the next role writes its design against
does not.

## Where the detail lives

Each skill keeps its SKILL.md inside a context budget and pushes the depth into `references/` —
per-language guides, per-engine SQL rules, per-toolchain test wiring. SKILL.md is loaded in full
every time the skill triggers; `references/` is loaded only when the body sends you there. That
split is what lets a skill cover ten languages without paying for ten languages on every use.

This file is generated from `src/plugins/dev-toolkit/README.md`. Do not edit it here.
