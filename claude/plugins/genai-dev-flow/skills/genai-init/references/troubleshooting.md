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
while failing `git rev-parse HEAD`. So `apply.mjs` tests the two conditions separately and repairs
each on its own — a repository that exists with no commits gets the commit, and nothing else.

Both happen without a flag and without asking. They stay inside this directory, and a project being
set up wants a repository with something for the gates to compare against; the consent to run the
install covers them. The same reasoning puts `fsx skill install` and `openspec init` on the automatic
side. What gets asked is the global binaries, because installing one of those reaches outside this
project.

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

## Why no script writes the Makefile

It used to append two targets. It stopped for two reasons that turned out to be one.

**The recipes need judgement.** `genai-build` on a repository of several modules *is* that project's
module list, and `genai-metrics` has to read whatever machine-readable reporter this project's runner
happens to produce. Neither is something a template knows, so appending a placeholder only moved the
work later while leaving two targets that fail by construction — and an install that ends with two
known-broken targets has trained everybody to skip reading its report.

**And appending to somebody's Makefile is not safe in general.** A real one has includes, variables,
`.PHONY` conventions, a default goal, sometimes already a target of that name. Every one of those
collides quietly. The rule this settled into: a script may only touch a file it can modify
idempotently or detect its way around first, and this is neither.

The three `.mk` files under `assets/project/` stay where they are and changed role — they are the
reference the executor writes from, never files that get copied.

`makefile-head.mk` still matters for the case it was written for: in a project with no Makefile,
`genai-metrics` would otherwise become the file's first target and therefore make's default goal, so
the bare command would run the test suite, and the `## ` description each target carries would have
nothing that renders it. A project that already has a Makefile keeps its own head and its own default
goal — retrofitting either during an install is changing a file that belongs to the project.

The other two are written by **opposite rules**, and this is the detail most often got wrong. The
metrics recipe needs make's `-` prefix on the line that runs the suite, or a red test aborts the
recipe before the numbers print and the gate reports a broken setup instead of a failing suite. The
build recipe must not have it anywhere: there the exit code *is* the verdict, so carrying on past a
failed compile reports a build that never happened. Copying the prefix from one to the other breaks
each in its own direction, and neither failure announces itself.

## Why the version record is a signature, and why it is not in `config.yaml`

`.flow/genai/installed.json` records a sha256 over every shipped flow asset, plus the plugin version
when the end has a manifest to read one from. The signature is what decides whether a project is
behind; the version is for a person reading the file.

A version string alone would not do it: two definitions edited between releases carry the same
number, and an upgrade check reading that number reports nothing to do. What a signature cannot say
is which side is newer — hence both.

The version comes from `assets/plugin-version.json`, which the **compiler stamps** from the plugin's
`plugin.json`. That is what makes it answer on all three ends: Claude and Codex each ship a manifest
a script could have walked up to, but the common end ships a bare `skills/<name>/` with no manifest
anywhere above it, and a support conversation that has to start from a sha256 is a worse one. Running
straight out of `src/` the file still holds its uncompiled placeholder, so the manifest walk stays
behind it as a fallback.

The signature deliberately covers `assets/flow/` only, so bumping a version without touching a
definition does **not** report an upgrade as due. There would be nothing to upgrade.

It cannot live in `.flow/config.yaml`. Both `SystemConfigSchema` and `DefaultsSchema` are zod strict
objects, so an unrecognised key — at the top level or under `defaults:` — comes back from `fsx check`
as `config_invalid`. That is an **error**, not a warning, so it takes `ok` to false, and `apply.mjs`
reads `ok: false` as a failed install. The record would make every run from then on report a break
whose only cause was the record. The engine still runs, which makes it worse: a permanent false alarm
is harder to trace than a crash.

It is also written **after** `.flow/genai/` is copied, not before. That directory is replaced
wholesale on every run, so a record written first is a record the next upgrade deletes.

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
| `no_tests` | the **expected** answer on a project with no tests yet. It also fires when a module *with declared floors* reports none — listing a module claims its numbers get measured |
| `satisfied` | not reachable until something passes a test — `genai.implement`'s job |
| `tests_failing`, `too_many_skipped`, `coverage_below_floor` | the numbers are real and short; not an install problem. The facts name the module |
| `metrics_missing` | no marked line came through — **fix at install time** |
| `metrics_unreadable` | a line came and does not satisfy the protocol — **fix at install time**. On a project of several modules this is also what an unlabelled line gets: add `"module": "<name>"` |
| `thresholds_missing` | `tools/genai/thresholds.json` is absent, unreadable, still keyed by dimension rather than by module, or names a module `modules.json` does not — **fix at install time** |

**The floors are per module**, which is what lets a client covered by its e2e suite go
coverage-unchecked while the service behind it is held to a number. A module absent from
`thresholds.json` is not checked at all; a dimension absent from a module's entry is not checked for
that module. Both live in the file a round may **not** edit, so an exemption is a decision somebody
recorded rather than one a round awards itself — which is exactly why it does not live in
`modules.json`, the one project file a round may rewrite.

## The build target, and the two labels for the two new files

| Label | Atom | Means |
|---|---|---|
| `built` | `build-ok` | the project compiles |
| `build_failed` | `build-ok` | it does not; the tail of make's output is in the facts. Not an install problem once the recipe is real |
| `target_missing` | `build-ok` | no `genai-build` target, or one that runs nothing — an empty recipe and a bare `.PHONY` both exit 0 without building. **Fix at install time** |
| `consistent` | `modules-map` | every target the map names exists |
| `map_missing` | `modules-map` | `tools/genai/modules.json` is absent — **fix at install time** |
| `map_malformed` | `modules-map` | it does not satisfy its contract. A freshly copied template declares no modules and reports this — **that is the state the build-out step clears** |
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
