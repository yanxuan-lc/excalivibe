# API-only E2E

For end-to-end tests that start from an endpoint call (no GUI). The flow is: call the API against a running service → assert the response (status, body, headers) → verify the resulting DB write (see `db-verification.md`). This exercises the full server stack — routing, handler, business logic, persistence — just without the client UI.

## Discover before running

Identify the project's API-test runner; don't impose one:

| Stack | Look for | Run |
|-------|----------|-----|
| Python | `pytest`, `tests/` with `httpx`/`requests`/`TestClient` | `pytest tests/e2e -k <name>` |
| Node/TS | `vitest`/`jest` + `supertest`/`fetch` | `npm run test:e2e` / `npx vitest run` |
| Go | `*_test.go` hitting `httptest`/a live URL | `go test ./... -run <Name>` |
| Generic | `*.hurl`, Postman/`newman` collection, `*.http` | `hurl --test file.hurl` / `newman run collection.json` |

Always prefer an existing `test:e2e` script / Makefile target — it encodes base URL, auth, and ordering.

## Reach the service

- **Base URL** comes from env/config — common names: `API_BASE_URL`, `BASE_URL`, `APP_URL`. Confirm the service is up (`curl -fsS $BASE_URL/health` or the project's health route) before running the suite; a connection refused is a precondition failure, not a test failure.
- **Auth**: tokens/keys from env (`API_TOKEN`, a login step that yields a JWT). Never hardcode or echo secrets into the transcript.

## Run and assert

Run the existing suite scoped to the feature. For each request the e2e covers, the assertions should include:
- **Status code** matches the contract (201 on create, 200 on read, 4xx on validation).
- **Response body** shape/values (decode JSON; assert the fields that matter, not the whole blob).
- **Idempotency / side-effect-free reads** where applicable.

Capture machine-readable output where the runner offers it (pytest `--junitxml`, vitest `--reporter=json`, `newman -r json`) so pass/fail counts are exact.

## Then verify the DB

The response saying "201 Created" is the claim; the row is the proof. After the call, query the affected tables per `db-verification.md` and assert the persisted values match what was sent (and that derived columns — timestamps, status, `is_deleted` — are correct). For async endpoints (queue/worker), poll the table with a short timeout rather than asserting immediately.
