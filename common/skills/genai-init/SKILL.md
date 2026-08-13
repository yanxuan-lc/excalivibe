---
name: genai-init
description: Run the genai-init setup procedure — route a project as greenfield, brownfield or an upgrade, install the genai step definitions and the workflow whitelist into its `.flow/`, create the sibling requirements directory, and stand up the Makefile targets, module map and coverage floors the project supplies itself. Use when `genai-init` is asked for by name.
---

# Install the genai flow

One-time setup per project. Idempotent — safe to re-run, which is also how it upgrades.

**Read `genai-guideline` first.** It defines what the project has to supply and the protocol behind
the metrics recipe; this skill installs against that protocol.

## The shape

Two kinds of work, and the split between them is what everything else follows from. **Installing the
components** is mechanical: the same files, in the same places, on every project — the scripts own
it. **Configuring the project** is judgement: what its modules are, what proves it builds, what its
numbers are, how its app is recognised — you own that.

| Step | Who | What decides it |
|---|---|---|
| 1 · route | `detect.mjs` | greenfield, brownfield or upgrade — decided by what is missing |
| 2 · ask | you, asking | three rounds of at most four, over what the route step left open |
| 3 · scaffold | `apply.mjs` | the answers, arriving as flags |
| 4 · build-out | you, doing | the route: a walking skeleton, or a derivation from what exists |
| 5 · prove | `make`, `check.mjs`, `measure.mjs` | the project's own commands, run for real |
| 6 · baseline | you, committing | — |

Steps 4 and 5 are a **loop**: a metrics recipe is written right once its output has been read.

Keep the scripts as the way this runs. They exist because the hand-run version spent a model call and
a paragraph of reading per shell line; when one of them is wrong, fix the script, and the fix lands
for every project at once.

## What gets installed where

```
<project>/                            the git repository, and the working directory
  .flow/
    config.yaml                       engine defaults (edited in place)
    workflows/genai-sprint.yaml       the step whitelist
    nodes/genai.*/                    the step definitions (fsx's own nodes/task/ stays alongside)
    genai/*.mjs                       the gate evaluators these definitions call
    genai/templates/                  the records the e2e steps copy and fill in
    genai/installed.json              what was installed, so a later run can tell if it is behind
  Makefile                            `genai-build` and `genai-metrics` — YOU write these
  tools/genai/modules.json            what the repository is made of (every step reads it)
  tools/genai/thresholds.json         the coverage floors and the e2e ceiling (the project sets these)
  tools/genai/e2e.json                how to recognise the running app (the project sets this)

<project>_genai/                      a SIBLING of the repository
  backlogs/
  archive/
```

Three global binaries sit outside all of it and every round needs them: `fsx` (the engine),
`openspec` (specs and changes), and `mdxv` (the renderer `genai.arch-decision` writes through, from
the npm package `mdx-viewer`). The route step checks all three; the scaffold step installs whichever
the user approved.

Name the requirements directory `<repository-directory-name>_genai` and keep it a sibling.
**That naming is load-bearing**: gate commands receive no graph variables, so two of them locate it as
`../$(basename "$PWD")_genai`. It is created as a plain directory — whoever wants version control on
it can add it later, and `apply.mjs` takes `--sibling-git` for anyone who wants it at install time.

## Who decides what

Everything inside this project happens on the scripts' own initiative. What reaches outside it, or
what only the project can know, gets asked.

| Action | How it happens |
|---|---|
| `git init` + an empty first commit | automatic, where there is no repository |
| `fsx skill install` | automatic, where the driving manual is absent |
| `openspec init` | automatic, where `openspec/` is absent |
| the sibling requirements directory | automatic, as a plain directory |
| installing `fsx` / `openspec` / `mdxv` globally | **asked** — it replaces whatever is on PATH, an npm-linked local checkout included |
| the language, the modules, the coverage policy, the app's identity | **asked** — only the project knows |

## Which files a script writes

A script writes a file when it can do so idempotently, or detect its way around first. That leaves
four; everything else is yours.

| File | Whose | How a script handles it |
|---|---|---|
| `Makefile` | the project's | **yours to write** — see step 4 |
| `.gitignore` | the project's | already ignoring `.flow/` → left as it is; otherwise its own known block is replaced |
| `.flow/config.yaml` | fsx's | located by key, and left alone where the value already matches |
| `.flow/genai/installed.json` | this flow's | whole-file rewrite, fixed schema |

Keep `installed.json` where it is. Both of fsx's config schemas are strict objects, so a key it does
not recognise in `.flow/config.yaml` comes back from `fsx check` as `config_invalid` — an **error**,
which the scaffold step's own verification reads as a failed install. It is written **after**
`.flow/genai/` is copied, since that directory is replaced wholesale.

## Step 1 — route

```bash
node <skill-dir>/assets/scripts/detect.mjs --target common
```

Resolve `<skill-dir>` from where this SKILL.md was loaded from. It is read-only, so it runs without
permission and can be re-run at any point to see where an interrupted install stopped.

**Read its last four sections.** `ROUTE` decides which fork step 4 takes. `MODULES` is a block to put
in front of the user verbatim — blank on greenfield, filled in from the code on brownfield. `DECIDE`
is step 2's agenda, already grouped into rounds. `SUGGESTED` is step 3's command line with everything
already-known filled in. A `BLOCKED` section lists conditions to fix first.

The route is decided by **what is missing**:

| Route | When | What it changes |
|---|---|---|
| **greenfield** | no manifest, no commit, no test file | step 4 writes a walking skeleton first |
| **brownfield** | anything else | step 4 derives from what is already there |
| **upgrade** | `genai.*` definitions are already installed | steps 2 and 4 mostly fall away — see below |

Greenfield means the absence of the three things the configuration work reads from: a manifest to
name a module, a commit to compare against, and a test whose numbers set the floors.

The upgrade route compares a **signature** of what ships against the one in `installed.json`. A
signature catches a definition edited between releases, which is the case a version number reports as
up to date.

## Step 2 — ask, in three rounds

**Ask in the rounds the route step prints, in that order.** Keep each round a short list the user
answers at a glance — the route step has already worked out what is open, and lists only what is
unsettled on disk, so a re-run leaves decided things decided.

Put one round in one message and wait for the reply. Whether this host offers a question widget is
unknown here, so ask in plain prose: the rounds are the structure, and asking everything at once is
what they exist to avoid.

| Round | What it settles | Why here |
|---|---|---|
| 1 · permission and access | consent, and the missing global binaries | a refusal ends the procedure, so it comes first |
| 2 · what this project is | `instruction_language`, and **the module list** | everything downstream is written against these |
| 3 · policy | coverage policy, and whether the app answers today | it rides on the shape settled in round 2 |

**Round 1 — permission and access.**

1. **Consent** — automatic (recommend this), manual, or stop.
   - *Automatic:* you run the scripts and do the build-out.
   - *Manual:* you print what each step would do and the user runs it — the command line for a
     scripted step, the files and their contents for the build-out.
   - *Stop:* say plainly that the flow needs these pieces, and leave the project exactly as it is.
2. **The missing global binaries** — install them now, or let the user install them.

On the upgrade route, round 1 also asks whether to upgrade; the route step has already said whether
anything differs.

**Round 2 — what this project is.**

1. **`instruction_language`** — the language of the requirement briefs, which is the language of
   whoever wrote them rather than of whoever is typing now. It sets the language of every dispatched
   instruction, and so of the reports and documents executors write back. A short choice, with a
   handful of answers.
2. **The modules** — **put the route step's `MODULES` block in front of the user as it stands, and
   take the answer as free text.** A module list is a table, so it is written out rather than chosen
   from.

   Ask for one line each, carrying the three things only a person holds:

   ```
   - <name>: <what it is for>, <stack>
   ```
   ```
   - web: the browser client, TypeScript + Shadcn + Vite
   - server: the HTTP API behind it, Go + Gin
   ```

   A single-module project is one line. On the brownfield route the block arrives **already filled in
   from the code**, so the user corrects a draft and supplies what each module is for. Render it in
   the user's language when you present it.

**Derive the rest.** Only the name, the role and the stack are asked for; everything else in
`modules.json` comes from them:

| Field | Where it comes from |
|---|---|
| `path` | the module name as a directory; `.` for a single-module project |
| versions | the current stable release of that toolchain |
| `targets` | the module name — `web-build`, `web-lint`, `web-test`; on brownfield, mapped to the commands the route step listed |
| `docs` | the conventional README path |
| `depends_on` | what the roles and the code imply |

All of it lands in `modules.json`, where step 5's `modules-map` check reads it back against make — so
a wrong guess shows up at the prove step, with the user able to see it in the file.

**Round 3 — policy.**

1. **Coverage policy — which dimensions apply, and which modules are allowed no tests.** The numbers
   come from step 5, once something has measured them, on both routes.
2. **Does the app exist and answer on a URL today?** This decides whether step 3 writes
   `tools/genai/e2e.json`. A fresh repository usually answers no, and that is fine.

`instruction_language` covers the framework-rendered half of each instruction. The step briefs ship
inside this plugin as English source and are injected verbatim, so a dispatched instruction carries
both: an English brief for a model to read, then a rendered section in the configured language for
the artifacts people read.

**`mdxv` is on the prerequisite list because a round needs it.** `genai.arch-decision` sends its
executor to `mdx-artifact`, which renders through the global `mdxv` binary — the npm package is named
`mdx-viewer`, which is why `command -v mdx-viewer` finds nothing on a machine that has it. Absent, that
step fails as it tries to write its document, a long way from anything that would explain why. Where
the user prefers to keep their globals clean, tell them `mdx-artifact` also works through
`npx -p mdx-viewer mdxv doc.mdx`, slower on first use.

The **notification consent and the browser stack** belong to **`/install-computer-use`**, which this
plugin already declares a dependency on. Point the user there for those.

## Step 3 — scaffold

**Run the route step's `SUGGESTED` line**, with step 2's answers filled in. That line is already
copy-pasteable; the shape below is for reading — square brackets mean "optional", and `--install`
carries only what the user approved:

```bash
node <skill-dir>/assets/scripts/apply.mjs --target common --lang zh-CN [--install fsx,openspec,mdxv] [--e2e]
```

It installs the global binaries `--install` names, creates the repository and its first commit,
installs the flow-scratch skill and initialises `openspec/`, scaffolds `.flow/` and ignores it, copies
the definitions with their evaluators and the whitelist, retires any `genai.*` step that no longer
ships, edits the three engine defaults in place, copies the `tools/genai/` templates, creates the
sibling directories, records what it installed, and verifies the shape with `fsx check` and
`fsx nodes -w genai-sprint`.

**This step is identical on every route**, as is step 1. The routes diverge at what gets asked and
what you build.

Three more flags exist for when someone asks: `--patience` (default 5), `--budget` (default 50), and
`--sibling-git`. Every other flag is refused, so a typo announces itself.

Three things to read in its output:

- **`!` lines** — a step that did not happen, or something handed to you rather than judged.
  `fsx check`'s `problems[]` above all: a `warning` there leaves `ok` true and is the reader's to act
  on.
- **`new in the working tree`** — `openspec init` writes more than `openspec/`: given `--tools` it
  also drops command and skill files wherever this host keeps them. Those files belong to the
  project, so show the user and let them decide what to track. On a brownfield project, go through
  this list line by line.
- **The exit code.** Non-zero means a step it was told to do did not happen, or `fsx check` reported
  an error. "Already there" exits 0.

## Step 4 — build-out, where the two routes differ

### Greenfield: a walking skeleton first

Write the smallest thing that can be described. Four things have to be true before step 5 means
anything:

- one module — or one per module, if step 2 said several
- one **passing** test
- one build that **exits 0**
- one thing that **answers** — a URL or a command — and one e2e that covers it

Delegate the craft: choosing and wiring the test framework belongs to **`tdd`**, the Makefile,
compose and Dockerfile conventions to **`devops-guideline`**, and the code layout to
**`coding-guideline`**. This skill's business is that the skeleton exists.

**Treat the skeleton walking as the completion criterion.** A passing test is what makes `satisfied`
reachable, the floors verifiable and `e2e.json` fillable, so it is what turns this into a project that
can start a round.

### Brownfield: wrap what is already there

**Wrap the commands the project already has.** A project with working lint, test and coverage has
already answered those questions, and one definition of how to build something stays true where two
can disagree. The route step listed the commands it runs; write the Makefile targets from that
listing.

### Both routes: the Makefile, then the four files

**You write the Makefile.** Its recipes describe *this* project — on several modules the build recipe
is that project's module list — and an existing one carries includes, variables and a default goal
that only reading it can respect. Write from `assets/project/*.mk` as the reference.

Three rules when an existing Makefile is in front of you:

- **Keep the default goal.** Whatever the bare `make` runs today, it still runs afterwards.
- **Wire in.** Where `test` / `lint` / `build` targets exist, name them as prerequisites of
  `genai-build`, so the project keeps one definition of how each module is built.
- **Give each recipe the failure behaviour its gate reads.** `genai-metrics` takes make's `-` prefix
  on the line that runs the suite, so the numbers still print when a test fails and the gate reports
  a failing suite. `genai-build` runs bare, so make stops at the failing line and the exit code means
  what the gate takes it to mean.

Where the project has no Makefile, write one, `.DEFAULT_GOAL := help` included.

Then the four project-owned files:

**`tools/genai/modules.json`** — which directories are modules, what each is for, and which consume
another's contract. A project that is one thing declares one module with `path` `.`. `targets` names
**Makefile targets**, so the commands stay defined once, in the Makefile. Write `null` where a module
has no target of that kind, which is also how a module with no tests says so — that is the module the
coverage number cannot see, and worth recording. This is the one project-supplied file **a round may
edit**, so it stays free to follow the code it describes.

**`tools/genai/thresholds.json`** — written in step 5, from the measurement.

**`tools/genai/e2e.json`**, if step 3 wrote it. Declare **one** of two shapes, with `contains` either
way:

| The project… | Declare | Example |
|---|---|---|
| listens on a port | `url` (+ `status` if not 200) | `{"url": "http://127.0.0.1:5173/healthz", "contains": "widget-api"}` |
| is a CLI, a library, a batch job | `command` | `{"command": "node src/cli.js --version", "contains": "lintly 1.2.0"}` |
| has several faces — a client and its API | `targets` | a list of the two shapes above, each with a `name`, at most four |

Make `contains` something specific to **this** build — the name in a health payload, a version string,
the title a known route renders. `ok`, `healthy` and `200` match every other process on the machine.
**Two shapes, one argument**: an open port identifies no particular service, and a binary on PATH
identifies no particular build, so each shape supplies the half the other lacks and one of them is
declared. For a `command`, both streams are read and the marker is what counts — `--version` exits 0
and `--help` often exits 2, so the exit code says little.

Where nothing runs yet, **tell the user in one sentence** what will be needed: a URL or a command, and
a marker only this build returns. **A project that can answer one of those is a project that can
merge** — `genai.merge` premises on this step, and `genai.e2e` waits with `config_missing`, spending
no verdict, no patience and no attempt.

## Step 5 — prove, and set the floors from what it measures

```bash
node .flow/genai/check.mjs install-ready   # ready | unfinished | broken
```

**This is what says the install is done.** It runs the same four evaluators the gates run and applies
the one thing that used to live only in prose: which of their labels are acceptable *at install time*.
That matters because a green board is not the criterion — `no_tests` is the **correct** answer on a
project that has none, `unreachable` is fine while the app is down, and `tests_failing` on an existing
project belongs to the next round. Read the other way round, half the failures look like success.

| Verdict | Means | What to do |
|---|---|---|
| `ready` | a round can start | commit the baseline and report |
| `unfinished` | something is still to be written | `blocking` names each one — write it and re-run |
| `broken` | something exists and contradicts itself or reality | look at what is already there: a file that changed shape, a marker pointing at the wrong service |

The individual checks stay available for working out *why*, and they carry the detail:

```bash
make genai-build                           # exit 0 when the project compiles
make genai-metrics                         # one genai-metrics: line per module
node .flow/genai/check.mjs modules-map      # consistent
node .flow/genai/check.mjs build-ok         # built
node .flow/genai/check.mjs metrics          # the numbers and the floors behind them
node .flow/genai/check.mjs app-identity     # identified
```

Then the floors — **measure first, write second**, on both routes:

```bash
node <skill-dir>/assets/scripts/measure.mjs        # runs `make genai-metrics`, proposes the floors
```

It takes no `--target`, since reading a number is the same on every end, and it writes nothing:
proposing is its job, agreeing the numbers is the user's, writing the file is yours. Before the recipe
exists it says so; pass `--command` to point it at whatever the project runs its tests with today and
take that answer as an estimate.

Set each floor at or below what came out. **A round may not edit this file**, so a floor the project
already clears is what keeps a round fixable.

**The floors are per module**, because coverage is not one number:

```json
{
  "coverage": {
    "server": { "lines": 0.8 },
    "core":   { "lines": 0.9, "branches": 0.85 }
  }
}
```

- **A module left out is not coverage-checked at all.** That is how a browser client covered by its
  e2e suite is declared, and it lives here rather than in `modules.json` because a round may edit
  that file and may not edit this one — so an exemption is a decision somebody made rather than one a
  round awards itself.
- **A dimension left out of a module's entry is not checked for that module.** That is how Go says
  what it can measure: its cover reports statements and nothing else.
- **A module that is listed reports tests**, or the gate reads it as `no_tests`. Listing a module is
  a claim that its numbers get measured.

Leave the `e2e` block at the shipped values unless the user has a reason; it is the ceiling on how
much of a round may go unscripted, and it takes an explicit value to change.

**What has to hold here is the shape**, and `install-ready` is what encodes that. Worth knowing which
way two labels fall, because both look alarming and neither is this install's problem: `no_tests` is
expected before anything is implemented, and `tests_failing` on an existing project is the next
round's to fix. The one that *is* this install's own mistake is `coverage_below_floor` — floors set
above what the project measures, which a round may not edit its way out of.

Read what the metrics target actually runs, since numbers that were never measured are the one thing
these commands take at face value. A target that reads a machine-readable reporter is the one to keep;
[references/troubleshooting.md](references/troubleshooting.md) has why a formatted-text scraper passes
here and fails later.

For `app-identity`, `unreachable` means the app is down, which is fine at install time.
`wrong_service` means the marker never appeared, so the URL points at something else.

## Step 6 — commit the baseline, then report

```bash
git add Makefile tools/genai openspec/config.yaml .gitignore   # whichever of these exist
git commit -m "chore: genai flow baseline"
```

Name the paths explicitly, so the commit holds exactly what this install produced. Committing now is
what keeps these files out of a round's first review — the troubleshooting reference has the full
reason, and **`e2e.json`'s window is narrow**: it goes in before `genai.code-review` is dispatched, or
stays untracked for `genai.merge` to pick up.

Then report, briefly, **against `install-ready`'s verdict rather than against an impression**. `ready`
is what "done" means here, and saying it on anything else is the one report that costs a person a
whole round to discover. On `unfinished` or `broken`, give **what the user has to supply**, one
sentence per entry in `blocking`. On a brownfield project, add one line: the existing specs under
`docs/` stay where they are, so the first round starts from an empty backlog and moving them across is
a person's job.

## Upgrading

```bash
node <skill-dir>/assets/scripts/apply.mjs --target common --upgrade
```

Definitions and evaluators are replaced wholesale, and everything the project owns is left as it is. A
`genai.*` step that no longer ships is **retired**, because `fsx check` counts every definition on
disk and one that disagrees with its own directory name holds the whole check at `ok: false`. Retiring
covers `genai.*` alone — fsx's own `task/` and anything the project wrote share that directory.
**Finish or abort a live round first**: `apply.mjs` refuses while a graph is in flight, so a run keeps
measuring against the contract it was created with.

**An upgrade reports what a new definition gates on and the project has never been asked for** — the
`genai-build` target and `tools/genai/modules.json` arrived that way. The map lands as a placeholder;
the Makefile target is reported for you to write. Deal with both **before the next round starts**,
since `genai.spec` checks the map at its first rule and `genai.implement` checks the target.

## Boundaries — where the neighbouring work lives

| Concern | Owner |
|---|---|
| explaining the flow, and the metrics protocol | `genai-guideline` |
| creating requirements | `genai-backlog` |
| migrating an existing project's specs into openspec | a person, by hand |
| creating a graph | `genai-flow` — a graph is per round |
| a gate the project already has | the project's own command, wrapped |
