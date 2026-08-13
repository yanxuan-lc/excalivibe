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

**One round bumps the version once.** Only `genai.release` is allowed to touch a version number; no
step before it mentions versions at all.

**`genai.accept` runs after `genai.archive`**, for the reason written into
`nodes/genai.accept/brief.md`: a requirement goes missing during the fold of the deltas into the main
specs, so checking before the fold would miss the one failure the step exists for.

**An entry rule may only assert something its own step does not change.** A precondition the step
destroys is a precondition that forbids its own rework — permanently and silently, since a ready
refusal writes no event and spends no patience. `nodes/genai.archive/node.yaml` is the worked case:
both its rules would be unstatable on the default `always`, because the fold empties the open
changes and dirties the tree they assert, so both narrow to `when: upstream_reran`. The comment
there also names the graph constraint that follows — a `reject` edge back into the merge would
re-activate the archive through a dependency edge with the changes already folded.

**The round's one human step is depended on, not merely sequenced.** `genai.implement` declares the
ruling as an input it never opens, so that an `upstream_premise` entry rule can measure it against
the spec (`nodes/genai.implement/node.yaml`). Without that rule the step would wait for a person and
then build whatever the spec had since become — approved in sequence, binding on nothing. This also
settles what the ported design used to do by hand: it recorded a fingerprint of the spec inside the
document and re-checked it at the gate, roughly eighty lines of shell whose allow-list had already
been got wrong once. A fingerprint can only *detect* staleness; the entry rule refuses it, and the
graph's own activation regenerates the document when the spec moves.

**`DECISION.mdx` is named for its purpose, not its contents.** By volume it is mostly appendix — the
worked example runs 13% decisions and 71% domain model, interfaces and use cases. The name still says
decision, because the document's only failure mode is being read as reference material: a reader who
opens it expecting depth finds depth, answers "looks fine to me", and the step becomes theatre. The
appendix earns its place as the evidence the decisions are answerable from, and one rule keeps it
honest (`skills/genai-arch-doc/SKILL.md`) — it may carry no decision of its own.

**A change with nothing to rule on gets no document, and no gate counts files against changes.** A
fake choice of the "A. do it / B. don't (not recommended)" kind spends a person's attention and makes
the step look effective, so coverage is claimed in the executor's report and refused as `partial`,
rather than checked by counting (`nodes/genai.write-arch-docs/node.yaml`). The cost is that a round
producing one thin document for one change passes on a claim rather than on a measurement.

**The human ruling does not travel into the openspec archive.** `fsx human` writes it to the node's
declared locator under `.flow/`, which is not tracked, so the durable copy is the signed report in
the event log rather than a file beside the change. A round-level decision has no per-change
directory to live in, and the e2e records' pattern does not transfer.

**Documentation is written last, after the fold, and nothing reviews it.** Every step before
`genai.update-project-docs` can still be reworked — the implementation goes back on a review or a
failed scenario, the merge itself can change the result — so documentation written any earlier
describes a state that has not settled and is rewritten each time one does. Placing it inside the
code review's diff was the alternative, and it buys less than it looks: the review's subject is
code, so what it would add there is nearer a signature than a reading, and the price is pinning the
document to a branch still in motion. Two of `genai.merge`'s entry rules also measure a conclusion
against the commits, which rules out any committing step between the review and the merge —
verified in `ready.ts`, where the subject signature is measured fresh at dispatch rather than
replayed from the upstream's record.

**Its gate judges nothing about its subject, on purpose.** `nodes/genai.update-project-docs/node.yaml`
reads only the executor's `outcome`. The step exists to put documentation in front of an agent every
round, and **not every round should change a word** — a refactor behind an unchanged contract
legitimately writes nothing. Nothing available here separates that from skipping the job:
`signature_changed` passes with no baseline on a first dispatch (`checkers.ts`), and the integration
branch this round forked from is never named in the flow, so a gate command — which receives no
variables — cannot ask git what moved. A gate that cannot make the distinction and rejects anyway
would teach every round to manufacture an edit, which is worse than the omission it was trying to
catch. The missing ingredient is the project declaring its integration branch beside the coverage
floors.

**Its output is the documentation tree, not a commit, because fsx refused the alternative.**
Declaring the branch tip put it at the same locator as `genai.implement`'s, and fsx reports that at
load time as `node_output_collision`: the presence check would be satisfied by the other step's
write, so whichever ran second would pass having done nothing. It is an `observed` artifact signed
by `check.mjs signature-docs` — a glob would not do either, since a project on its first round has
no `docs/` and a glob matching nothing reads as missing rather than empty.

**The e2e suite is built in parallel with the code, from the spec.** `nodes/genai.e2e-author/node.yaml`
declares its input as `from: genai.spec` and never the commits, so the instruction it receives has no
path to the implementation in it — independence by wiring rather than by instruction. Two phases were
rejected in favour of this plus the `delegate` return edge: selectors that can only be settled against
a real DOM come back when there is a real failure to settle them against.

**The acceptance run happens once, before the merge.** `make genai-metrics` runs twice — on the branch
and on the merged tree — because the second run catches the merge itself. The e2e pass does not, and the
cost is stated rather than hidden: **the merged tree's e2e behaviour is not verified**, only its unit
suite and coverage. Running it twice would mean a second app boot and a second full pass for the one
failure mode the metrics gate mostly already covers. A post-merge instance can be added later without a
new definition.

**A record a gate parses carries one fenced json block.** `e2e-manifest.md` and `e2e-report.md` are
markdown for the person who reads them later, with a single machine-readable block inside — the same
split `make genai-metrics` uses for its marked line. A markdown table reads better and would put a
round at the mercy of column alignment.

**There is no per-scenario waiver ledger.** The author proposes a waiver with a reason and the gate
enforces a **ceiling** on how much of a round may go unscripted; crossing it stops the round for a
person. Modelling per-scenario human approval would need somewhere for the approval to live, and a gate
command receives no variables — so it would become another file, checked by another rule, to record a
decision the ceiling already forces someone to make.

**The e2e ceiling's default is the opposite of the coverage floors'.** An omitted coverage entry opts
out — a module absent from `thresholds.json` is not coverage-checked, and a dimension absent from a
module's entry is not checked for that module. An omitted `e2e` block does not: the shipped 5 and 0.2
apply (`lib/e2e.mjs`). A floor left out is a statement about tooling or about a module covered some
other way; a ceiling left out would be a round quietly allowed to waive everything.

**Coverage is judged per module, and the exemption lives in the file a round may not edit.** One
repository-wide figure forced every module onto the lowest common denominator, and a module with no
unit tests either vanished from the number — its absence reading as coverage — or went into the
denominator and dragged the rest below a floor nobody could reach. So `genai-metrics` prints one line
per module and `thresholds.json` keys its floors by module (`lib/metrics.mjs`). The exemption is
deliberately *not* in `modules.json`, which is the one project file a round may rewrite: an exemption
is a loosening, so it belongs beside the floors, where only a person can grant it.

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

**The seven subagents cannot be collapsed into fewer.** Each has to run in a context that did not
produce what it is judging — that is the entire reason `agents/genai-code-reviewer.md` exists, and
that file also records that a green gate proves only that the tests which exist pass, never that they
cover the requirements. The last two make that a triangle: `genai-e2e-author` writes the suite without
reading the implementation, and `genai-e2e-runner` executes it while allowed to edit neither side. Any
two of those three roles in one context and a green result stops being evidence.

## Known gaps

**The `delegate` loop is bounded only by the graph budget.** `genai.e2e → genai.e2e-author` costs no
patience by design — the acceptance run worked; what it found was a broken test — so a test that keeps
coming back red cannot exhaust patience the way a rejection would. `signature_changed` on the author
stops a rework that changes nothing, and `graph_budget` stops the rest. Whether that is the right place
for the floor is untested against a real round.

**openspec cannot be asked for scenario ids.** Its `show --json` gives a scenario's `rawText` and drops
the header, so the ids are read from the markdown by `lib/e2e.mjs` — a second reader of a format
openspec owns, which is the thing this repository otherwise refuses to build. What keeps it honest is
asking openspec for the scenario **count** and reporting a disagreement as `count_mismatch`
(`lib/openspec.mjs`), so drift is loud rather than a silently missing scenario. It is not free of that
risk, only aware of it.

**A change with no scenarios opts out of the e2e branch silently.** `spec-scenarios` reports it as a
fact (`without_scenarios`) rather than refusing it, because a documentation-only change legitimately has
nothing to drive, and nothing mechanical separates that from a spec that dodged the work. The design
review is the only thing standing there.

**This repository cannot satisfy its own flow.** No tests, no test runner, and no `genai-metrics`
target in the `Makefile`, so the `genai.implement` and `genai.merge` gates would both return
`metrics_missing` here. Either add tests, or accept that this is a project whose modules are all
absent from `thresholds.json` and therefore coverage-checked nowhere.

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

**The plugin dependency graph is declared on the Claude end only.** The real graph is
`genai-dev-flow → dev-toolkit → computer-use`, plus `genai-dev-flow → computer-use`, and
`plugin.json`'s `dependencies` now carries it (`scripts/build.ts`). The Codex manifest does not get
it, and that is an open question rather than a conclusion: the Codex validator **exits 1 on a field
it does not know** — which is exactly what `hooks` does to it — so emitting one there unverified
would turn a documented dependency into a plugin nobody can install. Someone has to read the Codex
plugin schema before that half can be closed. Until then a Codex user installing one plugin alone
gets the same dangling cross-plugin instructions this was meant to end.

**Nothing checks that a skill named in prose exists.** The declaration above says which plugins are
needed; it says nothing about whether `` `docs-guideline` `` in a brief resolves to a skill that any
plugin provides. A repo-wide sweep for names that resolve to nothing is the gate this wants, and it
would have caught the `plugin-infra` mis-attribution that was fixed by hand. It would still not
catch the user's half of the problem — what they actually installed.

**`verify-no-nul` does not cover `docs/` or the root documents.** Its corpus is `src/` plus
`scripts/` (`scripts/verify-no-nul.ts`), on the reasoning that the three compiled trees derive from
`src/` and a NUL there is reported where it can be fixed. But a raw NUL hides a file from grep
wherever it sits, and `docs/tech/**` plus the root `README`s are outside the sweep — the same defect
would be just as invisible there and nothing would say so. Widening the corpus is a one-line change;
what it needs first is a decision about whether the root's human-facing documents belong to a gate's
subject at all, which is the same question `verify-no-cjk` answered the other way.

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
