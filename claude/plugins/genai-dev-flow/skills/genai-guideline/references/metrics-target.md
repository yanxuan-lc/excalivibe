# Writing the `genai-metrics` target and its floors

The protocol between what a project's own test setup produces and what the gate judges. Read this
when writing that target for the first time, when a gate reports a setup problem rather than a
result, or when the coverage floors have to move.

The policy questions around it — who is allowed to change these files, and what a green gate does
and does not prove — stay in the skill body, because they are judgment rather than format.

### The project reports; the gate decides

**The target never says pass or fail.** It prints **one line per module**, each beginning
`genai-metrics: `, followed by one JSON object naming the module it is about. A project of one module
may leave `module` out; with several declared it is required, since an unlabelled line would put one
module's numbers against another's floors.

```
genai-metrics: {"module":"server","tests":{"passed":131,"skipped":0,"failed":0},"coverage":{"lines":0.93}}
genai-metrics: {"module":"web","tests":{"passed":12,"skipped":0,"failed":0}}
```

Everything else the target prints is ignored, **and so is its exit code.** A failing suite is
data, not an error — so no project has to remember `|| true` to keep make quiet, and no project
has to redirect its test output to keep stdout clean. Both are mistakes that would otherwise
break the gate silently.

**The gate ignoring the exit code does not make the recipe reach its last line.** make stops a
recipe at the line that failed, so a target whose first line runs the suite and whose second line
prints the numbers prints nothing at all when a test fails. The gate then reports `metrics_missing`
— a broken setup, which no round can fix — for a round whose real state was `tests_failing`, which
the round's own next attempt can. The two labels route to opposite places, and the useful one is
the one that gets lost.

Prefix the line that runs the suite with make's own `-`:

```makefile
genai-metrics:
	-@npx vitest run --coverage --reporter=json --outputFile=coverage/tests.json
	@node tools/genai/metrics.mjs
```

`-` tells make to ignore that line's failure and carry on, and make still says
`[genai-metrics] Error 1 (ignored)` on its own output, so a suite that fell over is visible to
whoever is watching. `cmd || true` reaches the same second line while erasing that, which is why
it is the worse of the two and not merely unnecessary.

| Field | Required | Value |
|---|---|---|
| `module` | when the project has several | the module this line reports on, as `tools/genai/modules.json` names it |
| `tests.passed` / `skipped` / `failed` | yes | non-negative integers. **The total is computed from these**, never read — one less number that can disagree with itself |
| `coverage.lines` / `branches` / `functions` | no | a fraction in `[0,1]`. Report what this module's tooling measures and leave the rest out |

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
| coverage floors, per module and per dimension | `tools/genai/thresholds.json` | **Cannot be universal.** One number for a greenfield project and a decade-old one is either meaningless or unreachable — and one number for a Go service and the client in front of it is both at once |

`90 / 90 / 100` are the defaults for a module starting from nothing. For a project that already has
code, agree the numbers with whoever owns it: **the round may not edit that file**, so a floor above
where the project stands rejects every round with nothing able to fix it.

Coverage is measured over each module, not over the diff — patch coverage would aim better and was
deliberately not built, since it needs a merge base, a diff and an intersection with the coverage
report inside every project's own target. Why the floors are keyed by module rather than by
repository is in [reporters.md](reporters.md), under scope.

```json
{ "coverage": { "server": { "lines": 0.8 }, "core": { "lines": 0.9, "branches": 0.85 } } }
```

A module left out is **not coverage-checked** — how a client covered by its e2e suite is declared,
and it sits in `thresholds.json` rather than `modules.json` because a round may edit that file and
may not edit this one. A dimension left out of an entry is not checked for that module, which is how
a Go module says its cover reports statements and nothing else. A module that **is** listed reports
tests, or the gate reads `no_tests`: listing it claims its numbers get measured, and a floor with no
measurement behind it counts as below.

### A broken setup rejects; it never passes

Three labels cover it — `metrics_missing` when no marked line came through at all, whatever the
reason; `metrics_unreadable` when one came through and does not satisfy the protocol; and
`thresholds_missing`. All three reject, and all three say so as a setup problem, because none of
those files are the round's to fix. Patience runs out and the round lands in front of a person,
which is where a broken setup belongs.

### Do not scrape the suite's human-readable output

A regex over what the runner prints for people **breaks on content, not on code**: a coverage summary
pads its filename column to the widest path, so a regex written against an empty project silently
matches nothing once real files land, every dimension arrives absent, and the gate rejects a round
whose real coverage was 100% — blaming the code, which is the expensive part.

Prefer a machine-readable reporter, and treat the install-time check as proving nothing when there
was no choice but to parse text. **The gate demands numbers, so silence is a rejection** — but a
target printing plausible numbers it never measured passes, and no check can see that, so read what
it actually runs:

```bash
make genai-metrics                     # one genai-metrics: line per module, with real numbers
node .flow/genai/check.mjs metrics     # {"result":"satisfied", ...}
```

Reporter choice, scope and cross-tool aggregation are one layer further down, in
[reporters.md](reporters.md).

