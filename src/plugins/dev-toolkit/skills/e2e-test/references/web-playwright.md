# Web E2E — Playwright

For browser-driven, full-functional tests of a running web app. Drive the real UI, assert what the user sees, then verify the DB write (see `db-verification.md`).

> If this environment exposes a **Playwright MCP** (`browser_navigate`, `browser_click`, `browser_snapshot`, …), you can drive the browser directly through it for ad-hoc exploration. For an existing suite, prefer running the project's Playwright tests as below — they encode the intended assertions.

## Discover before running

- Config: `playwright.config.ts|js|mjs` — read `testDir`, `projects` (browser matrix), `webServer` (whether Playwright starts the app — if so, the app may already be handled), `baseURL`, `reporter`.
- Scripts: `package.json` → `scripts` (`test:e2e`, `e2e`, `pw`). Prefer these.
- Test location: usually `e2e/`, `tests/`, or `*.spec.ts`.

## Run

Use the project's script when present (e.g. `npm run test:e2e`). Otherwise:

```bash
npx playwright test                      # whole suite
npx playwright test path/to/file.spec.ts # one file
npx playwright test -g "checkout flow"    # filter by title
npx playwright test --project=chromium    # one browser from the matrix
```

Useful flags:
- `--reporter=list,json --output=...` or set `PLAYWRIGHT_JSON_OUTPUT_NAME` — get machine-readable results to parse pass/fail counts reliably instead of scraping stdout.
- `--trace on` / `--retries=0` while diagnosing — a trace (`npx playwright show-trace`) pins down where a step failed.
- `--headed` to watch it run; CI/default is headless.

## Preconditions

- The app is reachable at `baseURL` (unless `webServer` in the config boots it — then Playwright handles it).
- Browsers installed: `npx playwright install` if a launch fails with a missing-browser error.

## Reading results

- Exit code 0 = all passed. Non-zero = failures or errors.
- Parse the JSON reporter for `stats` (expected/unexpected/skipped) and per-test status.
- For a failed step, the error + trace tells you whether the selector/assertion is wrong (test bug) or the app behaved wrong (product bug).

## Then verify the DB

A passing UI assertion is half the result. After the flow completes, query the affected tables per `db-verification.md` — accounting for async writes (the UI may return before the write settles; poll briefly).
