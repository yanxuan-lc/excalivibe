# Worked Example — Archiving a config/logging change

A concrete pass through the workflow, so the steps feel real. The scenario mirrors a change like `2026-05-24-server-config-logging-observability`: the server moved to Nacos-as-sole-config-source, added structured logging, and shipped K8s manifests. There was a prior research report (`research/2026-05-24-server-config-logging-k8s/`) that explored this.

This is illustrative, not a script to copy verbatim — your change will touch different areas. The point is *how* the steps chain.

---

## Step 1 — Read the archive for facts

`openspec/archive/2026-05-24-server-config-logging-observability/` contains `proposal.md`, four `spec-*.md` (config-bootstrap-nacos, logging-slog-handlers, local-docker-compose-stack, deploy-k8s-manifests), `tasks.md`.

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

- `docs/tech/nacos/README.md` — header 权威源 `ats-server/internal/config/loader.go`; documents: Nacos sole source, fail-hard on unreachable, DataId/namespace scheme, the `config.example.yaml` shape. One sentence of *why* (single source of truth). No proposal prose.
- `docs/tech/server/README.md` — update (it likely already exists) the logging + profile + startup sections; link out to `nacos/` for config rather than restating it.

## Step 4 — README indexes

`nacos/` is new → write its `README.md` (it's a leaf, so the routing table may just point to the example file + back to `tech/`). `server/` already had a README → refresh it.

## Step 5 — Cross-link

- `server/README.md` config section → links to [`../nacos/`](../nacos/).
- `nacos/README.md` → links back to the research report as history.

## Step 6 — Mark the research STALE

`research/2026-05-24-server-config-logging-k8s/README.md` proposed the OpenObserve+Vector stack that was *removed*. Add the banner at top:

```markdown
> ⚠️ **STALE — 仅作历史参考（2026-05-26 起）**
>
> 本调研基于"docker-compose 自起 Nacos + OpenObserve + Vector"的栈，已替换：
> - Nacos 改用外部实例；OpenObserve / Vector 已完全移除。
> 现状以 [`docs/tech/nacos/`](../../tech/nacos/) 与 `deploy/k8s/*.yaml` 为准。
```

Specific about what died and where truth lives now — not just "outdated".

## Step 7 — Walk up

- `docs/tech/README.md` routing table: ensure rows exist for "改运行配置 / Nacos → `nacos/`" and "改 server → `server/`".
- `docs/README.md`: unchanged (no new top-level *home*; `nacos/` is inside the existing `tech/`).

## Step 8 — Verify recall

Trace: `docs/README.md` → `tech/` → (routing table row "改运行配置") → `nacos/`. Two hops. ✅
Duplication check: did the server doc re-paste the Nacos config shape? If so, cut it and link to `nacos/`.

## What the final report to the user looks like

```
[新建] docs/tech/nacos/README.md — Nacos 唯一配置源机制、DataId/namespace、不可达即 fail-hard
[新建] docs/tech/nacos/config.example.yaml — 配置样例
[更新] docs/tech/server/README.md — 日志(JSON+stdout)/profile/启动校验，配置部分链到 nacos/
[更新] docs/tech/README.md — 路由表补 nacos 行
[STALE] docs/research/2026-05-24-server-config-logging-k8s/README.md — OpenObserve/Vector 已移除，加横幅指向 tech/nacos/

召回路径：docs/README.md → tech/（路由表「改运行配置」）→ nacos/，两跳可达。
未改 research 内部内容，仅加 STALE 横幅。
```
