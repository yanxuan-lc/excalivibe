---
name: a11y-check
description: axe / Lighthouse accessibility audit with a pass/fail budget verdict — invoked by name as the a11y-gate node on UI surfaces, or on explicit accessibility / WCAG / contrast audit requests.
---

# Accessibility Check

This skill **audits** a UI surface for accessibility problems and produces a report that
maps each finding to a WCAG success criterion, then emits a **pass/fail verdict against a
budget**. It is read-only toward the application: it observes, it does not change code and
it does not fix the issues it surfaces. Fixing is a separate job for whoever owns the code.

The verdict is the deliverable that makes the report actionable: a human or an automated
step can decide to block or proceed on it. A clean default budget is **zero `critical` and
zero `serious` violations** at the target conformance level; the caller may override the
budget and the target level.

## The honest half — automated tools catch only part of WCAG

Automated scanners (axe-core, Lighthouse) reliably catch roughly a third of WCAG issues —
the machine-detectable ones (missing labels, color contrast, missing alt attributes, ARIA
attribute validity, document structure). **They cannot judge the rest.** A green axe run is
not an accessible page. So this skill reports **two classes of finding** and never lets the
second silently pass:

1. **Detected violations** — what the scanner found, each with a WCAG criterion, an impact
   level, the offending element, and a remediation hint.
2. **Findings-to-verify** — the criteria the scanner *cannot* check, raised as open items
   the caller must confirm manually or agent-driven. Listing them is mandatory; omitting
   them is the false pass.

Things in class 2 that must always be raised for any non-trivial UI:

- **Keyboard navigation** — every interactive element reachable and operable by keyboard;
  logical focus *order*; no focus traps; nothing keyboard-only-inaccessible.
- **Visible focus indicator** — focus is always perceivable, not removed by `outline:none`.
- **Screen-reader semantics** — correct landmarks, heading hierarchy, accessible names on
  controls, form labels associated with inputs.
- **Alt-text quality** — images have alt text that is *meaningful*, not just present;
  decorative images are correctly hidden.
- **ARIA correctness** — roles/states used correctly and not contradicting native
  semantics (bad ARIA is worse than none).
- **Reflow & zoom** — content usable at 200%+ zoom / 320px width without loss.
- **Motion** — respects reduced-motion; no content that flashes above the seizure threshold.

## Inputs

- **The surface(s) to audit** — a running URL or specific route(s), or a rendered
  component's DOM. **Scope to the changed surfaces**, not the whole app — a full-site crawl
  is expensive and rarely what is asked. If the surfaces aren't specified, ask for or infer
  the routes the change affects.
- **Target conformance level** — default **WCAG 2.2 AA** (2.1 AA is an acceptable
  fallback). The level sets which criteria count.
- **The budget** — the threshold the verdict is measured against. Default: zero
  `critical` + zero `serious`. The caller may tighten or loosen it (e.g. allow triaged
  `moderate` findings).

## Procedure

1. **Get the surface running and reachable.** The app/page must already be served. Drive
   the browser through the `graceful-browser` skill (from the `plugin-infra` plugin); it
   picks the best available driver in priority order — Codex's native browser
   (`@Chrome` / `@Browser`) first, then the chrome-devtools MCP, then the Playwright MCP.
   If that skill isn't present, probe those tool families directly in the same priority
   order.

2. **Run axe-core as the primary scanner.** Inject/execute axe against each in-scope
   surface (axe runs in-page against the live DOM, so it sees the rendered result including
   client-side state). Collect the full violation set with each violation's rule id, impact
   (`critical` / `serious` / `moderate` / `minor`), the mapped WCAG criteria/tags, and the
   failing element selectors. Audit meaningful **states**, not just initial load — open
   menus, modals, expanded sections, and error states each render different DOM.

3. **Run the Lighthouse accessibility category as a second instrument** where available,
   for the score and for checks axe frames differently. Treat the two as complementary, not
   redundant; reconcile overlapping findings rather than double-counting them. (Pa11y is an
   acceptable additional scanner if the project already uses it.)

4. **Walk the findings-to-verify list** (the honest half above) against the surface. Where
   you can check cheaply agent-driven — tab through the page, confirm a visible focus ring,
   read the accessible names — do so and record the result. Where you cannot, record the
   item as an explicit open finding for the caller to confirm.

5. **Map every detected finding to a WCAG success criterion** (e.g. `1.4.3 Contrast
   (Minimum)`, `4.1.2 Name, Role, Value`, `2.1.1 Keyboard`). A finding without a criterion
   is not actionable; resolve it to one or drop it as out-of-standard noise.

6. **Compute the verdict** against the budget and write the report.

## Output

Write a structured report (default `a11y-report.md`, caller may override the path) with:

- **Verdict** — `PASS` / `FAIL` against the stated budget, and the target conformance
  level, stated up front. Name the budget that was applied so the verdict is reproducible.
- **Detected violations** — a table: WCAG criterion · impact · rule · element selector ·
  one-line remediation hint. Grouped/sorted by impact.
- **Findings-to-verify** — the class-2 items, each marked `verified-ok`, `verified-fail`,
  or `needs-human` so none is silently passed.
- **Surfaces & states audited** — which routes/components and which states (so the scope of
  the verdict is clear; an untested route is not a passed route).
- **Commit stamp** — the SHA the audited build/serve came from, so a later consumer can
  tell the report is current and trust it instead of re-auditing.

Keep the report skimmable: the verdict and the violation table are what a caller acts on.

## Boundaries — do not

- **Audit and report only.** Never edit product code, never apply the fixes you recommend,
  never refactor markup. The report names the problem and the criterion; remediation is the
  code owner's job.
- **Read-only toward the running app.** Drive it to reach states; never mutate its data
  beyond what's needed to render a surface.
- **Not a test runner.** This is not unit or e2e testing (those are the `tdd` and
  `e2e-test` skills). It does not assert business behavior — only accessibility conformance.
- **Don't claim more than the tools deliver.** A clean scanner run is a *floor*, not a
  guarantee; the verdict must always carry the findings-to-verify list alongside it.

## Stacks beyond web

The primary instruments (axe-core, Lighthouse) target web/DOM surfaces, including web views
and hybrid apps rendered in a browser. For native mobile or desktop surfaces, audit with
that platform's accessibility inspector/scanner instead and apply the same shape — map to
the platform's accessibility guidelines, separate detected from to-verify findings, emit a
budget verdict. The web path above is the default and the most common case.
