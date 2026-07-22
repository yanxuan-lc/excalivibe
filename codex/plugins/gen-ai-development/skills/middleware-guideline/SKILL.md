---
name: middleware-guideline
description: Apply backend middleware conventions for Nacos configuration, startup wiring, health/readiness endpoints and Prometheus metrics. Use for service scaffolding, config centers, API surfaces and monitoring exposure.
---

# Middleware Integration Guidelines

Conventions for the **service side** of every platform integration, in both directions: how a service finds the middleware it depends on (config center — authenticate, isolate environments, behave sanely when unreachable), and how the platform finds the service (health probes, metrics scrapes). These exist so that every service in the fleet connects the same way: an operator who has debugged one service's config loading or wired one service's dashboards has debugged them all.

The dividing line with `devops-guideline`: that skill *stands middleware up* locally for development (docker-compose); this skill governs the *code that talks to it* — in every environment.

## How to Use This Skill

1. Read the **Universal Principles** below — they hold for any middleware (config center, metrics, logging, MQ…).
2. Read the reference for the middleware actually in play (routing table below) for concrete wiring, code, and gotchas.
3. When the project already integrates the middleware, match its existing structure before adding to it; consistency beats your preferred style.

## Middleware Reference Routing

| Middleware | Reference | When to read |
|------------|-----------|--------------|
| Config center (Nacos) | [references/nacos.md](references/nacos.md) | The service reads runtime config from Nacos (or another config center) |
| Monitoring (health + Prometheus) | [references/monitoring.md](references/monitoring.md) | Adding or reviewing `/healthz` / `/readyz` / `/metrics`, instrumenting a service, scaffolding a new backend service |

An OpenObserve (logs) reference will be added as those conventions are codified — until then, apply the Universal Principles and the project's existing patterns, and flag to the user that the per-middleware reference doesn't exist yet rather than inventing house rules.

---

## Universal Principles

### One Profile Selects Everything

A single `<APP>_PROFILE` env var (dev / test / prod) is the only environment switch. Every middleware derives its isolation unit from it — the Nacos namespace *is* the profile, and future integrations follow suit (a metrics label, a log stream/index, an MQ cluster). One switch means environments cannot half-bleed: there is no state where config is prod but logs go to dev.

### Bootstrap Is Tiny; Behavior Lives in the Middleware

For each middleware, the service carries only a minimal **bootstrap**: how to reach it (endpoint, credentials, the profile-derived isolation unit). Everything behavioral flows through the middleware itself. Bootstrap comes from env vars and/or a small per-profile file (gitignored when it holds credentials); precedence is **env > file > built-in default**. Never mix business settings into the bootstrap, and never scatter middleware endpoints through application code — one bootstrap module per middleware.

### Mandatory Middleware Fails Fast; Auxiliary Middleware Degrades Loudly

Classify each integration before writing its error handling:

- **Mandatory** — the service is incorrect without it (the config center). If it can't be reached or returns empty/invalid data, the process **exits non-zero**. No fallback to env vars, stale caches, or built-in defaults: a service running on guessed config is worse than one that refuses to start.
- **Auxiliary** — the service is degraded but correct without it (metrics export, log shipping). Its failure must **never take the service down**: log the failure loudly, surface it in health/readiness detail, keep retrying in the background — and never block a request path on it.

Either way, the failure is **loud and actionable**: the error names the middleware, the endpoint/namespace/identifier that was tried, and what to check.

### Every Backend Service Exposes the Monitoring Surface

A server-side service is not done until the platform can see it: `GET /healthz` (liveness), `GET /readyz` (readiness with per-dependency detail), and `GET /metrics` (Prometheus) on the business port. This is non-negotiable scaffolding — without it the orchestrator can't manage the instance and on-call is flying blind. Wire these endpoints when the service skeleton is first stood up, not as a later add-on; see [references/monitoring.md](references/monitoring.md) for the contract and per-language wiring.

### Secrets Stay in the Bootstrap Layer

Middleware credentials (Nacos password, future tokens/keys) live in env vars or the gitignored bootstrap file — never in code, committed config, logs, or error messages. When a reference shows a credentials file, it is per-profile and gitignored by construction.

### Use the Official SDK, Pinned

Integrate via the middleware's official client library at a pinned version; don't hand-roll the wire protocol. Configure the SDK to honor the principles above (e.g. disabling a client cache that would silently mask a fast-fail — see the Nacos reference for a concrete case).
