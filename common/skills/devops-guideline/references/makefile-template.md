# Reference Makefile

A complete, copy-ready file. `make.md` explains *why* each pattern is shaped the way it is; this is the shape itself, assembled once so two repositories initialized a month apart come out looking the same. Copy it, then delete the domains the project does not have and rename the ones it does.

What it fixes if you follow it literally: section banners and their order, where `.PHONY` lives, how `help` renders, which targets are aggregates and which are per-domain, and the comment style for the two or three places where a recipe needs a warning next to it.\n\nThree things in it are not cosmetic and must survive adaptation: **bare `make` prints help**, **help is grouped by domain with a title, a description and a divider per group**, and **three fixed colour roles** (group title, target name, description) with the name column padded so descriptions align. They are what makes the output something a person reads rather than greps.

## Adapting it

1. Replace `<project>` and the two example domains (`service` = a Go API, `web` = a pnpm frontend) with the real ones. One domain per toolchain, named after what a person would call it.
2. Delete whole sections rather than leaving empty ones — `db` only exists if the repo commits generated SQL, `deps` only if local middleware runs in compose.
3. Keep the group list in `help` in step with the sections. A section with no group is invisible; a group with no matching target prints an empty heading.
4. Keep the aggregates (`build` / `test` / `lint` / `fmt` / `check`) delegating only. The moment one of them contains a real command, the per-domain target it should have called stops being independently runnable.

## The file

```makefile
# <project> — the task runner.
#
# One front door: bare `make` lists everything this repository can do. The
# targets here orchestrate the native toolchains (go, pnpm, docker); they never
# reimplement what those already know.
#
# Two tiers. Aggregate verbs (build / test / lint / fmt / check) operate on the
# whole repository by delegating; the per-domain targets underneath stay
# independently runnable.

.DEFAULT_GOAL := help

# Captured before any `-include`, so `help` greps this file alone: an include
# appends its own path to MAKEFILE_LIST, and grepping two files makes grep
# prefix every match with `Makefile:`.
MK := $(firstword $(MAKEFILE_LIST))

SERVICE_DIR := service
WEB_DIR     := web

# Config lives in .env (gitignored, generated on first use from .env.example).
# `include` reads KEY=value as Make assignments — no shell runs on them, so
# values containing & ? ( ) or spaces are safe. `export` is what puts them in
# the environment of every recipe.
-include .env
export

.PHONY: help up env build test lint fmt check check-diff \
        service-build service-lint service-fmt service-test service-run \
        web-build web-lint web-test web-run \
        db-scripts db-check \
        deps-up deps-down deps-reset

# ── general ───────────────────────────────────────────────────────────────────

# Three properties here are load-bearing; do not simplify them away:
#   1. bare `make` prints this and builds nothing (.DEFAULT_GOAL above);
#   2. targets are grouped by domain, each group with a title, a one-line
#      description and a divider;
#   3. three fixed colour roles — group title (bold yellow), target name (cyan),
#      description (uncoloured) — plus a padded name column so the descriptions
#      line up. Colour separates the roles, alignment separates the columns.
help:                          ## list every target, grouped by domain
	@printf "\n\033[1m%s — make targets\033[0m\n" "$(notdir $(CURDIR))"
	@for group in general service web db deps; do \
		case "$$group" in \
			general) title="general — whole-repo entry points"; \
			         pat="^(help|up|env|build|test|lint|fmt|check|check-diff):" ;; \
			service) title="service — the Go API, 127.0.0.1:8080"; \
			         pat="^service-[a-zA-Z-]*:" ;; \
			web)     title="web     — the frontend, 127.0.0.1:5173"; \
			         pat="^web-[a-zA-Z-]*:" ;; \
			db)      title="db      — generated SQL under database/"; \
			         pat="^db-[a-zA-Z-]*:" ;; \
			deps)    title="deps    — local middleware (docker compose)"; \
			         pat="^deps-[a-zA-Z-]*:" ;; \
		esac; \
		printf "\n  \033[1;33m%s\033[0m\n" "$$title"; \
		printf "  \033[2m──────────────────────────────────────────────────\033[0m\n"; \
		grep -E "$$pat.*## " $(MK) \
			| awk '{ name=$$0; sub(/:.*/,"",name); desc=$$0; sub(/^.*## /,"",desc); \
			         printf "    \033[36m%-16s\033[0m %s\n", name, desc }'; \
	done; \
	printf "\n"

# `sub()` twice rather than `FS=":.*?## "`: BSD/macOS awk has neither the lazy
# quantifier nor a 3-argument match(), so the shorter idiom silently prints
# nothing on half the machines that run it.

# Run targets take no arguments: each one ensures its own preconditions (.env,
# reachable dependencies, schema present) before starting anything. `up` is the
# composition — it waits for readiness, reuses whatever is already running, and
# on Ctrl-C stops only what it started.
up:                            ## bring the whole local stack up (Ctrl-C stops it)
	@bash tools/dev/up.sh

env:                           ## create or repair .env, then print what a run points at
	@bash tools/dev/env.sh

build: service-build web-build  ## build every module
test:  service-test web-test    ## run every unit suite
lint:  service-lint web-lint    ## lint every module
fmt:   service-fmt              ## format the sources
check: lint db-check test       ## the full gate — run once per iteration on the integrated tree

check-diff:                    ## the inner loop: same gate, scoped to what changed
	@bash tools/dev/check-diff.sh

# ── service — Go ──────────────────────────────────────────────────────────────

service-build:                 ## compile the service
	@cd $(SERVICE_DIR) && go build ./...

service-lint:                  ## vet the service
	@cd $(SERVICE_DIR) && go vet ./...

service-fmt:                   ## rewrite the sources in gofmt's shape
	@cd $(SERVICE_DIR) && go fmt ./...

service-test:                  ## run the Go suite with coverage
	@cd $(SERVICE_DIR) && go test ./... -cover

service-run:                   ## serve on 127.0.0.1:8080 — no arguments needed
	@bash tools/dev/run.sh service

# ── web — pnpm ────────────────────────────────────────────────────────────────

web-build:                     ## type-check and bundle
	@cd $(WEB_DIR) && pnpm run build

web-lint:                      ## lint the frontend
	@cd $(WEB_DIR) && pnpm run lint

web-test:                      ## run the frontend suite
	@cd $(WEB_DIR) && pnpm run test

web-run:                       ## serve on 127.0.0.1:5173, proxying the API
	@bash tools/dev/run.sh web

# ── db — generated SQL ────────────────────────────────────────────────────────
#
# Not a source tree: the migrations are. These two project them into the shape a
# reviewer runs, and `db-check` is a prerequisite of `check` so a migration
# cannot land while the shipped SQL still describes the old schema. The check
# compares digests and needs no database.

db-scripts:                    ## regenerate database/<engine>/ from the migrations
	@node tools/db/gen.mjs

db-check:                      ## fail if the committed SQL no longer matches the migrations
	@node tools/db/gen.mjs --check

# ── deps — local middleware ───────────────────────────────────────────────────
#
# Middleware only, dev only: the service itself runs on the host so a restart
# stays instant. The danger is in the name — `deps-reset` wipes data.

deps-up:                       ## start local middleware and wait until healthy
	@docker compose up -d --wait

deps-down:                     ## stop local middleware, keep the data
	@docker compose down

deps-reset:                    ## [DESTRUCTIVE] wipe the data volumes and start again
	@docker compose down -v
	@docker compose up -d --wait
```
