---
name: perf-budget
description: Latency / query-count / bundle-size budget check with pass/fail per dimension — invoked by name as the perf-gate node, or on explicit performance-regression checks.
---

# Performance Budget Check

This skill measures a change against **performance budgets** and reports regressions.
Given a change (a diff, or "the current working tree vs a baseline"), it measures the
dimensions that change can affect — **latency**, **query count / N+1**, **bundle size**,
and any other budgeted resource — and reports each as **measured vs threshold vs
baseline**, with a clear pass/fail per dimension. The report is designed to be acted on
(block, warn, or wave through); this skill produces the verdict, it does not enforce it.

A budget check is only trustworthy if it states three numbers per dimension:

1. **Measured** — what this change actually costs now.
2. **Threshold** — the budget it is held to (where the budget came from).
3. **Baseline + delta** — what it cost before, and how much this change moved it.

A bare "120ms" means nothing; "120ms (budget 100ms, was 90ms, +30ms) — FAIL" is a verdict.

## Inputs

- **The change** — a diff/branch to compare against a baseline ref, or the working tree.
  Identify which files moved so you only measure the dimensions the change can affect (a
  CSS-only diff cannot add a query; a query-layer diff cannot grow the JS bundle).
- **A budget source** — resolved in this order, first one that exists wins per dimension:
  1. **Repo config.** Look for an explicit budget file the project owns — check, in order,
     a `perf-budget` key in `package.json`, a `.perf-budget.json` / `.perf-budget.yaml`
     at the repo root, a `budgets` block in a Lighthouse config (`lighthouserc.*`), or a
     `bundlesize`/`size-limit` config. Use the project's own convention if it has one;
     do not invent a new file when one already exists.
  2. **Regression-vs-baseline.** When there is a baseline build/run to compare against,
     the budget is "no worse than baseline by more than a small tolerance" — report the
     delta even when no absolute threshold exists.
  3. **Sensible defaults**, with the default value **surfaced in the report** so the
     reader knows it was assumed, not configured (e.g. per-route JS budget, max queries
     per request, p95 latency target). Recommend the project commit a budget file.

Report which source each threshold came from — an assumed default and a committed budget
carry very different weight.

## Per-dimension measurement

Measure only the dimensions the change can affect. The three named dimensions are
concrete; treat any other budgeted resource the same way (measure → threshold → delta).

| Dimension | What to measure | How |
|-----------|-----------------|-----|
| **Bundle size** | Size of the shipped client assets (per entry/route chunk, gzipped), and the delta vs baseline | Reuse a build that already exists at the current commit (a pipeline-recorded build, CI artifact, or fresh `dist/`) before building; likewise take the baseline from a recorded prior measurement or CI artifact rather than rebuilding the baseline commit. Read the build output / stats; compare chunk sizes. A new dependency or a heavy import is the usual cause. |
| **Query count / N+1** | Number of DB queries per logical operation (request / handler / job), and whether a query runs inside a loop over N rows | Instrument the data layer for the path under test (query log / ORM hook / statement counter), exercise the operation once, count queries per operation. A query count that scales with row count is an N+1 — flag it explicitly. |
| **Latency** | Wall-clock time of the hot path or endpoint (p50/p95 where it makes sense), and the delta vs baseline | Benchmark the function/endpoint with a repeatable harness (warm up, run N iterations, report percentiles); for a page, drive a browser and capture load/interaction timings. Pin the environment as much as possible so the delta is signal, not noise. |

### Routing — web vs backend

The same dimension is measured differently per stack; measure where the cost actually
lives.

- **Frontend / web surface** — bundle size from the build output; runtime latency and
  page-load timings by **driving a browser (via the `graceful-browser` skill from the
  `plugin-infra` plugin — Codex's native browser (`@Chrome` / `@Browser`) first, then the
  chrome-devtools MCP, then the Playwright MCP)** and reading the performance/load metrics
  it exposes (Lighthouse-style). Use the budgets in the project's Lighthouse/size-limit
  config if present.
- **Backend / service surface** — query count by instrumenting the data layer; endpoint
  latency by benchmarking the handler or hitting the running endpoint with a repeatable
  load and reading percentiles. N+1 detection lives here.
- **Library / pure logic** — micro-benchmark the hot function directly; bundle size only
  if it publishes a client artifact.

If a project ships its own perf-measurement harness (a bench suite, a CI perf job), run
**that** and read its numbers; use the methods above only to fill gaps it leaves.

## Output — the budget report

Produce a per-dimension table and an overall verdict:

- **One row per measured dimension**: `dimension | measured | threshold (source) | baseline | delta | PASS/FAIL`.
- **Overall verdict**: PASS only if every measured dimension is within budget. Any FAIL
  fails the report; mark a dimension WARN when it regressed but is still under an absolute
  threshold (a creeping regression worth seeing).
- **Name the cause** when you can: which added dependency grew the chunk, which call site
  issues the N+1, which line moved the latency. A verdict the reader can fix beats a
  number they can only stare at.
- **State what was NOT measured and why** (no baseline available, dimension not affected
  by this diff, no harness for this stack) — silence reads as a pass and hides gaps.
- **Commit stamp + measurement commands**: the SHA measured and each dimension's exact
  command/harness invocation, so a later consumer can tell the report is current and
  trust it (or reuse its numbers as the next baseline) instead of re-measuring.

## Cost discipline

Performance measurement is not free — a build, an instrumented run, and a benchmark each
cost real time, and browser-driven page metrics cost multimodal calls. So:

- **Measure only the affected dimensions** — scope by the diff, do not run the full
  battery on a one-line change.
- **Reuse the project's own perf harness / CI job** when it exists rather than
  re-deriving measurements by hand.
- For latency especially, **a single sample is noise** — run enough iterations to report a
  stable percentile, but no more than needed to separate signal from jitter, and pin the
  environment so a delta means something.
