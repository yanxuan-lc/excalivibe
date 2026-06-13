# Nacos as the Config Center

How a service reads its runtime configuration from Nacos. The model is **two layers**: a tiny *bootstrap* file tells the service how to reach Nacos; everything else (DB DSN, pool sizes, rate limits, tokens…) is the *business config*, which lives in Nacos and is fetched at startup.

```
conf/<project>-<profile>.yaml   →  how to reach Nacos (server, creds, namespace, group, dataId)
        │
        ▼  connect + GetConfig(dataId, group)
   Nacos namespace = <profile>  →  the actual business config (YAML document)
```

Do not confuse the two: the bootstrap file holds *no* business settings, and Nacos holds *no* connection settings.

## 1. PROFILE drives namespace isolation

A single env var, `<APP>_PROFILE` (e.g. `ATS_PROFILE`) = `dev | test | prod`, selects the environment. **The Nacos namespace is the profile** — you do not configure a separate namespace; deriving `NACOS_NAMESPACE = PROFILE` is what guarantees dev/test/prod configs can never bleed into each other.

```go
// namespace defaults to the profile string when left empty
boot.Namespace = pickString(os.Getenv("NACOS_NAMESPACE"), file.Nacos.Namespace)
if boot.Namespace == "" {
    boot.Namespace = string(boot.Profile)   // <- the isolation guarantee
}
```

Keep the bootstrap file's `namespace` empty (or equal to the profile) so the rule holds. The profile itself comes from `<APP>_PROFILE` env, falling back to `profile:` in the bootstrap file, defaulting to `dev`.

## 2. Bootstrap from `conf/<project>-<profile>.yaml`

The connection bootstrap is a per-profile file: `conf/<project>-dev.yaml`, `conf/<project>-prod.yaml`. It carries only what's needed to *find* Nacos:

```yaml
# conf/myservice-dev.yaml — bootstrap only (gitignored; holds Nacos creds)
profile: dev
nacos:
  server: "10.0.0.10:8848"     # host:port, no scheme/trailing slash; ContextPath is hardwired to /nacos
  username: "myservice-dev"
  password: "..."
  namespace: "dev"             # = profile; leave empty to derive automatically
  group: "DEFAULT_GROUP"
  data_id: "MYSERVICE"
  timeout_ms: 5000
  retry_attempts: 5
  retry_backoff_ms: 1000
```

Bootstrap precedence (connection params only): **env var > file > built-in default**. Required fields (`NACOS_SERVER`, `NACOS_USERNAME`, `NACOS_PASSWORD`) must be satisfied by some layer, else the service refuses to start with a message naming the missing field. Select the file via `--config <path>`, `$<APP>_CONFIG_FILE`, or a default search path (`./conf/<project>-<profile>.yaml`, `/etc/<project>/conf.yaml`). The Docker image bakes the prod bootstrap at `/app/conf/...` and lets env override per environment.

## 3. Fast-fail — no env / no stale-cache fallback

If the business config can't be fetched from Nacos, the service **exits non-zero**. It does **not** fall back to environment variables, a local cache, or built-in defaults for business config — a half-configured service that silently runs on stale/guessed values is worse than one that refuses to start.

Enforce it on both sides:

```go
// SDK: disable local-cache fallback so a Nacos outage can't serve stale config
cc := *constant.NewClientConfig(
    constant.WithNamespaceId(boot.Namespace),
    constant.WithNotLoadCacheAtStart(true),    // never serve a cached snapshot at boot
    constant.WithUpdateCacheWhenEmpty(false),  // an empty fetch is a failure, not "use cache"
    constant.WithUsername(boot.Username),
    constant.WithPassword(boot.Password),
)

// Loader: retry with backoff, then hard-fail. Empty content counts as failure.
raw, err := fetchRawWithRetry(ctx, boot, client)  // tries boot.RetryAttempts times
if err != nil {
    return nil, err            // → main.go logs and os.Exit(1)
}
if err := yaml.Unmarshal([]byte(raw), &cfg); err != nil { return nil, err }   // malformed = fail
if err := cfg.Validate(boot.Profile); err != nil { return nil, err }          // invalid = fail
```

```go
// main.go — the only acceptable response to "config unavailable" is to stop
holder, err := config.Load(ctx, *configFile)
if err != nil {
    slog.Error("failed to load config", "error", err)
    os.Exit(1)
}
```

Key points:
- **Empty config == failure.** A reachable Nacos that returns an empty document (wrong namespace/group/dataId, or a blank value) is a failure, not "use defaults".
- **No business config via env.** Env vars are allowed only for *bootstrap* (how to reach Nacos) and for the profile — never as a fallback source for the business config that Nacos owns.
- **Loud, actionable errors.** On failure, log the namespace/group/dataId that was tried so the operator can see exactly what was missing.

## Optional: hot-reload with a non-hot whitelist

Register `ListenConfig` to apply changes without a restart, but only for a **whitelist** of safe fields (log level, rate limits, feature flags). Changes to non-hot fields (DB DSN, listen addr, pool) are detected and surfaced as `pending_restart=true` (e.g. in `/readyz`) plus a warning log, rather than applied live. This keeps "reloadable" honest about what can actually change under a running process.
