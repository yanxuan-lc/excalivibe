# dev-workflow

Twelve subagents — the **roles** an orchestrated development flow is made of — plus four skills and
the step definitions that wire them into two graphs.

The orchestration engine is a separate package (`fsx`, from flow-scratch). This plugin does not
vendor it and does not reimplement it: what ships here is the **flow**, in the form the engine
consumes. `genai-init` brings a project to the state where the flow runs — twenty-eight step definitions
across two workflows in its `.flow/`, each one naming the role that executes it and the gates that
decide whether it passed. The split is the
point — the engine knows how to schedule and gate but nothing about this flow; this plugin knows
the flow but nothing about scheduling.

The four skills live here rather than in `dev-toolkit` for the same reason: each produces a
**contract another role decides from**, not a self-contained report. `review-doc`'s whole shape —
decisions first, background compressed, design demoted to an appendix — is justified by there
being an approval step that spends one unit of a person's attention; without that step the
inversion has no argument behind it. `genai-init`, `genai-flow` and `backlog` are flow-shaped by
definition: one sets the flow up, one decides which graph a request calls for, one holds the work
that is not a graph yet.

| role | tier | writes | does |
|---|---|---|---|
| `planner` | top | spec | Author the four contracts everything downstream builds against |
| `arch-reviewer` | top | a review note | Review the design *before* implementation, when there is a design surface worth reviewing |
| `developer` | standard | code + unit tests | Implement a confirmed spec test-first |
| `e2e-author` | standard | test code | Derive the e2e suite from the spec's scenarios, never from the code |
| `e2e-runner` | standard | a report | Execute the suite, verify the visible result *and* the database writes |
| `a11y-runner` | standard | a report | Scan a rendered surface, and say what the scan could not decide |
| `security-runner` | standard | a report | Run the static checks, and say what scope they covered |
| `perf-runner` | standard | a report | Measure what the change moved, and name the cause |
| `code-reviewer` | top | a checklist | Read the diff before merge, two independent verdicts |
| `debugger` | standard | a diagnosis + a RED test | Find the cause, pin it, hand it over |
| `release-coordinator` | standard | a dossier | Prepare a release; never perform one |
| `researcher` | top | findings, or a report | Probe the real thing and report with provenance |

## Twelve of the twenty-eight steps are not subagents

Four are conversations or decisions a person owns: `genai.brief` and `genai.research-brief` run as
`main` because a subagent cannot talk to a user; `genai.intent-slice`, `genai.arch-gate`,
`genai.research-review` and `genai.deliver` run as `human` because somebody signs.

The rest are the delivery stage's own work — the roster, the integration, the checks on the
integrated tree, the merge and the archive — and they run as `main` for a boundary reason: a
subagent must not push to a shared branch, and the main agent is the only executor that can obtain
consent for an act that cannot be undone.

The three `-runner` checkers exist because the main agent should drive and converse, not do the
work — but the capabilities they wrap (`a11y-check`, `security-scan`, `perf-budget`) stay atomic
skills in `dev-toolkit`, because each produces a self-contained report and assumes no caller. The
agent supplies the role boundary; the skill supplies the method. Neither restates the other.

## What was deliberately left out

These roles arrived from a previous generation that had a specific orchestration engine behind it,
and they were wired to it — CLI invocations, node names, fixed artifact paths, a state file. All of
that came out.

What stayed is the role: its single responsibility, the semantics of its inputs and outputs, its
boundaries, and the disciplines that were expensive to learn. A caller supplies the artifact
locations; nothing here assumes a particular engine, because the engine is being redesigned and
importing its data contracts would anchor the redesign to the model it is meant to replace.

Four capabilities are still earmarked for this plugin and have not been written: the orchestration
itself, plus the three or four things that produce a *contract another role builds against* rather
than a self-contained report — intent intake that emits a brief, human-review document generation,
research orchestration, and conformance against a shared term list.

## Why the separations are load-bearing

Several of these roles look mergeable, and each merge costs something specific:

- Whoever **implements** does not **review**. A producer grading their own work produces a grade,
  not evidence.
- Whoever **authors tests** does not write **product code**, and whoever **runs** them edits
  neither. A suite that mirrors the implementation proves only that the code agrees with itself.
- Whoever **diagnoses** a bug does not **fix** it, so the test that proves the bug is not written by
  whoever needs it to pass.
- Whoever **prepares** a release does not **perform** it, because publishing needs consent and a
  subagent structurally cannot obtain it.

## Roles name skills; skills never name roles

Every agent here composes skills from `dev-toolkit` and `computer-use` by name. That direction is
deliberate and it only runs one way — a skill that named its caller would stop triggering when a
person asked for the same thing directly, and would need rewriting every time a role was renamed.
Orchestrators know about the things they call. The things being called do not know who called.

**`review-doc` living in this plugin does not exempt it.** Being flow-shaped decides where a
capability belongs; it never licenses naming a caller. That skill describes the situation it
serves — a design that needs a person's approval — and names no role, exactly like every skill
in `dev-toolkit`.

## Codex installs agents separately

A Codex plugin cannot bundle agents, so they compile to the repo-level `codex/agents/` and get
copied into place by hand. See the README that travels with them.

This file is generated from `src/plugins/dev-workflow/README.md`. Do not edit it here.
