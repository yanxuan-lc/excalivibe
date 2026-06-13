# E2E Manifest — the Contract Between quality-assurance and e2e-runner

The manifest is what turns "is QA's test code sufficient?" from a judgment call into
a table lookup. quality-assurance produces it; e2e-runner consumes it; neither side
guesses.

Location: `openspec/changes/<id>/e2e-manifest.md`.

## Format

```markdown
# E2E Manifest — <change-id>

## Run commands

| Suite | Command | Reporter |
|-------|---------|----------|
| web   | `pnpm test:e2e` | JSON → `playwright-report/results.json` |
| api   | `pnpm test:api`  | JSON → `api-report.json` |

## Scenario → test mapping

| Scenario | Test | Asserts |
|----------|------|---------|
| S1 | `e2e/register.spec.ts :: "S1: 新用户注册成功"` | UI + DB |
| S2 | `e2e/register.spec.ts :: "S2: 重复手机号被拒"` | UI + API |
| S4 | `e2e/api/order.spec.ts :: "S4: 下单扣减库存"` | API + DB |

## Deliberately uncovered

| Scenario | Class | Reason |
|----------|-------|--------|
| S3 | agent-driven | 选择器不稳定，脚本化成本高，运行时由 agent 驱动执行 |
| S5 | non-automatable（需用户豁免） | 依赖第三方扫码回调，脚本与 agent 均无法执行 |
```

Rules:

- **Test titles embed the scenario ID** (`"S1: …"`, `TestS1_…`) so the mapping is
  greppable and cannot silently drift from the code. The manifest row and the test
  title must agree.
- **Every spec scenario appears exactly once** — in the mapping table or the
  uncovered table. A scenario in neither is a QA handoff defect.
- The uncovered table distinguishes two classes: **agent-driven** (executable at
  run time by e2e-runner driving the browser — counts toward executed coverage)
  and **non-automatable** (neither script nor agent can perform it — third-party
  callback, hardware-in-the-loop). Non-automatable scenarios require a
  **user-approved waiver**: the main agent relays the request, records approval in
  PIPELINE.md (`waived: S5 — <reason>`), and the e2e report marks them
  `⚠ waived (user-approved)`. The merge gate counts `executed + waived = M`.
- The `Asserts` column declares what the test itself checks (UI / API / DB).
  e2e-runner performs its own database verification regardless — the column exists
  so gaps are visible, not to delegate DB checking.

## How e2e-runner consumes it (zero-discretion algorithm)

```
1. Manifest missing or run command broken → ALL scenarios agent-driven
   (graceful-browser; claude --chrome first — priority order's authority is the
   graceful-browser skill itself). Report this downgrade explicitly.
2. covered   = scenarios in the mapping table
   uncovered = spec scenarios not in it + the agent-driven class
   waived    = non-automatable scenarios WITH a user waiver recorded in
               PIPELINE.md → report as ⚠ waived, do not attempt, do not count
               as executed. Non-automatable WITHOUT a recorded waiver = blocker
               to report, not a skip you may decide.
3. covered   → run the suite commands; verify via the JSON reporter that every
   mapped test EXECUTED and PASSED (a skipped test is not a pass; a test the
   grep filter missed is not a pass).
4. uncovered → drive each scenario via the graceful-browser skill, step by step
   from the spec's WHEN/THEN. If graceful-browser isn't installed, probe the same
   tool families directly in the same priority order and note the degradation.
5. DB verification for both paths per e2e-test's db-verification reference.
6. A failed scripted test may be REPRODUCED agent-driven for diagnosis
   (classify product bug / test bug / infra) — never to overturn the result.
   The verdict stays red until developer fixes the product or QA fixes the test.
```

## Login state for scripted tests (zero-LLM at runtime)

UI scripts must run without a model in the loop. Two supported patterns, both set
up by quality-assurance:

- **`storageState`** (default): a one-time auth setup project logs in (manually or
  agent-assisted once), exports cookies/localStorage to a gitignored JSON; tests
  load it. Standard Playwright pattern; works in CI.
- **`connectOverCDP`**: scripts honor an env var (e.g. `PW_CDP_ENDPOINT`,
  default unset) and, when set, connect to the debug Chrome that the
  plugin-infra `graceful-browser` infrastructure maintains on `127.0.0.1:9222`
  (profile `~/.cdp`) — sharing whatever login state lives in that profile.
  Useful locally; not for CI. Note: this is the chrome-devtools-managed Chrome,
  NOT the user's daily browser — Chrome ≥136 forbids debugging the default
  profile, and claude-in-chrome exposes no scriptable surface at all.

Either way: the LLM appears only when authoring tests and when reading the final
report. Execution itself costs zero tokens — that is the point of the scripted
carrier, so never route a covered scenario through agent-driving for convenience.
