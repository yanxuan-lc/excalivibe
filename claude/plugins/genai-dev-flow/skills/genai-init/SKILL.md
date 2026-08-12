---
name: genai-init
description: Run the genai-init setup procedure — install the genai step definitions and the workflow whitelist into a project's `.flow/`, create the sibling requirements directory, and stand up the make target and coverage floors the project supplies itself. Use when `genai-init` is asked for by name.
---

# Install the genai flow

One-time setup per project. Idempotent — safe to re-run to upgrade the definitions.

**Read `genai-guideline` first.** It defines what the project has to supply and the protocol behind
step 6; this skill installs against that protocol rather than restating it.

## What gets installed where

```
<project>/                            the git repository, and the working directory
  .flow/
    config.yaml                       engine defaults
    workflows/genai-sprint.yaml       the step whitelist
    nodes/genai.*/                    thirteen step definitions (fsx's own nodes/task/ stays alongside)
    genai/*.mjs                       the gate evaluators these definitions call
    genai/templates/                  the records the e2e steps copy and fill in
  Makefile                            must have a `genai-metrics` target (the project writes it)
  tools/genai/thresholds.json         the coverage floors and the e2e ceiling (the project sets these)
  tools/genai/e2e.json                how to recognise the running app (the project sets this)

<project>_genai/                      a SIBLING of the repository, not inside it
  backlogs/
  archive/
```

The requirements directory is a sibling, and its name is `<repository-directory-name>_genai`.
**That naming is load-bearing**: gate commands cannot receive graph variables, so they locate
it as `../$(basename "$PWD")_genai`. A different name breaks two gates silently.

## Steps

**1. Confirm the working directory is a repository root with a `HEAD`.** Two commands, because
these are two different failures with two different fixes:

```bash
git rev-parse --show-toplevel     # is this a repository at all
git rev-parse HEAD                # does it have any commit
```

**A greenfield directory is not a repository, and this flow cannot run outside one** — `worktree`,
the branch-tip comparison, the merge commit and the tag are all git. So `fatal: not a git
repository` is a fork, not a failure:

```bash
git init -b main && git commit --allow-empty -m "chore: init"
```

**Ask a repository with no commits for the second half only.** `git init` without a commit is a
common way to arrive here, and it passes the first command while failing the second
(`fatal: ambiguous argument 'HEAD'`):

```bash
git commit --allow-empty -m "chore: init"
```

The empty first commit is worth the one line: several gates compare against `HEAD`, and a
repository with no commits has none — `genai.merge` measures its output at `locator: HEAD`. **Nothing
earlier catches this**: `check.mjs worktree` reports `clean` on a repository with no commits, because
`git status --porcelain` is happy there, so a missing `HEAD` stays invisible until the merge.

Ask before running either — creating a repository, or its first commit, is the user's call — and if
they would rather set one up themselves, stop here and come back.

**2. Scaffold `.flow/` if it is not there, and ignore all of it.**

```bash
test -d .flow || fsx init
```

`fsx init` writes a `.gitignore` entry for `.flow/runs/` only — its comment says the definitions
next to it are hand-written and should be committed. **Widen it to the whole directory:**

```gitignore
.flow/
```

That advice is right for definitions a project writes itself. These are not: they are versioned
in the plugin they ship from, so committing them puts a second copy of an already-versioned
artifact into every consuming repository.

Ignoring the whole directory also removes three problems at once, all of them real:

- **Switching branches would otherwise change the engine's contract**, since a branch that
  predates the install has no definitions at all.
- **Editing a definition would dirty the working tree**, and a commit on a sprint branch
  invalidates the premise a passed review was recorded against — which cannot be re-recorded,
  because a passed step cannot be re-run.
- **Merging would conflict on the whitelist** whenever two branches installed different versions.

What the project does own stays tracked: the `Makefile`, `tools/genai/thresholds.json`,
`tools/genai/e2e.json`, and everything under `openspec/`.

**3. Copy the step definitions and the workflow.** They ship in this skill's own directory
under `assets/flow/`. Resolve that path from where this SKILL.md was loaded from.

```bash
cp -R <skill-dir>/assets/flow/nodes/. .flow/nodes/
cp -R <skill-dir>/assets/flow/genai/. .flow/genai/
cp <skill-dir>/assets/flow/workflows/genai-sprint.yaml .flow/workflows/
```

`.flow/genai/` holds the gate evaluators the definitions call by path, and the record templates the
e2e steps copy from. **Copy it whenever the definitions are copied** — a definition without its
evaluator gates every attempt to `unexecutable`, and a step without its template starts transcribing
a format from memory. Nothing under `.flow/nodes/` may be a directory without a `node.yaml`, which is
why the shared tools sit beside it rather than inside it.

**4. Set the engine defaults** in `.flow/config.yaml`. This one is an **edit, not a copy** — `fsx init`
wrote that file with its own explanatory comments and it may gain keys in a later version, so
overwriting it with a template of ours would quietly delete both. Change three values in place:

```yaml
defaults:
  patience: 5
  instruction_language: zh-CN   # match the language the requirement briefs are written in
  graph_budget: 50
```

`instruction_language` decides the language of the instruction handed to executors, and
therefore of the reports and documents they write back. Set it to the language of the
requirement briefs, not to the language of whoever is typing.

**It does not translate the step briefs.** Those ship inside this plugin as English source and are
injected verbatim, so every dispatched instruction is two languages at once: an English brief, then
a framework-rendered section in the configured language. That is the intended split — the brief is
read by a model, the artifacts are written for people — but it means the language setting is
carried only by the second half. Tell the executor which half is the language baseline if it has to
ask.

**5. Create the requirements directory** if it is not there:

```bash
mkdir -p "../$(basename "$PWD")_genai/backlogs" "../$(basename "$PWD")_genai/archive"
```

Decide with the user whether that directory should be its own git repository. It is outside
the code repository, so it has no history and no backup unless it is given one. This is a
deliberate trade, not an oversight — but it is the user's call, so raise it once here.

**6. Give the project a `genai-metrics` make target, and its thresholds.** Both ship as templates
in this skill's `assets/project/`; copy, then edit. `genai-guideline` carries the protocol in full —
follow it there rather than from memory.

```bash
cat <skill-dir>/assets/project/genai-metrics.mk >> Makefile      # create the Makefile if there is none
mkdir -p tools/genai && cp <skill-dir>/assets/project/thresholds.json tools/genai/
```

The target's template carries the protocol as comments and two placeholder recipe lines. **Replace
those two lines and nothing else** — in particular do not convert the project's build to make.
Whether the suite runs through npm, cargo, pytest or gradle is the project's business, and choosing
or wiring a test framework is `tdd`'s subject, not this one's.

`thresholds.json` arrives with the floors a project starting from nothing should have. For a project
that already has code, **agree the numbers with the user against what it actually measures today.**
The round may not edit this file, so a floor above where the project stands rejects every round with
nothing able to fix it. A floor of `null` opts that dimension out — the only way out, and visible in
the file. Its `e2e` block is the ceiling on how much of a round may go unscripted; leave it at the
shipped values unless the user has a reason, and note that **omitting it does not opt out** the way
an omitted floor does.

Then prove both halves work, here, before moving on:

```bash
make genai-metrics                     # must print a genai-metrics: line with real numbers
node .flow/genai/check.mjs metrics     # the gate itself, reading that line
```

**What has to be true at install time is the shape, not the verdict.** The second command must
come back with a label about the numbers — and on a project that has no tests yet that label is
`no_tests`, which is the **expected** answer here. `satisfied` is not reachable until something
passes a test, and getting there is `genai.implement`'s job, not this step's.

What would be a broken install is any of the three setup labels: `metrics_missing` (no marked line
came through), `metrics_unreadable` (one did and does not satisfy the protocol), or
`thresholds_missing`. Those three are this step's business; fix them here.

**A target that parses human-readable output has not been tested by this.** The check runs on an
empty project, where column widths, table alignment and summary lines all differ from what they
will be once there are real source files — so a fragile reporter passes here and fails later, with
the gate blaming the code. If the target scrapes formatted text rather than a machine-readable
reporter, say so to the user now and re-run both commands after the first real source file exists.
`genai-guideline` has the reasoning.

A `satisfied` reached with fabricated numbers is the one failure no command here can catch, so read
what the target actually runs.

**7. Tell the flow how to recognise the running app — if the project can say yet.**

`tools/genai/e2e.json` is how `genai.e2e` tells this project's app from everything else listening on a
developer's machine. An open port proves nothing about *which* app answered, so the project declares a
marker only its own response carries. The template is in `assets/project/` beside the other two:

```bash
cp <skill-dir>/assets/project/e2e.json tools/genai/
```

Then replace both values. `url` is an endpoint of this project's app; `contains` is something specific
to **this service** — the name in a health payload, a version string, the title a known route renders.
`ok`, `healthy` and `200` are not markers: every other process on the machine says those too. Add
`status` when the endpoint does not answer 200.

The shipped `contains` is a placeholder that deliberately cannot match anything, so a copy left unedited
reports `wrong_service` rather than passing on a coincidence.

**Write it only if the project can answer honestly today.** This is the one piece a fresh repository
often cannot: no port, no health endpoint, nothing in a response worth matching on. **Do not invent a
URL for an app nobody has written yet** — a file that validates and describes nothing is worse than an
absent one, because the absent one says so.

So there are two correct outcomes here:

- **The app exists.** Write the file and prove it, with the app running:

  ```bash
  node .flow/genai/check.mjs app-identity     # identified — anything else names what to fix
  ```

  `unreachable` means the app is not up, which is fine at install time. `wrong_service` is not: the
  marker does not appear, so the URL points at something else. Fix that here.

- **The app does not exist yet.** Leave the file out, and **tell the user in one sentence** what will be
  needed before the round's acceptance step can start: a URL and a marker only this app returns. Nothing
  earlier in a round touches it — design, implementation, review and the e2e suite all proceed without
  it — and `genai.e2e` then refuses to start with `config_missing`, which spends no verdict, no patience
  and no attempt.

  **Say when it may be committed, too, because the window is narrow.** Committing it moves the branch
  tip, and `genai.merge` refuses to enter if the tip moved after the code review approved it — a review
  that has passed cannot be re-run. So the file is either committed **before `genai.code-review` is
  dispatched**, or left untracked for `genai.merge` to pick up with the other records. Landing it
  between those two is the one order that strands the round.

Either way it is a file **the project owns and a round may not write**, for the reason the coverage
floors are: `contains: "e"` matches nearly any response, and a marker that loose is the check removed.

**8. Commit the project's baseline.** Everything the project now owns is untracked, and leaving it
that way pushes a first commit of it into the middle of a round:

```bash
git add Makefile tools/genai openspec/config.yaml .gitignore   # whichever of these exist
git commit -m "chore: genai flow baseline"
```

**Do this here, not later.** `genai.implement` is forbidden to commit anything under `openspec/**` —
three steps of a round deliberately keep the specs and review records out of the history, because a
commit during a review invalidates the verdict being recorded. But a developer facing a branch where
`make genai-metrics` cannot run has a real reason to commit the baseline anyway, and then the gate
files show up inside the diff a code review is scoped to. That review is right to flag it and the
developer cannot fix it. Committing the baseline now removes the whole situation.

Add paths explicitly. `git add -A` here sweeps in whatever else is lying around the working directory.

**9. Verify — with both commands, not just the first.**

```bash
fsx check
fsx nodes -w genai-sprint
```

**`fsx nodes -w genai-sprint` must list all ten, and that listing is the judgement.** A missing
one is a broken install, not something to work around.

**Do not judge by `fsx check`'s counts.** It counts every definition on disk, and `fsx init` in
step 2 scaffolded a template node of its own (`.flow/nodes/task/`) plus `workflows/default.yaml`
— neither of which step 3 removes. So it reports **eleven** nodes and **two** workflows on a correct
install. That is normal. What `fsx check` is for here is `problems[]`.

**`ok` and the exit code answer only for errors.** Problems come in two severities, and a
`warning` leaves both green — so `fsx check && ...` passing is not the same as a clean report.
Read `problems[]` even when `ok` is true, and treat anything there as a question to answer
rather than noise to skip.

**Run the second one even when the first says all clear.** They answer different questions —
whether the definitions satisfy their contract, and whether they can actually be loaded and
resolved against the whitelist — and a workspace where the first passes while the second fails
is a real state, not a hypothetical. On a case-insensitive filesystem a whitelist entry
differing from its directory only in case has produced exactly that: `check` clean, `nodes`
dead. **A green check is not proof the steps can be used.**

## Codex only: install the agents by hand

Codex plugins cannot bundle agents. Copy them once:

```bash
cp <plugin-root>/../agents/genai-*.toml ~/.codex/agents/
```

Claude users skip this — the same agents ship inside the plugin.

## Upgrading

Re-run steps 3 and 7. Definitions and evaluators are replaced wholesale; nothing merges.
**Copy `.flow/genai/` too** — an evaluator left at an older version than the definition that
calls it fails in whichever direction the two disagree.

**Do not upgrade while a graph is running.** A graph's identity is its workflow, variables,
nodes and edges; changing a definition under a live run leaves the run measuring against a
contract it was not created with. Finish or abort the round first.

## What this does not do

- Does not explain the flow or define the metrics protocol — that is `genai-guideline`
- Does not create requirements — that is `genai-backlog`
- Does not create a graph — a graph is per round, not per project
- Does not reimplement a gate the project already has; wrap the existing command
