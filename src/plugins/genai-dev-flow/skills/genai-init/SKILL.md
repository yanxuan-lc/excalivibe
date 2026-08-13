---
name: genai-init
description: Run the genai-init setup procedure — route a project as greenfield, brownfield or an upgrade, install the genai step definitions and the workflow whitelist into its `.flow/`, create the sibling requirements directory, and stand up the Makefile targets, module map and coverage floors the project supplies itself. Use when `genai-init` is asked for by name.
command: true
---

# Install the genai flow

One-time setup per project. Idempotent — safe to re-run, which is also how it upgrades.

**Read `genai-guideline` first.** It defines what the project has to supply and the protocol behind
the metrics recipe; this skill installs against that protocol rather than restating it.

## The shape

Two kinds of work, and the split between them is what everything else follows from. **Installing the
components** is mechanical: the same files, in the same places, on every project. **Configuring the
project** is judgement: what its modules are, what proves it builds, what its numbers are, how its
app is recognised. The scripts own the first and refuse the second.

| Step | Who | What decides it |
|---|---|---|
| 1 · route | `detect.mjs` | greenfield, brownfield or upgrade — decided by what is missing |
| 2 · consent | you, asking | automatic, manual, or stop |
| 3 · ask | you, asking | one pass over everything the route step could not answer |
| 4 · scaffold | `apply.mjs` | nothing — every branch arrived as a flag |
| 5 · build-out | you, doing | the route: a walking skeleton, or a derivation from what exists |
| 6 · prove | `check.mjs`, `make` | the project's own commands, run for real |
| 7 · baseline | you, committing | — |

Steps 5 and 6 are a **loop, not a line**: a metrics recipe is not written right until its output has
been read once.

**Do not go back to running the install one command at a time.** The scripts exist because that
version spent a model call and a paragraph of reading per shell line. If a script is wrong, fix the
script — the failure is then fixed for every project, not for this one.

## What gets installed where

```
<project>/                            the git repository, and the working directory
  .flow/
    config.yaml                       engine defaults (edited in place, never overwritten)
    workflows/genai-sprint.yaml       the step whitelist
    nodes/genai.*/                    the step definitions (fsx's own nodes/task/ stays alongside)
    genai/*.mjs                       the gate evaluators these definitions call
    genai/templates/                  the records the e2e steps copy and fill in
    genai/installed.json              what was installed, so a later run can tell if it is behind
  Makefile                            `genai-build` and `genai-metrics` — WRITTEN BY YOU, not by a script
  tools/genai/modules.json            what the repository is made of (every step reads it)
  tools/genai/thresholds.json         the coverage floors and the e2e ceiling (the project sets these)
  tools/genai/e2e.json                how to recognise the running app (the project sets this)

<project>_genai/                      a SIBLING of the repository, not inside it
  backlogs/
  archive/
```

Three global binaries sit outside all of it and every round needs them: `fsx` (the engine),
`openspec` (specs and changes), and `mdxv` (the renderer `genai.arch-decision` writes through, from
the npm package `mdx-viewer`). The route step checks all three; the scaffold step installs whichever
the user approved.

The requirements directory is a sibling, and its name is `<repository-directory-name>_genai`.
**That naming is load-bearing**: gate commands cannot receive graph variables, so they locate it as
`../$(basename "$PWD")_genai`. A different name breaks two gates silently.

## Which files a script may write

A script may only touch a file it can modify **idempotently**, or detect its way around first.
Everything else goes to you. That leaves exactly four:

| File | Whose | How |
|---|---|---|
| `Makefile` | the project's | **yours** — see step 5. No script writes it |
| `.gitignore` | the project's | already ignoring `.flow/` → untouched; otherwise its own known block, replaced not appended |
| `.flow/config.yaml` | fsx's | located by key, unchanged when the value already matches |
| `.flow/genai/installed.json` | this flow's | whole-file rewrite, fixed schema |

`installed.json` cannot live in `.flow/config.yaml`: both of fsx's config schemas are strict objects,
so an unrecognised key there comes back from `fsx check` as `config_invalid` — an **error**, not a
warning, which the scaffold step's own verification reads as a failed install. It would report a
break whose only cause is itself. It is also written **after** `.flow/genai/` is copied, because that
directory is replaced wholesale.

## Step 1 — route

<!--@claude-->
```bash
node <skill-dir>/assets/scripts/detect.mjs --target claude
```
<!--@codex-->
```bash
node <skill-dir>/assets/scripts/detect.mjs --target codex
```
<!--@common-->
```bash
node <skill-dir>/assets/scripts/detect.mjs --target common
```
<!--@end-->

Resolve `<skill-dir>` from where this SKILL.md was loaded from. It writes nothing, so it needs no
permission and can be re-run at any point to see where an interrupted install stopped.

**Read its last three sections.** `ROUTE` decides which of the two forks step 5 takes. `DECIDE` is
step 3's agenda. `SUGGESTED` is step 4's command line with everything already-known filled in. A
`BLOCKED` section means stop: those are conditions no answer can work around.

The route is decided by **what is missing**, never by what the project looks like:

| Route | When | What it changes |
|---|---|---|
| **greenfield** | no manifest, no commit, no test file | step 5 writes a walking skeleton first |
| **brownfield** | anything else | step 5 derives from what is already there |
| **upgrade** | `genai.*` definitions are already installed | steps 3 and 5 mostly fall away — see below |

"Greenfield" is not a kind of project. It is the absence of the three things the configuration work
reads from: a manifest to name a module, a commit to compare against, and a test whose numbers set
the floors.

The upgrade route compares a **signature** of what ships against the one in `installed.json`, not a
version string — a definition edited between releases carries the same version number, and a check
that read the number would report nothing to do.

## Step 2 — consent, once, for the whole procedure

Offer three, and recommend the first:

- **automatic** — you run the scripts and do the build-out.
- **manual** — you output what each step would do, and the user runs it. For the scripted steps that
  is the command line; for the build-out it is which files to write and what goes in them. Do not
  write a parallel hand-operated procedure — that is the version the scripts replaced.
- **stop** — a real answer. Say plainly that the flow cannot be installed without this, and leave the
  project **untouched**, rather than doing the half that needs no permission.

On the upgrade route this is also where you ask whether to upgrade at all; the route step already
read the version and said whether anything differs.

## Step 3 — ask, once

Put every open question in **one** exchange. The route step already knows what is missing, so the
user should be answering a short list rather than being interviewed through ten steps. It only lists
what is not already settled on disk, so a re-run does not walk anyone back through decisions they
have made.

Common to both forks:

1. **The missing prerequisites** — install them now, the user installs them, or stop.
2. **A repository, or its first commit**, if either is missing. The user's call.
3. **`instruction_language`** — the language of the requirement briefs, *not* the language of whoever
   is typing. It decides the language of every dispatched instruction, and therefore of the reports
   and documents executors write back.
4. **Whether the requirements directory is its own git repository.** It sits outside the code
   repository, so it has no history and no backup unless it is given one.
5. **Does the app exist and answer on a URL today?** This decides whether step 4 writes
   `tools/genai/e2e.json` at all. A fresh repository usually cannot answer honestly, and that is fine.
6. **Coverage policy — which dimensions apply, and which modules are allowed no tests.** Not the
   numbers. **The numbers come from step 6, after something has measured them**, on both routes.

Greenfield adds: **the module shape** (one module or several, and what each is for) and **the
technology stack**, since step 5 has to write code and neither can be inferred from an empty
directory.

Brownfield adds: **confirmation rather than preference** — the route step listed the manifest
directories, the runners, and the commands this project already runs. Ask whether that reading is
right, and which existing command each module's build, lint and test should point at.

`instruction_language` **does not translate the step briefs.** Those ship inside this plugin as
English source and are injected verbatim, so every dispatched instruction is two languages at once:
an English brief, then a framework-rendered section in the configured language. That is the intended
split — the brief is read by a model, the artifacts are written for people.

**`mdxv` is in the prerequisite list because a round dies without it, and the rest of `computer-use`
is not.** `genai.arch-decision` sends its executor to `mdx-artifact`, which renders through the global
`mdxv` binary — the npm package is named `mdx-viewer`, which is why `command -v mdx-viewer` finds
nothing on a machine that has it. Absent, that step fails at the moment it tries to write its
document, a long way from anything that would explain why. If the user declines a global install,
`mdx-artifact` still works through `npx -p mdx-viewer mdxv doc.mdx` — slower on first use, and worth
saying rather than presenting the refusal as a dead end.

The **notification consent and the browser stack** remain **`/install-computer-use`**'s, which this
plugin already declares a dependency on. One named binary that blocks a step is a dependency; the
whole of that skill's list would be a second copy to keep true.

## Step 4 — scaffold

**Run the route step's `SUGGESTED` line**, with step 3's answers filled in. That line is already
copy-pasteable; the shape below is only for reading — the square brackets are notation for
"optional", not shell syntax, and `--install` takes **only** what was reported missing:

<!--@claude-->
```bash
node <skill-dir>/assets/scripts/apply.mjs --target claude --lang zh-CN \
  [--install fsx,openspec,mdxv,skill,openspec-dir] [--git-init|--git-commit] [--e2e] [--sibling-git]
```
<!--@codex-->
```bash
node <skill-dir>/assets/scripts/apply.mjs --target codex --lang zh-CN \
  [--install fsx,openspec,mdxv,skill,openspec-dir] [--git-init|--git-commit] [--e2e] [--sibling-git]
```
<!--@common-->
```bash
node <skill-dir>/assets/scripts/apply.mjs --target common --lang zh-CN \
  [--install fsx,openspec,mdxv,skill,openspec-dir] [--git-init|--git-commit] [--e2e] [--sibling-git]
```
<!--@end-->

It installs only what `--install` names, scaffolds `.flow/` and ignores all of it, copies the
definitions with their evaluators and the whitelist, removes any `genai.*` step that no longer ships,
edits the three engine defaults in place, copies the `tools/genai/` templates, creates the sibling
directories, records what it installed, and verifies the shape with `fsx check` and
`fsx nodes -w genai-sprint`.

**This step is identical on both routes.** So are the two before it, apart from what gets asked.

Two more flags exist and are rarely needed: `--patience` (default 5) and `--budget` (default 50).
Pass them only when the user asks for different numbers. Anything else is refused rather than
ignored — a mistyped flag would otherwise go unnoticed and leave the log explaining the absence of a
file with a reason nobody gave.

Three things to read in its output:

- **`!` lines.** Every one is either a step that did not happen or something the script hands to you
  rather than judging — `fsx check`'s `problems[]` above all, since a `warning` there leaves `ok`
  true and is nobody's business but the reader's.
- **`new in the working tree`.** `openspec init` writes more than `openspec/`: given `--tools` it
  also drops command and skill files wherever this host keeps them. Those files are the project's,
  not this flow's — show the user and let them decide what to track. On a brownfield project this
  list is longer and worth going through line by line.
- **A non-zero exit.** Either a step it was told to do did not happen, or `fsx check` reported
  something it calls an **error** rather than a warning. "Already there" exits 0.

<!--@codex-->
Codex plugins cannot bundle agents, so copy them once by hand — `apply.mjs` deliberately does not,
because the path is outside the skill directory:

```bash
cp <plugin-root>/../agents/genai-*.toml ~/.codex/agents/
```
<!--@end-->

## Step 5 — build-out, which is where the two routes differ

### Greenfield: a walking skeleton first

There is nothing here to describe yet, so write the smallest thing that can be described. Four
things have to be true before step 6 can mean anything:

- one module — or one per module, if step 3 said several
- one **passing** test
- one build that **exits 0**
- one thing that **answers** — a URL or a command — and one e2e that covers it

Delegate rather than improvise: choosing and wiring the test framework is **`tdd`**'s subject, the
Makefile, compose and Dockerfile conventions are **`devops-guideline`**'s, and the code layout is
**`coding-guideline`**'s. This skill's business is that the skeleton exists, not what it looks like.

**The completion criterion is the skeleton walking, not the files existing.** Without a passing test,
`satisfied` is unreachable, the floors cannot be verified and `e2e.json` cannot be filled — handing
that over is handing over a project that will be rejected at its first round.

### Brownfield: wrap what is already there

The first rule is **do not rebuild what the project has**. A project with working lint, test and
coverage does not need this install to invent any of them, and a second definition of how to build
something is one that can disagree with the first. The route step listed the commands it already
runs; the Makefile targets are written **from that listing**.

### Both routes: the Makefile, and then the four files

**No script writes the Makefile.** Its recipes describe *this* project — on several modules the build
recipe is that project's module list — and appending to somebody's existing file collides with their
includes, their variables and their default goal. `assets/project/*.mk` are the reference to write
from, not files that get copied.

Modifying an existing Makefile, keep three rules:

- **Do not change the default goal.** Whatever the bare `make` runs today, it still runs afterwards.
- **Wire in, do not restate.** Where `test` / `lint` / `build` targets exist, `genai-build` names them
  as prerequisites rather than copying their commands.
- The two recipes have opposite conventions about failure, and this is the detail most often got
  wrong: `genai-metrics` takes make's `-` prefix on the line that runs the suite, or a failing test
  aborts the recipe before it prints and the gate reports a broken setup instead of a failing suite.
  `genai-build` takes **no** `-` prefix on any line, because stopping at the failure is the result.

A project with no Makefile at all gets a new one, `.DEFAULT_GOAL := help` included.

Then the four project-owned files:

**`tools/genai/modules.json`** — which directories are modules, what each is for, and which consume
another's contract. A project that is one thing declares one module with `path` `.`. `targets` names
**Makefile targets, not commands** — the commands already live in the Makefile, and a second copy
here is one that can disagree. `null` says this module has no target of that kind, which is also how
a module with no tests says so, and that is worth writing down: it is the module the coverage number
cannot see. This is the one project-supplied file **a round may edit** — it describes rather than
judges, so it has to be free to follow the code.

**`tools/genai/thresholds.json`** — written in step 6, after the measurement. Not before.

**`tools/genai/e2e.json`**, if step 4 wrote it. Declare **exactly one** of two shapes, and `contains`
either way:

| The project… | Declare | Example |
|---|---|---|
| listens on a port | `url` (+ `status` if not 200) | `{"url": "http://127.0.0.1:5173/healthz", "contains": "widget-api"}` |
| never will — a CLI, a library, a batch job | `command` | `{"command": "node src/cli.js --version", "contains": "lintly 1.2.0"}` |
| has several faces — a client and its API | `targets` | a list of the two shapes above, each with a `name`, at most four |

`contains` is something specific to **this** build — the name in a health payload, a version string,
the title a known route renders. `ok`, `healthy` and `200` are not markers: every other process on
the machine says those too. **Two shapes, one argument**: an open port proves nothing about which
service answered, and a binary on PATH proves nothing about which build answered. Declaring both is
refused. For a `command`, the exit code is not a criterion (`--version` exits 0, `--help` often exits
2) and both streams are read; what is measured is whether the marker came out.

If nothing runs yet, **tell the user in one sentence** what will be needed: a URL or a command, and a
marker only this build returns. **A project that can never answer either is a project that can never
merge** — `genai.merge` premises on this step. Nothing earlier in a round touches it, and `genai.e2e`
then refuses to start with `config_missing`, which spends no verdict, no patience and no attempt.

## Step 6 — prove, and set the floors from what it measures

```bash
make genai-build                          # exit 0 when the project compiles
make genai-metrics                        # one genai-metrics: line with real numbers
node .flow/genai/check.mjs modules-map     # consistent
node .flow/genai/check.mjs build-ok        # built
node .flow/genai/check.mjs metrics         # see below
node .flow/genai/check.mjs app-identity    # identified
```

Then the floors, and **in this order — measure first, write second**, on both routes:

```bash
node <skill-dir>/assets/scripts/measure.mjs        # runs `make genai-metrics`, proposes the floors
```

It takes no `--target`, because nothing about reading a number differs per end. It writes nothing:
proposing is the whole of the job, agreeing the numbers is the user's, and writing the file is yours.
Before the recipe exists it says so rather than guessing — pass `--command` to point it at whatever
the project runs its tests with today, and take that answer as an estimate.

Setting them from a sense of what a project like this should manage is how a floor lands above what
it measures, and the number that catches it is one you had already been shown. **A round may not edit
this file**, so a floor above where the project stands rejects every round with nothing able to fix
it. A floor of `null` opts that dimension out — the only way out, and visible in the file. Which
dimensions are even reportable is a toolchain fact rather than a policy — Go's cover has statements
and nothing else — so `null` the ones nothing measures. In a repository of several modules, the
`targets.test: null` entries are the modules the number cannot see; their source files belong in the
denominator. The `e2e` block is the ceiling on how much of a round may go unscripted; leave it at the
shipped values unless the user has a reason, and note that **omitting it does not opt out** the way
an omitted floor does.

**What has to be true here is the shape, not the verdict.** On a project with no tests the expected
label is `no_tests`; `satisfied` is not reachable until something passes a test, and getting there is
`genai.implement`'s job. On an existing project with a red suite, `tests_failing` is **the next
round's problem, not this install's** — report it plainly and carry on. The three labels that mean a
broken install are `metrics_missing`, `metrics_unreadable` and `thresholds_missing`.

A `satisfied` reached with fabricated numbers is the one failure no command here can catch, so read
what the target actually runs. And **a target that parses human-readable output has not been tested
by this**: see [references/troubleshooting.md](references/troubleshooting.md).

For `app-identity`, `unreachable` means the app is not up, which is fine at install time.
`wrong_service` is not: the marker does not appear, so the URL points at something else.

## Step 7 — commit the baseline, then report

```bash
git add Makefile tools/genai openspec/config.yaml .gitignore   # whichever of these exist
git commit -m "chore: genai flow baseline"
```

Add paths explicitly. `git add -A` here sweeps in whatever else is lying around the working
directory. Why it has to be now rather than later is in the troubleshooting reference, and
**`e2e.json`'s window is narrow** — it goes in before `genai.code-review` is dispatched, or is left
untracked for `genai.merge` to pick up.

Then report, briefly. Done means done. Not done means **what the user has to supply**, in one
sentence per item — not a replay of what was run. On a brownfield project, say in one line that the
existing specs under `docs/` have not been migrated: the first round starts with an empty backlog,
and moving them across is a person's job, deliberately not this install's.

## Upgrading

<!--@claude-->
```bash
node <skill-dir>/assets/scripts/apply.mjs --target claude --upgrade
```
<!--@codex-->
```bash
node <skill-dir>/assets/scripts/apply.mjs --target codex --upgrade
```
<!--@common-->
```bash
node <skill-dir>/assets/scripts/apply.mjs --target common --upgrade
```
<!--@end-->

Definitions and evaluators are replaced wholesale; nothing merges, and nothing the project owns is
touched. A `genai.*` step that no longer ships is **removed** — left behind it would keep being
counted by `fsx check`, and one that disagrees with its own directory name holds the whole check at
`ok: false` with no later upgrade ever touching it. Only `genai.*` is removed: fsx's own `task/` and
anything the project wrote itself share that directory. **It refuses while a graph is live** —
changing a definition under a live run leaves the run measuring against a contract it was not created
with. Finish or abort the round first.

**What an upgrade reports rather than writes is what a new definition gates on and the project has
never been asked for** — the `genai-build` target and `tools/genai/modules.json` arrived that way.
The map lands as a placeholder; the Makefile target is reported, because no script writes that file.
Both have to be dealt with **before the next round starts**: until they are, `genai.spec` refuses at
its first rule and `genai.implement` rejects on a missing target, on a project whose only mistake was
being installed earlier.

## What this does not do

- Does not explain the flow or define the metrics protocol — that is `genai-guideline`
- Does not create requirements — that is `genai-backlog`
- Does not migrate an existing project's specs into openspec — that is a person's job
- Does not create a graph — a graph is per round, not per project
- Does not reimplement a gate the project already has; wrap the existing command
