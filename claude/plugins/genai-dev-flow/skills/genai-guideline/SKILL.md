---
name: genai-guideline
description: Explain how the genai development flow works and what a project has to supply for it — the ten steps and what each one is gated on, the make target, coverage floors and app probe a project supplies itself, and the traps that cost a whole round. Use when a step's verdict needs explaining, when deciding whether a gate is strong enough or where a new gate belongs, when the project-supplied metrics target or its floors have to be written, widened or replaced, and when someone needs to understand the flow before installing or running it.
---

# The genai flow

Requirements in, one release out. This is the manual: what the flow guarantees, what it does
not, and what it needs from the project it runs in.

To install it, use `genai-init`. To run a round, use `genai-flow`. To write requirements, use
`genai-backlog`. For how a spec, a delta or a scenario has to be written — including the scenario id
convention three steps depend on — use `genai-openspec`.

## First: is this project set up at all?

```bash
fsx nodes -w genai-sprint      # the judgement: all ten steps listed
fsx check                      # read problems[], not the counts
```

All ten listed and nothing at `severity: error` means yes. Anything else — a missing `.flow/`,
fewer than ten in the listing, `unexecutable` on every command gate — means the project has not
been installed, and **nothing in this flow will work until it is**.

**`fsx check`'s counts are not the test.** It counts every definition on disk, and `fsx init`
scaffolds a template node (`nodes/task/`) and a `workflows/default.yaml` that installing does not
remove, so a correct install reports eleven nodes and two workflows. Scoping the question to the
workflow is what `-w genai-sprint` is for.

That state is normal rather than broken, and a fresh clone is always in it. `.flow/` is not
tracked in git: the definitions and the checks under `.flow/genai/` are versioned in the plugin
they ship from, so committing them would put a second copy of an already-versioned artifact into
every repository — and would make switching branches change the engine's contract. The trade is
that installing is a step someone has to take, once per checkout.

**So do not work around it and do not hand-write the missing pieces.** Ask whether to install now,
and run `/genai-init` if the answer is yes. Hand-assembled definitions drift from the ones the
plugin ships, and the first symptom is a gate that passes when it should not.

## Two separations everything else follows from

**What is wanted lives outside the code repository.** Requirements sit in `<project>_genai/`, a
sibling directory, one directory per item. A requirement spans many versions and branches and
corresponds to no commit; inside the repository it would be copied into every worktree and
would conflict on every merge. Outside, there is one copy and no shared file to clobber. The
cost is real and accepted: that directory has no history unless its owner gives it one.

**A sprint is a release unit, not a concurrency unit.** One round is one version bump, however
many requirements, specs and changes it carries. This is what a per-change flow keeps losing:
inside one change's context that change *is* everything, so finishing it looks like finishing a
round and the version gets bumped again. Only the last step may bump it, and no earlier step
mentions versions at all.

## The ten steps

Gates run in declaration order and the first non-pass concludes, so each row below is
"every condition, cheapest first". Patience is 5 for all of them, shared across the whole batch.

| Step | Executor | Produces | Passes when |
|---|---|---|---|
| `genai.spec` | `genai-spec-writer` | this round's changes and spec deltas | change and delta files exist · not byte-identical to the last attempt · `outcome: completed` · openspec strict validation reports 0 failed · every active requirement is referenced by some change |
| `genai.spec-review` | `genai-spec-reviewer` | one design review per change | a record landed for each change · `verdict: approve` |
| `genai.implement` | `genai-developer` | committed code on the sprint branch | *entry:* a spec delta exists to build from. *gate:* the branch has commits · the tip moved · `outcome: completed` · no test failed, at least one ran, at most a tenth skipped, and coverage is at or above the project's floors |
| `genai.e2e-author` | `genai-e2e-author` | the e2e suite, plus one `e2e-manifest.md` per change | the manifest landed · the manifest or a test file moved since the last attempt · `outcome: completed` · every scenario in exactly one bucket and the non-scripted share under the project's ceiling · every mapped scenario's id greppable in the test file it names |
| `genai.code-review` | `genai-code-reviewer` | one review record per change | *entry:* the tree is clean. *gate:* a record landed for each change · `verdict: approve` |
| `genai.e2e` | `genai-e2e-runner` | one `e2e-report.md` per change | *entry:* the app answers and is the right app · the tree is clean. *gate:* a report landed · `outcome: completed` · every non-waived scenario executed, every pass carrying database evidence, and no failure left unclassified |
| `genai.merge` | main | the merge commit | *entry:* the branch has not moved since the review approved it, nor since the acceptance run · the tree is clean. *gate:* a merge commit exists · `outcome: completed` · the merged tree still satisfies the same test-and-coverage check the branch did |
| `genai.archive` | main | the folded main specs | *entry:* there is a change to fold · the tree is clean. *gate:* main specs exist · `outcome: completed` · nothing left open under `openspec/changes/` · the main specs pass strict validation |
| `genai.accept` | `genai-requirement-checker` | the archived requirement records | *entry:* nothing left open under `openspec/changes/`, so the fold has happened. *gate:* the archive is non-empty · `verdict: approve` · no requirement is still `active` |
| `genai.release` | main | the changelog, plus the version and tag in the report's effects | *entry:* no requirement is still `active`. *gate:* the changelog is written and committed · `outcome: completed` |

Five asymmetries are deliberate:

- **The suite is built in parallel with the code, from the spec.** `genai.e2e-author` takes its input
  from `genai.spec`, not from the commits, so nothing in its instruction points at the implementation.
  A suite derived from the code passes by construction and proves only that the code agrees with
  itself. The cost is that UI selectors cannot be finalised against a DOM that does not exist yet —
  which is what the `delegate` edge is for: a test that turns out to be wrong comes back once there is
  a real failure to fix it against, rather than on a schedule.
- **A failed acceptance run routes by classification, and there are exactly two destinations.** A
  product failure is a `reject` to `genai.implement`; a test failure is a `delegate` to
  `genai.e2e-author`, which spends no patience because the acceptance run did not fail — it worked, and
  what it found was a broken test. Edges route on the verdict alone, so those two buckets are all the
  graph can act on; everything else the run gets wrong is its own to fix.
- **Only `genai.spec` and `genai.implement` have the byte-identical check.** Elsewhere the gates
  assert an absolute end state that doing nothing cannot satisfy, so a delta check adds nothing —
  and it makes rework fragile, because a stalled signature drains the whole patience budget at once.
- **An entry rule that its own step invalidates has to say so, with `when`.** By default a rule
  is evaluated on every dispatch, and for `genai.spec` (which empties the `ready` backlog it
  entered on) and `genai.archive` (which folds away the changes it entered on) that would refuse
  every rework forever — silently, because a ready refusal writes no event and spends no patience.
  Both declare a narrower `when`: `first_attempt` where the step is a root, `upstream_reran` where
  it has an upstream that can re-run. Rules that stay true through their own step — the two on
  `genai.merge`, the ones on `genai.accept` and `genai.release` — keep the default and are asked
  every time, which is what makes them safe to rely on before an irreversible act.
- **`genai.accept` runs after `genai.archive`, not before.** Requirements go missing *during*
  the fold into the main specs, silently, with no mechanical gate able to see it. Checking
  before the fold would miss the one failure the step exists for.

## What the project has to supply

Everything a gate can derive from git, from the requirements directory, or from openspec ships
inside the step definitions and is identical in every project. Everything that depends on the
project's own toolchain — tests, static analysis, build, deploy — cannot be, and becomes a
script the project writes.

**The interface is a make target.** One name, one output format, and nothing said about how the
project satisfies it:

```
make genai-metrics             runs the suite, prints the numbers
tools/genai/thresholds.json    the floors those numbers are judged against, and the e2e ceiling
tools/genai/e2e.json           how to recognise this project's own app when it is running
```

All three ship as templates under `genai-init`'s `assets/project/`, so a project starts from a copy
rather than from a transcription — the shapes live there and are not repeated here.

`e2e.json` exists because "is the app up" is not a question a port can answer. On a developer's
machine several projects' services are usually listening at once, so a TCP connect — or even a 200 —
only proves *something* answered. So the project declares a URL and a marker its own app returns.
`status` may be added when the health endpoint does not return 200. Both other fields are required:
without a marker there is nothing to tell this app from anything else on that port, and port 8080
replying with someone else's console is a failed precondition, not a reachable app. `genai.e2e`
refuses to **start** on it rather than failing afterwards, so nothing is consumed — no verdict, no
patience, no attempt.

**This one is due before the first acceptance run, not at install time.** It is the only
project-supplied piece whose content a fresh project cannot know: a greenfield repository has no port,
no health endpoint and nothing in a response worth matching on, and inventing a URL for an app nobody
has written yet produces a file that validates and describes nothing. So installing may legitimately
leave it absent, and the state that follows is the intended one — `genai.e2e` reports `config_missing`
as an entry refusal, which spends nothing and names what is needed.

Two consequences of that timing, and the second is the one to hold on to:

- **Nothing earlier in the round needs it.** A round can be designed, implemented, reviewed and have
  its suite written with the file still missing. It is worth confirming at the top of a round anyway —
  discovering it an hour in costs the same conversation, later.
- **A round may not write it.** Whoever supplies it, it is not the work being measured: `contains: "e"`
  matches nearly any response, and a marker that loose is the whole check removed. Same rule as the
  coverage floors, for the same reason. When it turns out to be missing mid-round, that is a person's
  one-line answer — not something for a step to guess its way around.

A marker earns its place by being **specific to this service**: the service name from a health payload,
a version string, the title a known route renders. `ok`, `healthy` and `200` are not markers; every
other process on the machine says those too.

The e2e ceiling rides in `thresholds.json` alongside the coverage floors, under an `e2e` key holding
`max_non_scripted` and `max_non_scripted_ratio`, and **its default is the opposite of the floors'**.
An omitted coverage dimension opts out — a project saying it does not measure that. An omitted e2e
ceiling does **not** opt out; the shipped 5 and 0.2 apply. A floor left out is a statement about
tooling, while a ceiling left out would be a round quietly allowed to hand-drive or waive everything,
so raising this one has to be visible in the project's own file.

Which test framework, which coverage tool, how the target is wired — none of that is this flow's
subject. Choosing and running a test setup is what `tdd` is for; this flow only states what has
to come out the other end. A future step needing its own project-supplied gate gets its own
`genai-<step>` target under the same rule.

**One target, two steps, two trees.** `genai.implement` runs it on the sprint branch and
`genai.merge` runs it again on the merged tree, against the same floors. The second run is not
a retry of the first: only the merge happened in between, so what it catches is the merge itself
— a conflict resolved wrong, or two changes that pass separately and fail together. Nothing else
in the round looks at the integration branch, which is why this one costs a full suite run and
is worth it. The consequence for the project is that the target has to be runnable on the
integration branch too, not only on a feature branch.

### The project reports; the gate decides

**The target never says pass or fail.** It prints one line, beginning `genai-metrics: `, followed
by one JSON object:

```
genai-metrics: {"tests":{"passed":131,"skipped":0,"failed":2},"coverage":{"lines":0.93,"branches":0.91,"functions":1.0}}
```

Everything else the target prints is ignored, **and so is its exit code.** A failing suite is
data, not an error — so no project has to remember `|| true` to keep make quiet, and no project
has to redirect its test output to keep stdout clean. Both are mistakes that would otherwise
break the gate silently.

| Field | Required | Value |
|---|---|---|
| `tests.passed` / `skipped` / `failed` | yes | non-negative integers. **The total is computed from these**, never read — one less number that can disagree with itself |
| `coverage.lines` / `branches` / `functions` | no | a fraction in `[0,1]`. Omit or null a dimension the project's tooling does not report |

A coverage value outside `[0,1]` is refused rather than interpreted. Passing `93` for 93% is the
easy mistake, and guessing which was meant would build a gate that passes on a typo.

The judgement lives in `.flow/genai/`, which ships with the step definitions — every check the
steps make is one atom behind `node .flow/genai/check.mjs <atom>`, never shell inside a definition.
**That is what makes the gate a gate**: a project that decides its own verdict has none, and a
round that can edit the arithmetic is not being measured by it.

What it decides, and where each rule comes from:

| Rule | Set in | Why there |
|---|---|---|
| no test may fail | `check.mjs` | Universal. Not a ratio on purpose — a tolerance for failing tests never gets closed once opened |
| at least one test ran | `check.mjs` | Universal. This is what makes an empty suite impossible to pass |
| at most a tenth skipped | `check.mjs` | Universal. Otherwise marking a failure as skipped walks straight past the rule above |
| coverage floors: lines, branches, functions | `tools/genai/thresholds.json` | **Cannot be universal.** One number for a greenfield project and a decade-old one is either meaningless or unreachable |

`90 / 90 / 100` are the defaults for a project starting from nothing. For a project that already
has code, agree the numbers with whoever owns it: **the round may not edit that file**, so a floor
above where the project stands rejects every round with nothing able to fix it.

A floor of `null` opts that dimension out — the only way out, and visible in the file. A floor
with no measurement behind it counts as below it: declaring a floor is a claim that the number
gets measured.

Coverage is measured over the whole project, not over the diff. Patch coverage would aim better
at the failure below, and it was deliberately not built: it needs a merge base, a diff, and an
intersection with the coverage report inside every project's own target.

**"The whole project" is the project's claim, and some coverage tools quietly narrow it.** Several —
Node's built-in `--experimental-test-coverage` among them — report only the files a test actually
loaded, so a module nobody imports does not appear in the report at all and therefore **cannot pull any
dimension down**. An entire unimplemented file is then invisible to this gate. If the project's tool
works that way, its target has to close the gap itself: enumerate the source files, and score a file the
report never mentions as zero. Choosing a machine-readable reporter fixes whether the format drifts; it
says nothing about whether the scope is complete.

### A broken setup rejects; it never passes

Three labels cover it — `metrics_missing` when no marked line came through at all, whatever the
reason; `metrics_unreadable` when one came through and does not satisfy the protocol; and
`thresholds_missing`. All three reject, and all three say so as a setup problem, because none of
those files are the round's to fix. Patience runs out and the round lands in front of a person,
which is where a broken setup belongs.

### Do not scrape the suite's human-readable output

The target has to end up with numbers, and the cheapest-looking route is a regex over whatever the
test runner prints for people. **That route breaks on content, not on code.** A coverage summary
pads its filename column to the widest path, so a run with no source files and a run with
`src/parse-duration.mjs` in it produce different spacing on the same line — and a regex written
against the first silently matches nothing against the second. Every dimension comes through
`null`, the gate reads that as below the floor, and it rejects a round whose real coverage was
100%. The rejection message blames the code, which is the expensive part: nothing points at the
reporter.

Two consequences worth taking seriously:

- **Prefer a machine-readable reporter** — a JSON or LCOV summary, `--reporter=json`, a coverage
  tool's own data file. A format with a contract does not move when the content does.
- **When there is no choice but to parse text, the install-time check proves nothing.** It runs on
  an empty project, which is exactly the layout the real one will not have. Re-run
  `make genai-metrics` and the atom after the first real source file lands, and compare the numbers
  against what the suite actually reported.

Nothing here can be made to pass by leaving something out, which is the property worth keeping:
**the gate demands numbers, so silence is a rejection.** Still, silence is not the only way to be
wrong — a target printing plausible numbers it never measured passes, and no check can see that.
So read what the target actually runs, and run both halves before trusting either:

```bash
make genai-metrics                     # a genai-metrics: line with real numbers
node .flow/genai/check.mjs metrics     # {"result":"satisfied", ...}
```

### Who may change it

**Not the step it gates.** `genai.implement` is told to add tests but to leave the `genai-metrics`
target and the floors alone, and the reviewer treats an edit to either as a finding. A step that
can widen the gate it is measured by has no gate.

Strengthening the gate is **its own piece of work**: it becomes a backlog item like any other,
with `origin: agent` when a step surfaced the need, and it gets specced, implemented and
reviewed in a later round. Between rounds, not inside one — editing it mid-round dirties the
tree and can invalidate a review that already passed.

**Repairing a broken one is the exception, and it needs a channel.** The three setup labels reject
until patience runs out and the round lands in front of a person — and that person's fix is an edit
to the target or the floors, mid-round, which is the exact diff the reviewer is told to treat as an
out-of-scope finding. The reviewer sees a commit, not who made it or why; the author field does not
distinguish a person from the agent they are driving.

So mark it in the commit message, with a trailer:

```
Genai-Setup-Fix: <what was broken, and which label the gate was returning>
```

A reviewer finding that trailer records the edit as `info` rather than a blocker — **after checking
that the diff repairs the target rather than loosening it**: a floor that moved down, a
newly-skipped test or a narrowed command is a blocker whatever the trailer says. Without the
trailer it is a scope finding, and correctly so. This is the whole of the exception: it does not
license widening a gate, and it does not apply to any other file.

### What a green gate does and does not prove

It proves the tests that exist passed. It does not prove they cover the requirements.

This is measured, not theoretical. In one round `genai.implement` reported both requirements
addressed and all four of its gates passed, while one requirement was unimplemented — the tests
were written by the same agent that wrote the code and only covered the half it had built. The
independent reviewer caught it; no gate did.

Which is why the reviewer's criteria include whether the project's gate actually reaches the new
behaviour. A gap there is a finding, and the finding becomes the backlog item above.

## Traps that cost a whole round

- **`openspec validate` exits 0 even when items fail.** Both openspec gates read the totals line
  out of the output instead of trusting the exit code. Any new check built on a CLI needs the
  same suspicion: confirm the command actually fails before believing a gate built on it.
- **`--strict` counts characters, not meaning.** A Purpose that says everything in 38 Chinese
  characters fails a 50-character minimum. Projects writing specs in Chinese hit this repeatedly.
- **The reviewer must not commit its own records.** A verdict is recorded against the exact
  commit handed over, so any commit during that step invalidates the verdict being given — and a
  passed step cannot be re-run. The records stay uncommitted and the merge picks them up.
  **No ordering avoids this**; the premise is fixed at dispatch.
- **The specs are not in git history until the merge** — provided the project's own baseline is
  already committed. `genai.spec` writes `openspec/changes/` and does not commit — its outputs are
  measured as a checksum over files on disk, so nothing needs a commit to be gated — and neither
  `genai.implement` (which may neither edit nor commit anything under `openspec/**`) nor
  `genai.code-review` (which may not commit at all) changes that. The caveat is not hypothetical: on a
  project where `Makefile`, `tools/genai/` and `openspec/config.yaml` were still untracked when the
  round began, a developer facing a branch on which `make genai-metrics` cannot run has a real reason to
  commit them — and then the gate files land inside the diff the code review is scoped to, which the
  review is right to flag and the developer cannot fix. `genai-init` commits that baseline for exactly
  this reason, and `genai.implement`'s brief carries the prohibition where its executor can see it. `genai.merge` is the first
  commit that carries them, so across three steps the requirement exists in the working tree and
  nowhere in the history. Two things follow: reverting an implementation commit does not revert the
  spec it was built from, and anything reading the specs out of git rather than off disk sees
  nothing during that window. The upside is what makes it worth keeping — `worktree` ignores
  untracked files, which is what lets `genai.code-review` and `genai.merge` both demand a clean tree
  without the review records tripping them.
- **`.flow/` is ignored in full, definitions included.** They are versioned in this plugin, so
  tracking them puts a second copy of an already-versioned artifact in every repository — and it
  makes branch switches change the engine's contract, definition edits dirty the tree, and
  merges conflict on the whitelist.
- **A definition edited under a running graph invalidates the run.** Even a comment-only change
  to a step's brief does it. Finish or abort the round first.

## What this flow does not do

- It does not decide the version number. `genai.release` does, from the commits, and records its
  reasoning in the report.
- It does not run work in parallel. One round is serial by design: the roster is the set of
  `active` requirements, and two live rounds make that meaningless.
- It does not manage requirements. That is `genai-backlog`, and it uses no engine at all —
  everything there is a single write that happens in conversation.
