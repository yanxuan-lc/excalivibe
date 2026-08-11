# CONTEXT.md

**Architecture is in [README.md](./README.md), hard rules in [AGENTS.md](./AGENTS.md), commands in
[CLAUDE.md](./CLAUDE.md).** This file carries what none of those should: **the trade-offs the source
cannot show you**, and **the gaps that are already known**. Every entry names where it lands in the
source, in parentheses.

## The trade-offs behind `genai-dev-flow`

It is the only one of the three plugins with state: its step definitions and gate code install into a
consuming project's `.flow/`, while that project's requirements live **outside** it. The judgments
below decided its current shape; the definitions themselves show only the conclusions.

**Requirements live in `<project>_genai/`, a sibling of the repository**, one directory per item,
with the state in the item's own frontmatter (`skills/genai-backlog/SKILL.md`). The cost is that the
directory has no history and no backup — a known trade, and the project owner's call whether to give
it one.

**One round bumps the version once.** Only `genai.release` is allowed to touch a version number; the
six steps before it never mention versions at all.

**`genai.accept` runs after `genai.archive`**, for the reason written into
`nodes/genai.accept/brief.md`: a requirement goes missing during the fold of the deltas into the main
specs, so checking before the fold would miss the one failure the step exists for.

**An entry rule may only assert something its own step does not change.** A precondition the step
destroys is a precondition that forbids its own rework. `nodes/genai.archive/node.yaml` therefore has
no entry rule at all, and its comment names the two candidates that were rejected.

**Gates assert an end state, not a delta.** `signature_changed` survives only on `genai.spec` and
`genai.implement`, where the end state cannot be expressed mechanically. Wherever it can be — nothing
open under `changes/`, no requirement still active — the delta check is dropped, with the reasoning in
the comments of `nodes/genai.archive/node.yaml` and `nodes/genai.accept/node.yaml`.

**The judgment belongs to the definitions; the facts belong to the project.** A project supplies one
`genai-metrics` make target and a `thresholds.json`, and the target reports numbers without reporting
a verdict. The deciding code ships with the definitions under `assets/flow/genai/`, out of reach of a
round in progress (`lib/metrics.mjs` carries the protocol in full). Which test framework a project
uses is outside this flow's subject.

**Work with openspec's own commands; do not write checks around it.** `lib/openspec.mjs` reads its
output and distrusts its exit code, and `nodes/genai.archive/brief.md` sends the executor to the
`warnings[]` that `openspec archive` prints for itself. Reimplementing one of its rules would drift
silently the day it changes that rule.

**The five subagents cannot be collapsed into fewer.** Each has to run in a context that did not
produce what it is judging — that is the entire reason `agents/genai-code-reviewer.md` exists, and
that file also records that a green gate proves only that the tests which exist pass, never that they
cover the requirements.

## Known gaps

**This repository cannot satisfy its own flow.** No tests, no test runner, and no `genai-metrics`
target in the `Makefile`, so the `genai.implement` and `genai.merge` gates would both return `metrics_missing` here. Either
add tests, or accept that this is a project whose coverage floors are `null`.

**`verify-variants` cannot see a registry entry whose file is gone.** Its main loop walks the `.md`
files that actually exist under `src/` (`scripts/verify-variants.ts`), so an entry in
`src/variant-exceptions.json` pointing at a deleted file is never visited and the gate stays green.
`verify-no-cjk` does not have this hole: it iterates the registry itself
(`stale = Object.keys(allow).filter(...)`). The fix is to have `verify-variants` sweep from the
registry side as well.

**Two per-end mechanisms have no user.** Per-end filenames (`probe.claude.sh`) and per-end data
(`realization.json`) are implemented in `scripts/build.ts` while no file in `src/` uses either. Change
that logic and no existing artifact will verify it — build a case first.

**`verify-json`'s skeleton check idles.** The reference half applies only to files matching
`assets/graphs/*.json` (`scripts/verify-json.ts`), and no such directory exists — the flow's whitelist is
YAML at `assets/flow/workflows/`. So `make verify-json` says `0 graph skeletons`: the selector is
path-based, not content-based, and a skeleton stored anywhere else would be parsed and then skipped.

**`.gitignore` lists `.flow/runs/` with nothing to ignore.** This repository does not run fsx and has
no `.flow/`.

## Two habits this repository keeps

**Measure the instrument before the object.** More defects here have been found in the measuring
apparatus than in the thing being measured, and **a broken ruler always reads like good news** —
"did not trigger" and "the harness did not see it trigger" produce identical output. So before
trusting a number, run one case and read the whole event stream. The apparatus is
`scripts/eval-triggers.ts`, with fixtures in seven skills' `evals/` directories.

**Every change carries its own verification, gates most of all.** A gate that reads its own report is
not a gate, and a gate that merely **looks like evidence** is worse than none. Both live examples are
recorded in source comments: `lib/openspec.mjs` explains why openspec's exit code cannot be believed,
and the `checks` rule in `nodes/genai.implement/node.yaml` explains why the judgment has to ship with
the definition.

## Where the rationale lives, and where it does not

Four places, with a different job each. Nothing is duplicated between them, so a fact you cannot find
in one is in the next rather than absent:

| Place | Holds |
|---|---|
| **this file** | the trade-offs and the known gaps — why it is shaped this way, and what is still missing |
| **comments in the step definitions and the evaluators** | the reasoning for one rule, next to that rule |
| **`src/plugins/genai-dev-flow/AGENTS.md`** | the rules an editor must follow; compiles to nothing |
| **`docs/tech/`** | the as-built reference: what lands where, what each gate can and cannot see, what a consuming project must supply |

There is still no design proposal and no change log among them: every one of the four describes the
current state. When you change a node, change its comment with it — and when the behaviour a document
names moves, move the document in the same commit, because no gate reads `docs/`.
