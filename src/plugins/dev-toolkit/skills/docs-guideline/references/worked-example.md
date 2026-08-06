# Worked Example — Archiving a config/logging change

A concrete pass through the workflow, so the steps feel real. The scenario mirrors a change like `2026-05-24-server-config-logging-observability`: the server moved to Nacos-as-sole-config-source, added structured logging, and shipped K8s manifests. There was a prior research report (`research/2026-05-24-server-config-logging-k8s/`) that explored this.

This is illustrative, not a script to copy verbatim — your change will touch different areas. The point is *how* the steps chain.

---

## Step 1 — Read the archive for facts

The change record — an archived spec directory in this project's case — contains `proposal.md`, four `spec-*.md` (config-bootstrap-nacos, logging-slog-handlers, local-docker-compose-stack, deploy-k8s-manifests), and `tasks.md`.

Mining it, the **durable facts** (steady state) are:
- Nacos is the *sole* config source; unreachable ⇒ server exits 1 (no env fallback). DataId `ATS_SERVER`, namespace = profile (`dev/test/prod`).
- Logging: all environments write JSON to file + stdout (dev = colored tint, test/prod = JSON).
- `ATS_PROFILE` selects namespace + stdout handler + validates debug switches.

The **narrative to drop**: "first round we recommended env fallback, user decided in round two to make it fail-hard" — that's the proposal's story, not the as-built. (But the *why* — "Nacos is the single source of truth so config can't silently diverge" — is worth one sentence in the tech doc.)

Note also from `tasks.md`/notes: OpenObserve + Vector were later **removed** — so don't document them as current even though specs mention them. *Reality (notes) beats intent (proposal).*

## Step 2 — Classify

Three durable areas, three homes:
- **Nacos config mechanism** → it's a standalone, server-owned-but-lifecycle-independent mechanism → top-level `docs/tech/nacos/` (with a `config.example.yaml`).
- **Logging + profile + startup behavior** → this is the *server module's* narrative → `docs/tech/server/`.
- **K8s deploy manifests** → deployment artifact; if other docs/tests reference `deploy/k8s/`, a short `docs/tech/` note links to it; otherwise a section in `server/`.

One change, multiple homes — split it; don't write one giant `config-logging.md`.

## Step 3 — Write/update as-built docs

- `docs/tech/nacos/README.mdx` — header authoritative source `ats-server/internal/config/loader.go`; documents: Nacos sole source, fail-hard on unreachable, DataId/namespace scheme, the `config.example.yaml` shape. One sentence of *why* (single source of truth). No proposal prose.
- `docs/tech/server/README.mdx` — update (it likely already exists) the logging + profile + startup sections; link out to `nacos/` for config rather than restating it.

## Step 4 — README indexes

`nacos/` is new → write its `README.mdx` (it's a leaf, so the routing table may just point to the example file + back to `tech/`). `server/` already had a README → refresh it.

## Step 5 — Cross-link

- `server/README.mdx` config section → links to [`../nacos/`](../nacos/).
- `nacos/README.mdx` → links back to the research report as history.

## Step 6 — Mark the research STALE

`research/2026-05-24-server-config-logging-k8s/README.mdx` proposed the OpenObserve+Vector stack that was *removed*. Add the banner at top:

```markdown
> ⚠️ **STALE — history only (as of 2026-05-26)**
>
> This research assumed a "docker-compose brings up Nacos + OpenObserve + Vector" stack, which has been replaced:
> - Nacos is now an external instance; OpenObserve / Vector were removed entirely.
> The current truth is [`docs/tech/nacos/`](../../tech/nacos/) plus `deploy/k8s/*.yaml`.
```

Specific about what died and where truth lives now — not just "outdated".

## Step 7 — Walk up

- `docs/tech/README.mdx` routing table: ensure rows exist for "change runtime config / Nacos → `nacos/`" and "change the server → `server/`".
- `docs/README.mdx`: unchanged (no new top-level *home*; `nacos/` is inside the existing `tech/`).

## Step 8 — Verify recall

Trace: `docs/README.mdx` → `tech/` → (routing table row "change runtime config") → `nacos/`. Two hops. ✅
Duplication check: did the server doc re-paste the Nacos config shape? If so, cut it and link to `nacos/`.

## What the final report to the user looks like

```
[NEW] docs/tech/nacos/README.mdx — Nacos as the sole config source, DataId/namespace scheme, fail-hard when unreachable
[NEW] docs/tech/nacos/config.example.yaml — sample config
[UPDATED] docs/tech/server/README.mdx — logging (JSON+stdout) / profile / startup validation; the config section links to nacos/
[UPDATED] docs/tech/README.mdx — routing table gains the nacos row
[STALE] docs/research/2026-05-24-server-config-logging-k8s/README.mdx — OpenObserve/Vector removed; banner added pointing at tech/nacos/

Recall path: docs/README.mdx → tech/ (routing table row "change runtime config") → nacos/. Two hops.
research/ internals untouched; only the STALE banner was added.
```
