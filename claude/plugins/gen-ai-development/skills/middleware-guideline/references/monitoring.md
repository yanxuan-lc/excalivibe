# Service Monitoring Surface: Health Checks + Prometheus Metrics

Every backend service exposes three endpoints **on its business port**. This is the contract the platform (k8s probes, Prometheus scraper, on-call humans) relies on — a service without it is invisible to monitoring and unmanageable by the orchestrator:

| Endpoint | Purpose | Returns |
|----------|---------|---------|
| `GET /healthz` | **Liveness** — the process is alive | `200` + `ok` (tiny, constant) |
| `GET /readyz` | **Readiness** — safe to send traffic | `200` / `503` + per-check JSON detail |
| `GET /metrics` | **Prometheus** scrape target | Prometheus text format |

## 1. Liveness vs readiness — keep them honestly different

The two answer different questions, and conflating them causes real outages:

- **`/healthz` checks nothing but the process itself.** No DB ping, no downstream call — it must be cheap, allocation-free, and dependency-free. The orchestrator *restarts* the pod when liveness fails; if `/healthz` checked the database, a DB outage would put every service into a restart loop and turn one incident into two.
- **`/readyz` checks whether traffic would succeed.** Verify the *mandatory* dependencies (business config loaded, DB pool can ping, required middleware reachable) with **bounded timeouts** (~1s per check). The orchestrator *stops routing* when readiness fails — which is exactly what you want while a dependency is down.
- **Auxiliary dependencies never fail `/readyz`.** A broken metrics push or log shipper makes the service degraded, not unready — report it in the detail body, keep returning `200`. (See the mandatory-vs-auxiliary principle in SKILL.md.)
- **Surface non-hot config changes here.** Per [nacos.md](nacos.md), a changed non-hot field sets `pending_restart=true` in the `/readyz` detail — readiness is where operators look for "this instance needs a bounce".

`/readyz` response shape (the detail is for humans and dashboards; the status code is for the orchestrator):

```json
{
  "status": "ok",
  "checks": {
    "config": "ok",
    "mysql":  "ok",
    "redis":  "degraded: dial timeout (auxiliary)"
  },
  "pending_restart": false
}
```

## 2. `/metrics` — official client, default registry, disciplined names

- **Use the language's official Prometheus client** at a pinned version; never hand-format the text protocol. Register the client's standard process/runtime collectors (GC, memory, FDs) — they come free and on-call relies on them.
- **Name app metrics per Prometheus conventions**: `<app>_<subsystem>_<name>_<unit>`, e.g. `myservice_http_requests_total`, `myservice_job_duration_seconds`. Counters end in `_total`; durations are histograms in seconds.
- **Instrument RED on every request path**: rate (`_requests_total` counter), errors (a `code`/`status` label on it), duration (`_request_duration_seconds` histogram). That's the minimum for a usable dashboard and alert set.
- **Keep label cardinality bounded.** Labels hold closed sets (method, route *template*, status code) — never user IDs, raw URLs, or anything unbounded; each label combination is a stored time series, and one unbounded label can take down the Prometheus server.

## 3. Same port, but not public

These endpoints share the business port (one listener, simple deployment), which means the routing/auth layer must treat them deliberately:

- **Exempt them from auth/rate-limiting for internal callers** (probes and the scraper don't carry tokens), via gateway path rules or middleware ordering.
- **Never expose them to the public internet.** `/metrics` leaks internals (routes, versions, volumes) and `/readyz` leaks dependency topology. The gateway/ingress blocks these paths from external traffic; only the cluster-internal plane reaches them.

## 4. Wiring per language

Bind the three endpoints before the business routes so they work even while the app is still warming up. Liveness handler first, readiness from a checker registry, metrics from the client's default handler.

**Go** — `prometheus/client_golang`:

```go
mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
    w.WriteHeader(http.StatusOK); w.Write([]byte("ok"))
})
mux.HandleFunc("/readyz", readiness.Handler)        // runs registered checks, 200/503 + JSON
mux.Handle("/metrics", promhttp.Handler())           // default registry incl. Go runtime collectors

reqDur := prometheus.NewHistogramVec(prometheus.HistogramOpts{
    Name: "myservice_http_request_duration_seconds", Help: "HTTP request latency.",
}, []string{"method", "route", "code"})
prometheus.MustRegister(reqDur)
```

**Python** — `prometheus-client` (FastAPI / any ASGI):

```python
from prometheus_client import make_asgi_app, Counter, Histogram

app.mount("/metrics", make_asgi_app())   # default registry incl. process collectors

@app.get("/healthz")
async def healthz(): return PlainTextResponse("ok")

@app.get("/readyz")
async def readyz():
    checks = await run_readiness_checks()            # bounded-timeout checks
    code = 200 if checks.all_mandatory_ok else 503
    return JSONResponse(checks.detail, status_code=code)
```

**Rust** — `axum` + `metrics-exporter-prometheus`:

```rust
let metrics = PrometheusBuilder::new().install_recorder()?;
let app = Router::new()
    .route("/healthz", get(|| async { "ok" }))
    .route("/readyz", get(readyz))                   // 200/503 + Json<ReadyDetail>
    .route("/metrics", get(move || async move { metrics.render() }))
    .merge(business_routes);
```

**Node.js** — `prom-client` (Express / Fastify):

```js
const client = require("prom-client");
client.collectDefaultMetrics();                      // process / event-loop collectors

app.get("/healthz", (_req, res) => res.send("ok"));
app.get("/readyz", async (_req, res) => {
  const detail = await runReadinessChecks();         // bounded-timeout checks
  res.status(detail.allMandatoryOk ? 200 : 503).json(detail);
});
app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.send(await client.register.metrics());
});
```

## 5. Where the rest of the stack hooks in

- The **Dockerfile** `HEALTHCHECK` and k8s probes point at `/healthz` / `/readyz` — building the image is `devops-guideline` territory; this file defines what those probes hit.
- **e2e/test tooling** can use `/readyz` as its "app is up" precondition instead of sleeping.
- Prometheus **scrape config / ServiceMonitor** is the platform's side of the contract — the service's only job is to keep `/metrics` accurate and cheap.
