# dev-workflow

Nine subagents — the **roles** an orchestrated development flow is made of. No skills yet, and no
orchestration engine yet; those come when the flow itself is designed.

| role | tier | writes | does |
|---|---|---|---|
| `planner` | top | spec | Author the four contracts everything downstream builds against |
| `arch-reviewer` | top | a review note | Review the design *before* implementation, when there is a design surface worth reviewing |
| `developer` | standard | code + unit tests | Implement a confirmed spec test-first |
| `e2e-author` | standard | test code | Derive the e2e suite from the spec's scenarios, never from the code |
| `e2e-runner` | standard | a report | Execute the suite, verify the visible result *and* the database writes |
| `code-reviewer` | top | a checklist | Read the diff before merge, two independent verdicts |
| `debugger` | standard | a diagnosis + a RED test | Find the cause, pin it, hand it over |
| `release-coordinator` | standard | a dossier | Prepare a release; never perform one |
| `researcher` | top | findings, or a report | Probe the real thing and report with provenance |

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

## Codex installs agents separately

A Codex plugin cannot bundle agents, so they compile to the repo-level `codex/agents/` and get
copied into place by hand. See the README that travels with them.

This file is generated from `src/plugins/dev-workflow/README.md`. Do not edit it here.
