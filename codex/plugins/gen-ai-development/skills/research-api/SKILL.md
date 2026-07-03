---
name: research-api
description: Discover an API's OpenAPI/Swagger spec and probe endpoints with real (read-only-first) calls — dispatched by research-pipeline / researcher for interface-grounded questions.
---

# API Research

API docs describe the intended contract; the live endpoint tells you the real one — the field that's actually optional, the error shape on a 422, the auth header it really wants, the undocumented pagination cursor. When a research conclusion depends on how an interface behaves, discover its spec and make real calls to confirm, starting strictly read-only.

The output is a **verified usage finding**: how to call the endpoint, what it actually returns, and how auth works — backed by a real request/response sample (secrets redacted) so the next person can integrate without re-discovering it.

## When this applies

- The question is about an API's real behavior, params, response shape, or auth — not a concept.
- You're about to integrate and want a working call before committing to a design.
- There's a Swagger/OpenAPI surface to explore, or a service you can reach but whose contract is fuzzy.
- You need to confirm a capability ("does it support filtering by date") rather than assume it.

If complete, current official API docs already answer it, use the `context7` MCP for docs and skip the live probing. This skill is for when you need to hit the real thing.

## Workflow

### 1. Locate base URL + auth — and confirm the environment

- **Base URL** — the service root for the environment you're allowed to touch. **Strongly prefer a sandbox/staging/test base over production.** State which one you're using.
- **Auth** — how the API authenticates (Bearer token, API key header, cookie/session, OAuth2). Find the credential in env/config; never hardcode or echo it.

### 2. Discover the spec

Try the common spec/debug surfaces before hand-crafting calls — a machine-readable spec saves guesswork. See [references/probe-playbook.md](references/probe-playbook.md) for the full path list and commands. Quick hits:

- OpenAPI/Swagger JSON: `/openapi.json`, `/v3/api-docs`, `/swagger.json`, `/swagger/v1/swagger.json`
- Swagger UI / Redoc pages: `/swagger`, `/swagger-ui`, `/docs`, `/redoc`, `/api-docs`
- Fetch the spec with **WebFetch** or `curl`; for an interactive Swagger UI "Try it out" flow, drive it via the `graceful-browser` skill (Codex's native browser (@Chrome / @Browser) → chrome-devtools MCP → Playwright MCP, in that order).

Parse the spec for the endpoints in scope: path, method, params, request/response schemas, auth requirements.

### 3. Probe endpoints safely

> **Tooling: nothing to install.** `curl` ships on virtually every macOS/Linux box, the `WebFetch` tool is built in, and Swagger UI is driven through the `graceful-browser` skill — none of these need a local install. If `curl` somehow isn't present, fall back to `WebFetch` or an HTTP client in a runtime that's already there (e.g. Python `urllib`/`requests`-if-installed, Node `fetch`). **Don't `brew`/`apt`/`pip`/`npm` install a tool (httpie, etc.) just to probe** — use what's available or ask the user.

- **Read-only first.** Exercise `GET`/read endpoints to confirm response shape and behavior. Always set a timeout.
- **Write endpoints** (`POST`/`PUT`/`PATCH`/`DELETE`) only in a sandbox/test environment, with the **smallest possible payload**, and only after **explicit user confirmation**. Never fire a write at a production API as part of research.
- Capture real samples: the exact request (method, path, headers with secrets masked, body) and the actual response (status, key fields, error shape).

### 4. Record findings with provenance, secrets redacted

Write conclusions back into the active research report (`docs/research/<...>/`). For each API-backed claim record:

- Environment + base URL (sandbox/staging/prod — be explicit)
- Endpoint (method + path), how auth was supplied (type only, e.g. "Bearer token" — **never the token**)
- A real request/response sample with tokens, keys, cookies, and PII **redacted** (`Authorization: Bearer ***`)
- The call time, since live behavior can change

## Safety red lines

- **Read-only first; writes need a sandbox + explicit confirmation.** Never send `POST`/`PUT`/`PATCH`/`DELETE` to a production API for research. When in doubt, ask before any non-GET call.
- **Redact every secret.** Tokens, API keys, cookies, and PII in samples must be masked in anything you write or commit — this repo's rule is credentials never land in files. Don't paste a working token into the report.
- **Respect the service.** Set timeouts, don't loop/hammer endpoints, honor rate limits, and don't probe an API you have no authorization to use.
- **Verify TLS.** Don't disable certificate verification (`curl -k`) except against a known local dev server, and note it if you do.
