---
name: devops-guideline
description: DevOps conventions for a repository — one self-documenting task-runner front door (Makefile / justfile / npm scripts / Taskfile) that delegates to native toolchains, docker-compose for local dev middleware (DB / MQ / cache), and the multi-stage non-root China-buildable Dockerfile that ships the service. Use this skill whenever creating or editing a task runner, unifying a multi-language or monorepo command surface, adding build/test/lint/fmt/run entry points, writing a docker-compose for local dependencies, writing a Dockerfile, or answering "how do I run/build X in this repo". Trigger it even when the user doesn't say "Makefile" or "guideline": if the output touches a task-runner file, a dev compose file, a Dockerfile, or CI entry points, consult this skill first and self-review against it. Service-side middleware integration (config center / metrics / logging) belongs to the companion middleware-guideline skill.
---

# DevOps Guidelines

Conventions for a repository's **task runner** — the single command interface a developer (or CI, or an agent) uses to build, test, lint, run, and operate the project. These exist so that "how do I do X in this repo" has exactly one answer that you can discover in one command, regardless of how many languages or services live inside.

The task runner is steering wheel, not engine: it **orchestrates** the native tools (cargo, go, pnpm, docker, …); it never reimplements them.

## How to Use This Skill

1. Read the **Universal Principles** below — they hold for any runner (Make, just, npm scripts, Taskfile).
2. Read the reference for the runner the project actually uses (routing table below) for concrete syntax and gotchas.
3. When the project already has a runner, match its existing structure before adding to it; consistency beats your preferred style.

## Runner Reference Routing

| Topic | Reference | When to read |
|-------|-----------|--------------|
| Make / Makefile | [references/make.md](references/make.md) | The repo uses (or will use) a `Makefile` as its task runner |
| Local middleware | [references/docker-compose.md](references/docker-compose.md) | Standing up DB / MQ / cache locally for development via docker-compose |
| Service image | [references/dockerfile.md](references/dockerfile.md) | Writing the Dockerfile that builds/ships the service (multi-stage, China mirrors) |

How the service *connects to* middleware at runtime (config center, metrics, logging) is the `middleware-guideline` skill's territory — this skill only stands middleware up locally for development.

The runner principles are runner-agnostic; only the syntax differs. The same shape maps cleanly onto `justfile`, `package.json` scripts, or a `Taskfile.yml` — add a reference when a project standardizes on one.

---

## Universal Principles

### One Front Door

A repository has **one** canonical command interface. A newcomer runs `make` (or `just`, `pnpm run`) with no arguments and sees everything they can do — they never have to memorize per-tool incantations (`cargo build --workspace`, `pnpm -r build`, `docker compose up`, `go test ./...`) or grep through README prose. If a command matters, it is a named target.

### Delegate, Don't Reimplement

The runner calls the native toolchains; it does not duplicate their logic. `make rust-test` runs `cargo test --workspace` — it does not re-encode what cargo already knows. Native workspaces (Cargo workspace, pnpm workspace, Go module) stay the build engines; the runner is a thin, uniform layer on top. This keeps the runner small and avoids two sources of truth.

### Verbs on Top, Domains Below

Structure targets in two tiers:

- **Aggregate verbs** operate on the whole repo: `build`, `test`, `lint`, `fmt`, `check`. Each one delegates to the per-domain targets.
- **Domain targets** do one toolchain or service: `rust-test`, `js-build`, `server-run`, `deps-up`. Each is independently runnable.

So `build: rust-build js-build server-build`, and a developer can still run just `make js-build`. The aggregates are the everyday interface; the domain targets are the escape hatch.

### Self-Documenting, Grouped Help

`help` is the default goal — running the bare command shows help, never executes a build. Every public target carries a one-line description **on the target itself** (so the doc cannot drift from the target), and `help` renders them **grouped by domain** with clear section headers. The help output is the onboarding doc: it should fit on roughly one screen and read top-to-bottom in logical groups.

### Group by the Repo's Real Seams

Groups mirror the project's actual toolchains and services — e.g. `rust / js / deps / server` — not arbitrary buckets. When two concerns are genuinely separate (the MySQL container vs. the Go server that uses it), give them separate groups even if their commands are related. The grouping is a map of the repo; make it an honest one.

### Make Cross-Tool Dependencies Explicit

When one domain consumes another's output (the JS package imports WASM bindings compiled from Rust; a binary embeds generated assets), encode that as a **real prerequisite** in the dependency graph — not a comment, not "remember to run X first" in the README. The runner should make it impossible to build in the wrong order. A correct `make build` from a clean checkout is the bar.

### Idempotent and Safe by Default

Targets are safe to re-run; running `build` twice does not break anything. **Destructive** targets (wiping a volume, resetting a database, force-cleaning) are named so the danger is unmistakable (`deps-reset`, `db-drop`) and never hide behind an innocuous verb. A newcomer skimming the help should be able to tell which commands can lose data.

### Config and Secrets via Environment

Runtime configuration comes from environment variables with a **checked-in `.env.example`** documenting every key. The runner loads `.env` if present and exports it to child processes, so a contributor's flow is `cp .env.example .env` → edit → run — independent of their shell. Never bake secrets into the runner, and never commit the real `.env` (gitignore it).

### Local Middleware, Not Local Services

Stateful dependencies a developer needs locally (DB, message queue, cache) are stood up with **docker-compose**, so `git clone` → run needs no externally-installed middleware. But the rule is narrow:

- **Compose orchestrates middleware only — never your own service.** The service runs on the host (or a debugger) for instant rebuild/restart/attach; compose owns the things you don't iterate on.
- **Dev-only.** The compose file never ships to production; prod middleware is the platform's job (k8s, managed services). Mark it as local-only.
- **Non-conflicting host ports.** Hardcoded ports collide when several projects run at once. Allocate a free host port on first bring-up, persist it, and reuse it — each repo lands on its own port. See [references/docker-compose.md](references/docker-compose.md).

### Ship a Minimal, Non-Root, China-Buildable Image

The service's production artifact is a container image (the deploy artifact — *not* the inner-loop dev path; local dev runs on the host against compose middleware). Build it well:

- **Multi-stage + minimal runtime.** A builder stage compiles; the runtime stage carries only the (static, stripped) binary plus `ca-certificates`/`tzdata`. Nothing from the toolchain leaks into the shipped image.
- **Non-root, least-privilege.** Run as a dedicated user; pre-create writable dirs with explicit ownership; exec-form `ENTRYPOINT` so SIGTERM reaches the process for graceful shutdown.
- **Build from inside China.** Default every package source to a domestic mirror (Go `goproxy.cn`, Alpine `mirrors.aliyun.com`, npm `npmmirror`, pip `tuna`, cargo sparse mirror…), overridable via `ARG` for builds abroad. Cache deps in their own layer + BuildKit cache mounts.
- **Bake non-secret defaults, override at runtime.** Bake a config template so zero-arg `docker run` starts; let env/volume override it. An image with baked credentials is a secret — never push it public. A `.dockerignore` keeps the context small and secret-free.

See [references/dockerfile.md](references/dockerfile.md).

### Fail Fast, Loud, with a Fix Hint

A target that needs a service, tool, or table checks for it and fails early with a message that says how to fix it ("MySQL schema missing — run `make server-db-init`"), rather than letting a confusing downstream error surface three layers deep. Surface missing prerequisites at the boundary.

### Portability over Cleverness

Don't depend on tool extensions the team's machines don't have. If the project runs on macOS, the help recipe must work with BSD/macOS userland (its `awk`/`sed` lack GNU/PCRE niceties); if it pins GNU tooling, say so. A task runner that only works on the author's laptop defeats its purpose. Prefer the boring, portable construct.
