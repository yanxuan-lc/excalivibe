# API Probe Playbook

Concrete steps and commands for discovering an API spec and probing endpoints safely. Read-only first; writes only in a sandbox after explicit confirmation.

## 1. Discover the spec

Try these paths against the base URL (replace `$BASE`). A machine-readable spec is worth far more than guessing call shapes.

**OpenAPI / Swagger JSON (machine-readable — try these first):**

```
$BASE/openapi.json
$BASE/openapi.yaml
$BASE/v3/api-docs            # springdoc / Spring Boot default
$BASE/v2/api-docs            # older springfox
$BASE/swagger.json
$BASE/swagger/v1/swagger.json   # ASP.NET / Swashbuckle default
$BASE/api-docs
```

**Human-facing doc UIs (drive via the `graceful-browser` skill if you need "Try it out"):**

```
$BASE/swagger      $BASE/swagger-ui      $BASE/swagger-ui.html
$BASE/docs         $BASE/redoc           $BASE/api-docs
```

Fetch the spec:

```bash
# curl (note the timeout); pipe through jq to inspect structure
curl -sS --max-time 15 "$BASE/openapi.json" | jq '.info, (.paths | keys)'
```

Or use the current Codex web tool on the spec URL. For an interactive Swagger UI where you want to click "Try it out", select an actually available browser through `graceful-browser`.

From the spec, pull for each endpoint in scope: path, method, parameters (path/query/body), request & response schemas, and the security scheme (auth) it requires.

## 2. Auth handling (never echo the secret)

Pull the credential from env, keep it in a variable, and mask it everywhere you record. Common schemes:

```bash
# Bearer token (OAuth2 / JWT)
curl -sS --max-time 15 -H "Authorization: Bearer $TOKEN" "$BASE/path"

# API key header
curl -sS --max-time 15 -H "X-API-Key: $API_KEY" "$BASE/path"

# Cookie / session
curl -sS --max-time 15 -b "session=$SESSION" "$BASE/path"
```

In the report, record only the scheme ("Bearer token", "X-API-Key header"), never the value.

## 3. Probe — read-only first

```bash
# GET with pretty JSON + visible status code, bounded by a timeout
curl -sS --max-time 15 -w '\n[http %{http_code}]\n' \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE/v1/widgets?limit=5" | jq .

# Inspect headers only (pagination cursors, rate-limit headers, content-type)
curl -sS --max-time 15 -D - -o /dev/null \
  -H "Authorization: Bearer $TOKEN" "$BASE/v1/widgets"
```

Things worth capturing while probing:

- The **real response shape** vs what the spec claimed (extra/missing/renamed fields).
- **Error shape**: deliberately hit a not-found or a bad param and record the error body/status (e.g. 404, 422) — integrations need the failure contract too.
- **Pagination / rate-limit** headers and cursors.

## 4. Write endpoints — sandbox + explicit confirmation only

Only after the user confirms, only against a sandbox/test base, smallest viable payload:

```bash
curl -sS --max-time 15 -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"research-probe"}' \
  -w '\n[http %{http_code}]\n' \
  "$BASE/v1/widgets"
```

Never send a non-GET request to a production API as part of research.

## Safety red lines (restated)

- **Read-only first; writes need sandbox + confirmation.** No `POST`/`PUT`/`PATCH`/`DELETE` against prod for research.
- **Redact** tokens, keys, cookies, PII in everything recorded. Credentials never land in files/commits.
- **Be a good citizen:** timeouts on every call, no hammering/looping, honor rate limits, only probe APIs you're authorized to use.
- **TLS:** don't use `curl -k` except against a known local dev server, and note it if you must.
