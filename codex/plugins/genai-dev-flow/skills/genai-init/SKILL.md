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
    nodes/genai.*/                    eight step definitions (fsx's own nodes/task/ stays alongside)
    genai/*.mjs                       the gate evaluators these definitions call
  Makefile                            must have a `genai-metrics` target (the project writes it)
  tools/genai/thresholds.json         the coverage floors (the project sets these)

<project>_genai/                      a SIBLING of the repository, not inside it
  backlogs/
  archive/
```

The requirements directory is a sibling, and its name is `<repository-directory-name>_genai`.
**That naming is load-bearing**: gate commands cannot receive graph variables, so they locate
it as `../$(basename "$PWD")_genai`. A different name breaks two gates silently.

## Steps

**1. Confirm the working directory is the repository root.**

```bash
git rev-parse --show-toplevel
```

**A greenfield directory is not a repository, and this flow cannot run outside one** — `worktree`,
the branch-tip comparison, the merge commit and the tag are all git. So `fatal: not a git
repository` is a fork, not a failure:

```bash
git init -b main && git commit --allow-empty -m "chore: init"
```

The empty first commit is worth the one line: several gates compare against `HEAD`, and a
repository with no commits has none. Ask before running it — creating a repository is the user's
call — and if they would rather set one up themselves, stop here and come back.

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

What the project does own stays tracked: the `Makefile`, `tools/genai/thresholds.json`, and
everything under `openspec/`.

**3. Copy the step definitions and the workflow.** They ship in this skill's own directory
under `assets/flow/`. Resolve that path from where this SKILL.md was loaded from.

```bash
cp -R <skill-dir>/assets/flow/nodes/. .flow/nodes/
cp -R <skill-dir>/assets/flow/genai/. .flow/genai/
cp <skill-dir>/assets/flow/workflows/genai-sprint.yaml .flow/workflows/
```

`.flow/genai/` holds the gate evaluators the definitions call by path. **Copy it whenever the
definitions are copied** — a definition without its evaluator gates every attempt to
`unexecutable`. Nothing under `.flow/nodes/` may be a directory without a `node.yaml`, which is
why the shared tools sit beside it rather than inside it.

**4. Set the engine defaults** in `.flow/config.yaml`:

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

**6. Give the project a `genai-metrics` make target, and its thresholds.**

These are the only project-specific pieces. `genai-guideline` carries the protocol in full —
follow it there rather than from memory. What this step has to produce:

```makefile
.PHONY: genai-metrics
genai-metrics:                 ## the numbers the genai.implement gate judges
	@<run the suite with coverage>
	@<print one line: genai-metrics: {"tests":{...},"coverage":{...}}>
```

Create the `Makefile` if the project has none. **Add only this target** — do not convert the
project's build to make. Whether the suite runs through npm, cargo, pytest or gradle is the
project's business, and choosing or wiring a test framework is `tdd`'s subject, not this one's.

Exit code and other output do not matter: the gate reads the marked line and ignores the rest, so
nothing here needs `|| true` to look successful.

`tools/genai/thresholds.json` holds the coverage floors. **These defaults are for a project
starting from nothing:**

```json
{ "coverage": { "lines": 0.90, "branches": 0.90, "functions": 1.00 } }
```

For a project that already has code, **agree the numbers with the user against what it actually
measures today.** The round may not edit this file, so a floor above where the project stands
rejects every round with nothing able to fix it. A floor of `null` opts that dimension out — the
only way out, and visible in the file.

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

**7. Verify — with both commands, not just the first.**

```bash
fsx check
fsx nodes -w genai-sprint
```

**`fsx nodes -w genai-sprint` must list all eight, and that listing is the judgement.** A missing
one is a broken install, not something to work around.

**Do not judge by `fsx check`'s counts.** It counts every definition on disk, and `fsx init` in
step 2 scaffolded a template node of its own (`.flow/nodes/task/`) plus `workflows/default.yaml`
— neither of which step 3 removes. So it reports **nine** nodes and **two** workflows on a correct
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
