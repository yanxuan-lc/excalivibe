---
name: genai-init
description: Run the genai-init setup procedure — install the genai step definitions and the workflow whitelist into a project's `.flow/`, create the sibling requirements directory, and stand up the make target and coverage floors the project supplies itself. Use when `genai-init` is asked for by name.
command: true
---

# Install the genai flow

One-time setup per project. Idempotent — safe to re-run to upgrade the definitions.

**Read `genai-guideline` first.** It defines what the project has to supply and the protocol behind
phase 4; this skill installs against that protocol rather than restating it.

## Four phases, and what decides each one

| Phase | Who decides | Cost |
|---|---|---|
| 1 · detect | `detect.mjs` — every branch is code, what comes out is already a conclusion | one call, read-only |
| 2 · ask | you, in **one** pass over everything phase 1 could not answer | one exchange |
| 3 · apply | `apply.mjs` — no judgement of its own; phase 2's answers arrive as flags | one call |
| 4 · finish | you, because a script cannot pick a test reporter or a service marker | a few calls |

**Do not go back to running the install one command at a time.** The two scripts exist because that
version spent a model call and a paragraph of reading per shell line. If a script is wrong, fix the
script — the failure is then fixed for every project, not for this one.

## What gets installed where

```
<project>/                            the git repository, and the working directory
  .flow/
    config.yaml                       engine defaults
    workflows/genai-sprint.yaml       the step whitelist
    nodes/genai.*/                    the step definitions (fsx's own nodes/task/ stays alongside)
    genai/*.mjs                       the gate evaluators these definitions call
    genai/templates/                  the records the e2e steps copy and fill in
  Makefile                            `genai-metrics` target; bare `make` shows help
  tools/genai/thresholds.json         the coverage floors and the e2e ceiling (the project sets these)
  tools/genai/e2e.json                how to recognise the running app (the project sets this)

<project>_genai/                      a SIBLING of the repository, not inside it
  backlogs/
  archive/
```

Three global binaries sit outside all of it and every round needs them: `fsx` (the engine),
`openspec` (specs and changes), and `mdxv` (the renderer `genai.arch-decision` writes through, from
the npm package `mdx-viewer`). Phase 1 checks all three; phase 3 installs whichever the user approved.

The requirements directory is a sibling, and its name is `<repository-directory-name>_genai`.
**That naming is load-bearing**: gate commands cannot receive graph variables, so they locate
it as `../$(basename "$PWD")_genai`. A different name breaks two gates silently.

## Phase 1 — detect

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

Resolve `<skill-dir>` from where this SKILL.md was loaded from. The report covers the prerequisites,
the repository, `.flow/`, the files the project owns, the test toolchain phase 4 needs, and any hint
of a health endpoint. It writes nothing, so it needs no permission and can be re-run at any point to
see where an interrupted install stopped.

**Read its last two sections and nothing else matters much.** `DECIDE` is phase 2's agenda.
`SUGGESTED` is phase 3's command line with everything already-known filled in. A `BLOCKED` section
means stop: those are conditions no answer can work around.

## Phase 2 — ask, once

Put every open question in **one** exchange. Phase 1 already knows what is missing, so the user
should be answering a short list rather than being interviewed through ten steps.

1. **The missing prerequisites** — offer three answers, not two: install them now, install them
   themselves, or stop. Recommend the first. **Stopping is a real answer**: say plainly that the
   flow cannot be installed without them and leave the project untouched, rather than doing the
   half that needs no permission.
2. **A repository, or its first commit**, if phase 1 found either missing. Creating either is the
   user's call. If they would rather do it themselves, stop here and come back.
3. **`instruction_language`** — the language of the requirement briefs, *not* the language of
   whoever is typing. It decides the language of every dispatched instruction, and therefore of the
   reports and documents executors write back.
4. **Whether the requirements directory is its own git repository.** It sits outside the code
   repository, so it has no history and no backup unless it is given one. A deliberate trade, but
   the user's to make.
5. **Does the app exist and answer on a URL today?** This decides whether phase 3 writes
   `tools/genai/e2e.json` at all. A fresh repository usually cannot answer honestly, and that is
   fine — see phase 4.
6. **How the coverage floors get set — not the numbers themselves.** The numbers cannot be agreed yet, because
   nothing has measured this project until phase 4 fills the metrics recipe and runs it. So settle
   *how* they get set — from what it measures today, or the shipped defaults — and come back with
   the actual numbers in phase 4.

`instruction_language` **does not translate the step briefs.** Those ship inside this plugin as
English source and are injected verbatim, so every dispatched instruction is two languages at once:
an English brief, then a framework-rendered section in the configured language. That is the intended
split — the brief is read by a model, the artifacts are written for people — but it means the
language setting is carried only by the second half.

**`mdxv` is in that list because a round dies without it, and the rest of `computer-use` is not.**
`genai.arch-decision` sends its executor to `mdx-artifact`, which renders through the global `mdxv`
binary — the npm package is named `mdx-viewer`, which is why `command -v mdx-viewer` finds nothing on
a machine that has it. Absent, that step fails at the moment it tries to write its document, a long
way from anything that would explain why, so phase 1 checks it and phase 3 installs it alongside `fsx`
and `openspec`. If the user declines a global install, `mdx-artifact` still works through
`npx -p mdx-viewer mdxv doc.mdx` — slower on first use, and worth saying rather than presenting the
refusal as a dead end.

The **notification consent and the browser stack** remain **`/install-computer-use`**'s, which this
plugin already declares a dependency on. Run it, or tell the user to. One named binary that blocks a
step is a dependency; the whole of that skill's list would be a second copy to keep true.

## Phase 3 — apply

**Run phase 1's `SUGGESTED` line**, with phase 2's answers filled in. That line is already
copy-pasteable and already knows what this project is missing; the shape below is only for reading —
the square brackets are notation for "optional", not shell syntax, and `--install` takes **only** what
phase 1 reported missing, never the whole list:

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
edits the three engine defaults in place, gives the project a Makefile whose bare command shows help,
copies the threshold template, creates the sibling directories, and verifies the shape with
`fsx check` and `fsx nodes -w genai-sprint`.

Two more flags exist and are rarely needed: `--patience` (default 5) and `--budget` (default 50),
the engine defaults written into `.flow/config.yaml`. Pass them only when the user asks for
different numbers.

Anything else is refused rather than ignored — a mistyped flag would otherwise go unnoticed and leave
the log explaining the absence of a file with a reason nobody gave.

Three things to read in its output:

- **`!` lines.** Every one is either a step that did not happen or something the script hands to you
  rather than judging — `fsx check`'s `problems[]` above all, since a `warning` there leaves `ok`
  true and is nobody's business but the reader's.
- **`new in the working tree`.** `openspec init` writes more than `openspec/`: given `--tools` it
  also drops command and skill files wherever this host keeps them. Those files are the project's,
  not this flow's — show the user and let them decide what to track.
- **A non-zero exit.** Either a step it was told to do did not happen, or `fsx check` reported
  something it calls an **error** rather than a warning. Both need reading before you go on;
  "already there" exits 0.

<!--@codex-->
Codex plugins cannot bundle agents, so copy them once by hand — `apply.mjs` deliberately does not,
because the path is outside the skill directory:

```bash
cp <plugin-root>/../agents/genai-*.toml ~/.codex/agents/
```
<!--@end-->

## Phase 4 — what a script cannot do

**1. Fill the two placeholder recipe lines in `genai-metrics`.** Phase 1 reported the runner and the
coverage tool; the judgement is which **machine-readable** reporter to read (JSON, JUnit, lcov
summary) and how to turn it into the one marked line. `genai-guideline` carries the protocol.

Do not convert the project's build to make. Whether the suite runs through npm, cargo, pytest or
gradle is the project's business, and choosing or wiring a test framework is `tdd`'s subject.

Two things the template's own comments spell out, both of which look like details and are not:
the line that runs the suite takes make's `-` prefix, or a failing test aborts the recipe before it
prints and the gate reports a broken setup instead of a failing suite; and a coverage tool that only
reports the files a test loaded needs the target to score an unmentioned source file as zero.

```bash
make genai-metrics                     # must print one genai-metrics: line with real numbers
node .flow/genai/check.mjs metrics     # the gate itself, reading that line
```

**What has to be true here is the shape, not the verdict.** On a project with no tests the expected
label is `no_tests`. `satisfied` is not reachable until something passes a test, and getting there is
`genai.implement`'s job. The three labels that mean a broken install are `metrics_missing`,
`metrics_unreadable` and `thresholds_missing` — those are this phase's business.

A `satisfied` reached with fabricated numbers is the one failure no command here can catch, so read
what the target actually runs. And **a target that parses human-readable output has not been tested
by this**: see [references/troubleshooting.md](references/troubleshooting.md).

**2. Set the floors in `tools/genai/thresholds.json`** by whichever policy phase 2 settled on — and
**in that order: read the numbers step 1 printed, then write the floors.** Setting them from a sense
of what a project like this should manage is how a floor lands above what it measures, and the
number that catches it is one you had already been shown. A round may not edit this
file, so a floor above where the project stands rejects every round with nothing able to fix it. A
floor of `null` opts that dimension out — the only way out, and visible in the file. Its `e2e` block
is the ceiling on how much of a round may go unscripted; leave it at the shipped values unless the
user has a reason, and note that **omitting it does not opt out** the way an omitted floor does.

**3. Fill `tools/genai/e2e.json`, if phase 3 wrote it.** `url` is an endpoint of this project's app;
`contains` is something specific to **this service** — the name in a health payload, a version
string, the title a known route renders. `ok`, `healthy` and `200` are not markers: every other
process on the machine says those too. Add `status` when the endpoint does not answer 200.

```bash
node .flow/genai/check.mjs app-identity     # identified — anything else names what to fix
```

`unreachable` means the app is not up, which is fine at install time. `wrong_service` is not: the
marker does not appear, so the URL points at something else.

If the app does not exist yet, **tell the user in one sentence** what will be needed before the
round's acceptance step can start: a URL and a marker only this app returns. Nothing earlier in a
round touches it, and `genai.e2e` then refuses to start with `config_missing`, which spends no
verdict, no patience and no attempt. **Say when it may be committed, too — the window is narrow**,
and [references/troubleshooting.md](references/troubleshooting.md) has it.

**4. Commit the project's baseline.** Everything the project now owns is untracked, and leaving it
that way pushes a first commit of it into the middle of a round:

```bash
git add Makefile tools/genai openspec/config.yaml .gitignore   # whichever of these exist
git commit -m "chore: genai flow baseline"
```

Add paths explicitly. `git add -A` here sweeps in whatever else is lying around the working
directory. Why it has to be now rather than later is in the troubleshooting reference.

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
anything the project wrote itself share that directory. **It refuses while a graph is live** — changing a definition under a live run leaves the run
measuring against a contract it was not created with. Finish or abort the round first.

## What this does not do

- Does not explain the flow or define the metrics protocol — that is `genai-guideline`
- Does not create requirements — that is `genai-backlog`
- Does not create a graph — a graph is per round, not per project
- Does not reimplement a gate the project already has; wrap the existing command
