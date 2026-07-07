# Makefile as a Task Runner

Concrete patterns for implementing the [universal principles](../SKILL.md) with GNU Make. Make is a good default runner: it's preinstalled almost everywhere, needs no toolchain, and `make <tab>` completion plus a self-documenting `help` make it discoverable.

Use Make as a **command launcher**, not a build system with `.o`-style file dependencies — targets are `.PHONY` verbs, not artifacts.

## Skeleton

```makefile
.DEFAULT_GOAL := help

# Capture this makefile's path BEFORE any `-include`, so `help` greps only it
# (see "The MAKEFILE_LIST gotcha" below).
MK := $(firstword $(MAKEFILE_LIST))

.PHONY: help build test lint fmt \
        rust-build rust-test \
        js-build \
        deps-up server-run

build: rust-build js-build server-build ## build everything
test:  rust-test  server-test           ## run all test suites
```

Every public target is `.PHONY` (it's a verb, never a file) and carries an inline `## one-line description`.

## Self-Documenting, Grouped Help

Put the description after the target's prerequisites with a `## ` marker, then let `help` parse and group them. Drive grouping with an explicit group→pattern map so aggregate targets (which share no name prefix) and multi-prefix domains both group cleanly:

```makefile
help: ## list all targets, grouped by domain
	@printf "\n\033[1mmy-project — make targets\033[0m\n"
	@for group in general rust js deps server; do \
		case "$$group" in \
			general) title="general — whole-repo entry points"; \
			         pat="^(help|install|build|test|lint|fmt|check):" ;; \
			rust)    title="rust    — Cargo workspace"; \
			         pat="^rust-[a-zA-Z-]*:" ;; \
			js)      title="js      — pnpm workspace"; \
			         pat="^(js|dev)-[a-zA-Z-]*:" ;; \
			deps)    title="deps    — local middleware (docker-compose)"; \
			         pat="^deps-[a-zA-Z-]*:" ;; \
			server)  title="server  — Go server"; \
			         pat="^server-[a-zA-Z-]*:" ;; \
		esac; \
		printf "\n  \033[1;33m%s\033[0m\n" "$$title"; \
		printf "  \033[2m──────────────────────────────────────────────\033[0m\n"; \
		grep -E "$$pat.*## " $(MK) \
			| awk '{ name=$$0; sub(/:.*/,"",name); desc=$$0; sub(/^.*## /,"",desc); \
			         printf "    \033[36m%-16s\033[0m %s\n", name, desc }'; \
	done; \
	printf "\n"
```

Why this shape:
- **Grouping by an explicit pattern**, not pure name-prefix, lets the `general` group collect `build`/`test`/`lint`/… (no shared prefix) and lets one group span several prefixes (`deps|db|server`) when needed.
- **`awk` with `sub()`**, not `FS=":.*?## "`. POSIX/BSD `awk` (macOS default) has no lazy `.*?` quantifier and no 3-arg `match()` capture array — those are GNU `gawk` extensions. `sub(/:.*/, "", name)` then `sub(/^.*## /, "", desc)` is portable everywhere.

## The MAKEFILE_LIST gotcha

If you auto-load `.env` with `-include .env`, that **appends `.env` to `$(MAKEFILE_LIST)`**. A `help` recipe that greps `$(MAKEFILE_LIST)` then greps two files, and `grep` prefixes every match with `Makefile:` — so every target name renders as `Makefile`. Capture the main makefile once, before the include, and grep only it:

```makefile
MK := $(firstword $(MAKEFILE_LIST))   # = the main Makefile
-include .env                          # appends .env to MAKEFILE_LIST
...
	grep -E "$$pat.*## " $(MK)          # grep the Makefile only, not .env
```

(If you instead source `.env` inside recipes rather than via `include`, `MAKEFILE_LIST` stays clean and grepping `$(MAKEFILE_LIST)` is fine — but `include` is the more ergonomic pattern, see below.)

## Aggregate Verbs Delegating to Domains

```makefile
build: rust-build js-build server-build ## build everything — Rust + WASM/JS + Go
test:  rust-test  server-test           ## run all test suites
lint:  rust-lint  js-typecheck server-lint
fmt:   rust-fmt   server-fmt
check: lint test                         ## CI-style gate

rust-build:   ; cargo build --workspace
rust-test:    ; cargo test  --workspace
server-build: ; cd server && go build ./cmd/...
server-test:  ; cd server && go test ./...
```

The aggregates are the everyday interface; each domain target stays directly runnable (`make rust-test`).

## Encode Cross-Tool Order as Prerequisites

When a domain consumes another's output, make it a real prerequisite — never a "run X first" comment. Example: the JS packages import WASM bindings compiled from Rust, so building/typechecking JS must build the WASM first:

```makefile
js-wasm:                 ## compile Rust → wasm bindings
	pnpm build:wasm
js-build: js-deps        ## build wasm + JS (pnpm build runs build:wasm then build:js)
	pnpm build
js-typecheck: js-deps js-wasm
	pnpm -r typecheck
```

A clean checkout's `make build` must succeed without the developer knowing the order.

## .env Autoload (shell-agnostic)

`-include` + `export` makes `cp .env.example .env && make server-run` work without the caller exporting anything — handy on shells like fish where `source .env` / `export` don't apply:

```makefile
-include .env
export YINMO_DB_DSN YINMO_AUTH_TOKEN YINMO_LISTEN
```

`include` parses `KEY=value` lines literally (values with `&`, `?`, `(` are safe — Make doesn't run a shell on them), unlike sourcing `.env` in `/bin/sh`, where an unquoted `&` would background. `.env` values override the inherited environment; a missing `.env` is harmless (`-include` ignores it). Gitignore `.env`.

## Name Destructive Targets Honestly

```makefile
deps-up:    ## start MySQL container and wait until ready
deps-down:  ## stop MySQL container
deps-reset: ## wipe MySQL data volume and restart   ← danger is in the name
```

Never hide a volume wipe or DB reset behind an innocuous verb like `clean` or `setup`.

## Two-Tier Quality Gate (`check` vs `check-diff`)

One full gate paid once, one scoped gate for every inner loop. Without the second tier,
every pipeline role re-runs the full oracle and a 20-minute suite gets paid 3–4× per
change (measured):

- **`check`** — the full merge gate: fmt-check + lint + ALL tests. Run **once**, at the
  merge node. Nobody else re-runs it; they read its recorded result (command, real exit
  code, commit stamp).
- **`check-diff`** — the scoped iteration gate: map `git diff` (committed vs merge-base +
  staged + unstaged + untracked) to changed packages, expand to workspace **reverse
  dependencies** (`cargo tree -i <pkg> --workspace` or the ecosystem's equivalent), then
  run fmt + lint + tests on that subset only. Escalate to full `check` when
  workspace-root files changed (root manifest, lockfile, Makefile, `scripts/`). Pipeline
  roles use `check-diff` for inner loops; only the merge gate pays for `check`.

Hard-won sub-rules (all measured in a real Rust workspace; the principles generalize):

- **Lint trust via warnings-as-errors.** `clippy -- -D warnings` makes INCREMENTAL lint
  results trustworthy: a crate with a warning fails and is never cached green, so there
  is no "must cold-relint to trust it" tax (that tax was ~9 min/run).
- **Test-runner parallelism.** Workspaces with many small integration-test binaries:
  plain `cargo test` runs binaries strictly sequentially; `cargo-nextest` schedules all
  tests globally in parallel. Caveats: doctests don't run under nextest — keep a
  `cargo test --doc` step if the workspace has any; tests spawning real servers must use
  OS-assigned ephemeral ports to be parallel-safe.
- **Nested-build antipattern.** Test harnesses that invoke `cargo build` from INSIDE test
  code serialize on the build tool's file lock under concurrent load (a 2-test suite
  measured 430 s waiting on the lock). Pre-build required binaries once at the
  task-runner level; keep the in-test build only as an idempotent fallback.
- **Feature-resolution discipline.** Package-subset invocations (`cargo <cmd> -p a -p b`,
  `--exclude`) resolve dependency features differently from full-workspace invocations,
  flipping compilation fingerprints and recompiling already-built deps from scratch
  (measured: heavyweight deps fully rebuilt by a `-p` build immediately after a workspace
  build of the same tree). Rule: every gate command selects the FULL workspace
  (`--workspace`) so features resolve one canonical way and the cache stays warm; scope
  at the RUN level instead (e.g. nextest `-E 'package(x)'` filtersets), never at the
  build-selection level.

## Conventions Checklist

- `.DEFAULT_GOAL := help` — bare `make` shows help, never builds.
- Every public target is `.PHONY` and has an inline `## description`.
- Aggregate verbs (`build/test/lint/fmt/check`) delegate to per-domain targets.
- Two-tier gate: `check` (full, merge node only) + `check-diff` (scoped inner loop);
  gate commands always build the full workspace, scoping happens at the run level.
- `help` renders targets grouped by domain; groups mirror the repo's real toolchains/services.
- Cross-tool ordering is expressed as prerequisites, not comments.
- Config via `.env` (+ `.env.example`); `-include .env` + `export`; `.env` gitignored.
- Portable shell in recipes (no `gawk`-only / GNU-only constructs unless the project pins them).
- Capture `MK := $(firstword $(MAKEFILE_LIST))` before `-include` and grep that in `help`.
