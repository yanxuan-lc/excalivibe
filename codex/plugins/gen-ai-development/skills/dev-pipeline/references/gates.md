# Gate Details — Exact Artifact Checks

The pipeline's gates are artifact checks, not judgment calls. This file lists what
to verify at each gate. A gate "holds" only when every listed check passes; report
which check failed when blocking.

## Gate 1 — developer starts (apply)

Owner: developer's own pre-flight (the main agent need not pre-verify).

- `openspec/changes/<id>/` exists and contains the proposal/spec artifacts.
- The spec has objectives, interface definitions, acceptance criteria, constraints.
- Acceptance criteria for user-visible flows include scenario-level e2e use cases
  with stable IDs (`S1`, `S2`, …) and an execution-carrier declaration
  (Playwright-scripted vs agent-driven) — these come from planner.
- **The human checkpoint passed**: PIPELINE.md's `spec-confirm` row is checked —
  the user confirmed the four contracts (project structure & module design /
  protocol / database design / use cases). An unchecked row means the contracts
  are not signed; do not dispatch developer or quality-assurance.
- **The review document backs the confirmation**:
  `openspec/changes/<id>/REVIEW.md` exists and its header's「Spec 版本」stamp
  matches a re-run of the spec-review skill's `scripts/spec-hash.sh <change-dir>`.
  Missing or stale means the user confirmed something other than the current
  spec — have planner regenerate REVIEW.md and re-confirm before dispatching.
  Check it with this recipe (don't improvise the extraction):

  ```bash
  recorded=$(grep -m1 'Spec 版本' "$change_dir/REVIEW.md" | grep -oE '[0-9a-f]{12}')
  actual=$(<spec-review-skill>/scripts/spec-hash.sh "$change_dir")
  # spec-hash.sh exiting non-zero = FAILURE — its stdout carries no fingerprint
  # and must not be compared. Treat empty $recorded the same way.
  [ -n "$recorded" ] && [ "$recorded" = "$actual" ]   # false → gate does not hold
  ```

  The template guarantees the stamp's format: the「Spec 版本」row carries exactly
  12 hex chars wrapped in backticks — the recipe's regex relies on that.

## Gate 2 — quality-assurance starts

- Same spec existence check as Gate 1.
- Carrier declared as **scripted** (Playwright/API). If the spec declares
  agent-driven (no test-code investment), QA is skipped — record `[-]` with the
  reason in PIPELINE.md; e2e-runner will drive all scenarios via graceful-browser.

## Gate 3 — e2e-runner dispatched

Owner: main agent, before the Agent call.

- App/service under test is running and reachable (use the project's Makefile /
  run entry; confirm with a probe, not an assumption).
- GUI targets available where relevant (browser; device/emulator via
  `adb devices` / `flutter devices`; `tauri-driver` for Tauri — note Tauri GUI e2e
  is unavailable on macOS).
- Test/staging database reachable via env connection string — never production.
- If any precondition can't be met (device needs the user's hands, env is down),
  report to the user instead of dispatching a doomed run.

## Gate 4 — merge → dev (the hard gate)

Owner: main agent; vcs-workflow's "Common Misuses" list backstops it.

All of the following, checked against files on disk:

1. **Code review closed**: the change's review CHECKLIST.md
   (`docs/code-review/<datetime>/CHECKLIST.md`) has every 🔴 P0 and 🟠 P1 item
   checked off / status Resolved. P2/P3/Suggestions may remain open (tracked, not
   blocking).
2. **E2E report exists and is green**: `openspec/changes/<id>/e2e-report.md`
   (or the path recorded in PIPELINE.md) shows
   - all executed scenarios passed (interface assertions AND database verification),
   - scenario coverage **executed + waived = M** — every spec scenario was either
     executed (script or agent-driven) or carries a **user-approved waiver**. A
     waiver exists only for genuinely non-automatable scenarios (third-party
     callback, hardware-in-the-loop): the main agent relays the request to the
     user, approval is recorded in PIPELINE.md (`waived: S5 — <reason>`), and the
     report marks the row `⚠ waived (user-approved)`. A scenario that is merely
     unmapped is NOT waivable — it must be agent-driven,
   - regression: the project's existing e2e suite (if any) also green.
3. **Unit gate already held**: developer reported tests green, coverage ≥80%,
   lint clean (re-verify only if the fix loop touched code after that report).
4. **Verdict freshness**: both artifacts name the commit they were produced
   against (the review SUMMARY's `Commit` field; the e2e report's `Commit` field),
   and **both match the merge candidate's HEAD**. A green report from an earlier
   commit is stale evidence — any fix after it requires the corresponding re-run
   (see the fix-loop convergence protocol in SKILL.md). This is what prevents the
   classic leak: e2e green on commit X, review fix lands commit Y, and Y — never
   e2e-verified — merges on X's report.
5. **PIPELINE.md is current**: phases above merge are `[x]` or `[-]`-with-reason.

If any check fails: do not merge. Route the failure (product bug → developer,
test bug → quality-assurance; review findings by code ownership — product code →
developer, e2e test code → quality-assurance), run a fix-loop round, re-check —
including freshness.

## Gate 5 — after merge

- Run `openspec archive` for the change.
- Trigger docs-guideline curation (narrative → as-built; mark superseded
  research/ued artifacts stale).
- Tick the last PIPELINE.md rows. Pushing `dev` and anything release-related
  stays under vcs-workflow's rules (push only on explicit user request).
