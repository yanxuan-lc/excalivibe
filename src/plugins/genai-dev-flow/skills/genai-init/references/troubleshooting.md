# Why each piece of the install is shaped the way it is

Read this when something comes back wrong, or before changing `detect.mjs` / `apply.mjs`. Every
entry here is a failure that has a way of going quietly — which is why it is written down rather
than left to be re-derived from the code.

## Prerequisites

- **Install only what came back missing. Never re-install one that answered.** A global install
  replaces whatever was there, including an `npm link` to somebody's local checkout, and nothing
  warns you — the version printed afterwards looks the same. This is why `--install` takes an
  explicit list instead of installing whatever is absent.
- **`npm i -g` exiting 0 is not the binary answering.** `apply.mjs` verifies with `--version` and
  reports what that printed; treat a missing version line as a failed install.
- **`openspec init` is interactive without `--tools`** and will sit waiting for an answer nobody is
  there to give. `--no-animation` is for the same reason.
- **`fsx skill install` refuses to overwrite a copy that has been edited.** That refusal is
  information: someone customised it. Do not reach for `--force` without showing them the diff.
- **`openspec init` writes more than `openspec/`.** Given `--tools` it also drops command and skill
  files wherever this host keeps them. `apply.mjs` prints everything new in the working tree for
  exactly this reason — those files are the project's, not this flow's, so the user decides what to
  track, and the baseline commit says nothing about them.

## The empty first commit

Several gates compare against `HEAD`, and a repository with no commits has none — `genai.merge`
measures its output at `locator: HEAD`. **Nothing earlier catches this**: `check.mjs worktree`
reports `clean` on a repository with no commits, because `git status --porcelain` is happy there, so
a missing `HEAD` stays invisible until the merge step.

`git init` without a commit is a common way to arrive here: it passes `git rev-parse --show-toplevel`
while failing `git rev-parse HEAD`. That is why the two are separate flags (`--git-init` and
`--git-commit`) and separate questions.

## Why the whole of `.flow/` is ignored

`fsx init` writes a `.gitignore` entry for `.flow/runs/` only, and its comment says the definitions
next to it are hand-written and should be committed. That advice is right for definitions a project
writes itself. These are not: they are versioned in the plugin they ship from, so committing them
puts a second copy of an already-versioned artifact into every consuming repository.

Ignoring the whole directory also removes three problems at once, all of them real:

- **Switching branches would otherwise change the engine's contract**, since a branch that predates
  the install has no definitions at all.
- **Editing a definition would dirty the working tree**, and a commit on a sprint branch invalidates
  the premise a passed review was recorded against — which cannot be re-recorded, because a passed
  step cannot be re-run.
- **Merging would conflict on the whitelist** whenever two branches installed different versions.

What the project does own stays tracked: the `Makefile`, `tools/genai/thresholds.json`,
`tools/genai/e2e.json`, and everything under `openspec/`.

## Why `config.yaml` is edited and not copied

`fsx init` wrote that file with its own explanatory comments and it may gain keys in a later
version, so overwriting it with a template of ours would quietly delete both. `apply.mjs` replaces
the three values in place, and if a key is absent it inserts it and says so rather than assuming
what the new name is. The file may also be deleted entirely — fsx falls back to built-in defaults —
so a missing file is a legal state, not an error.

## Why the Makefile takes three templates

In a project that has no Makefile, appending is creating: `genai-metrics` would become the file's
first target and therefore make's default goal, so the bare command would run the test suite, and
the `## ` description the target carries would have nothing that renders it. `makefile-head.mk`
supplies `.DEFAULT_GOAL := help` and a `help` target so the bare command shows help, which is what
`devops-guideline` requires of any repository's front door.

A project that already has a Makefile keeps its own head untouched — a target appended to the end
does not change the default goal.

The other two are `genai-metrics.mk` and `genai-build.mk`, and **their recipes are written by
opposite rules.** The metrics one needs make's `-` prefix on the line that runs the suite, or a red
test aborts the recipe before the numbers print and the gate reports a broken setup instead of a
failing suite. The build one must not have it anywhere: there the exit code *is* the verdict, so
carrying on past a failed compile reports a build that never happened. Copying the prefix from one
template to the other breaks each of them in its own direction, and neither failure announces itself.

## Why `modules.json` is the one file a round may edit

Every other project-supplied file is what the round is measured by — the floors, the identity
marker, the two targets — so a round that could change them would have no gate. `modules.json`
decides nothing: no gate reads it, `build-ok` judges `make genai-build`'s exit code, and the steps
read the map only to know what the project is made of. A description that may not follow the code it
describes goes stale by design, so a round that adds, removes or renames a module updates it, and an
unchanged map beside a structural change is a reviewer's finding.

It is not unguarded, only guarded differently. Dropping a module from the map does not drop it from
`genai-build`, so shrinking the map buys nothing at the gate — it only blinds the steps. That is why
the reviewer is told to treat a removed module or a `targets` entry turned to `null` as a blocker
unless the module really was deleted.

`modules-map` checks the other half: that every target the map names is a target make still has. It
asks make itself — `make -n <target>` — because a grep for `^web-build:` misses
`$(MODULES:%=%-build)` and every other generated name. It runs once per round, as an entry rule on
`genai.spec`, not inside the implementation loop: designing against a stale map produces a spec that
is wrong in a way no later gate looks for, and nothing inside a round renames a target.

## Reading the verification

- **Do not judge by `fsx check`'s counts.** It counts every definition on disk, and `fsx init`
  scaffolded a template node of its own (`.flow/nodes/task/`) plus `workflows/default.yaml` — neither
  of which the copy removes, so its totals always come out higher than this workflow's. That is
  normal. What `fsx check` is for is `problems[]`.
- **`ok` and the exit code answer only for errors.** Problems come in two severities, and a
  `warning` leaves both green — so `fsx check && ...` passing is not the same as a clean report.
  `apply.mjs` prints `problems[]` verbatim and judges none of the contents: severity is fsx's to
  assign and the content is the reader's to act on. It does carry one fact into its own exit code —
  `ok: false`, meaning fsx found something it calls an error — because an install that ends on one
  must not report success. Warnings leave the exit code at 0 and still need reading.
- **A green check is not proof the steps can be used.** `fsx nodes -w genai-sprint` answers a
  different question — whether the definitions can be loaded and resolved against the whitelist —
  and a workspace where the first passes while the second fails is a real state. On a
  case-insensitive filesystem a whitelist entry differing from its directory only in case has
  produced exactly that: `check` clean, `nodes` dead.
- **The judgement is the listing against the directory**, never either against a number. A number in
  a document is wrong the first time a step is added or removed, and neither the listing nor the
  directory ever is. A step missing from the listing is a broken install, not something to work
  around.

## The metrics target

**A target that parses human-readable output has not been tested by an install-time run.** The check
runs on a project with few or no source files, where column widths, table alignment and summary lines
all differ from what they will be once there are real ones — so a fragile reporter passes at install
time and fails later, with the gate blaming the code. If the target scrapes formatted text rather
than a machine-readable reporter, say so to the user now and re-run both commands after the first
real source file exists. `genai-guideline` has the reasoning.

Labels, and which are this install's business:

| Label | Means |
|---|---|
| `no_tests` | the **expected** answer on a project with no tests yet |
| `satisfied` | not reachable until something passes a test — `genai.implement`'s job |
| `tests_failing`, `too_many_skipped`, `coverage_below_floor` | the numbers are real and short; not an install problem |
| `metrics_missing` | no marked line came through — **fix at install time** |
| `metrics_unreadable` | a line came and does not satisfy the protocol — **fix at install time** |
| `thresholds_missing` | `tools/genai/thresholds.json` is absent or unreadable — **fix at install time** |

## The build target, and the two labels for the two new files

| Label | Atom | Means |
|---|---|---|
| `built` | `build-ok` | the project compiles |
| `build_failed` | `build-ok` | it does not; the tail of make's output is in the facts. Not an install problem once the recipe is real |
| `target_missing` | `build-ok` | no `genai-build` target — **fix at install time** |
| `consistent` | `modules-map` | every target the map names exists |
| `map_missing` | `modules-map` | `tools/genai/modules.json` is absent — **fix at install time** |
| `map_malformed` | `modules-map` | it does not satisfy its contract. A freshly copied template declares no modules and reports this — **that is the state phase 4 clears** |
| `target_missing` | `modules-map` | the map names a target make does not have; the facts say which module and which |

`build-ok` deliberately does not read `modules.json`, and the separation is worth keeping: a broken
map and a broken build are different problems with different owners, and folding them into one atom
would report a renamed target and a failed compile as the same fact.

## The `e2e.json` commit window is narrow

Committing the file moves the branch tip, and `genai.merge` refuses to enter if the tip moved after
the code review approved it — a review that has passed cannot be re-run. So the file is either
committed **before `genai.code-review` is dispatched**, or left untracked for `genai.merge` to pick
up with the other records. Landing it between those two is the one order that strands the round.

The shipped `contains` is a placeholder that deliberately cannot match anything, so a copy left
unedited reports `wrong_service` rather than passing on a coincidence. It is a file **the project
owns and a round may not write**, for the same reason the coverage floors are: `contains: "e"`
matches nearly any response, and a marker that loose is the check removed.

## Why the baseline commit happens at install time

`genai.implement` is forbidden to commit anything under `openspec/**` — three steps of a round
deliberately keep the specs and review records out of the history, because a commit during a review
invalidates the verdict being recorded. But a developer facing a branch where `make genai-metrics`
cannot run has a real reason to commit the baseline anyway, and then the gate files show up inside
the diff a code review is scoped to. That review is right to flag it and the developer cannot fix it.
Committing the baseline at install time removes the whole situation.

## Why an upgrade refuses while a graph is live

A graph's identity is its workflow, variables, nodes and edges. Changing a definition under a live
run leaves the run measuring against a contract it was not created with. `apply.mjs` exits 1 without
touching anything when `fsx status --json` reports any graph; finish or abort the round first.
