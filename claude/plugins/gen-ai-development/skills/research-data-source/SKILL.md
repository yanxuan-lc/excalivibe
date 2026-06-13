---
name: research-data-source
description: Research a real data source by actually connecting to it (via an MCP data tool or a connection string) and exploring schema, sample rows, value distributions, and data volume — instead of guessing from code or docs. Use this skill whenever a research conclusion depends on what the data actually looks like: "what's in this table", "how is field X populated in practice", "how many rows / how big", "is this column nullable in reality", "do these two datasets line up", or before designing anything that reads/writes a store you haven't inspected. Trigger it even when the user doesn't say "connect to the DB" — if answering well means looking at live data, connect and look. The companion source/API research skills are research-source-code and research-api.
---

# Data-Source Research

A schema definition tells you what's *allowed*; the data tells you what's *true*. Columns that are nominally nullable are 100% populated in practice; an enum field has three undocumented values; a "small" table has 400M rows. Conclusions that drive design decisions should rest on what the data actually contains — so connect to the source and look, read-only.

The output is a **grounded data finding**: claims about the data backed by the query you ran, the row counts you saw, and the sampling you did — recorded so the finding is reproducible and the reader knows it came from the live source, not a guess.

## When this applies

- The question is about *actual* data content/shape/volume, not just the declared schema.
- You're about to design a feature, migration, or query and need to know what you're dealing with.
- You need to validate an assumption ("this is always set", "these IDs match across tables").
- A "how big / how many / how distributed" question where the honest answer is a `COUNT`/`GROUP BY`, not a guess.

If you only need the declared schema and it's in the repo (migrations, ORM models), read that first — cheaper than connecting. This skill is for when you need the live data.

## Workflow

### 1. Pick a channel — no-install-first, adapt to what's already there

There's **no required tool** for this skill. Do **not** install a database client (no `brew install`, `apt install`, `pip install`, or adding a project dependency) just to run a query — that has side effects, may need elevated permissions, and pollutes the environment. Instead, use whatever the environment already provides, in this order of preference:

1. **A connected MCP database/warehouse tool** — zero install, access already scoped. Best choice when present (use `ToolSearch` to surface it if it's deferred).
2. **The project's own already-wired DB access** — reuse what the repo set up, no new install:
   - the DB running in a container → `docker compose exec <db-service> psql/mysql …` (the client lives *in the container*, not on the host)
   - an ORM/REPL or query runner the project already uses (e.g. `python manage.py dbshell`, `prisma db execute`, `rails dbconsole`, a `make db-shell` target, a seed/migration script)
3. **A client library in a runtime that's already present** — only if the driver is *already* a project dependency (e.g. `psycopg`/`pymysql` in a Python project, `pg`/`mysql2` in a Node project). Don't add the dependency yourself.
4. **A system CLI** (`psql` / `mysql`) — only if it's *already installed*. Check with `command -v psql` / `command -v mysql` first; treat its absence as "use another channel", not "install it".
5. **Nothing available?** Stop and **ask the user** how they'd like you to connect — or ask them to run a query you hand them and paste back the result. Surfacing the gap is correct; silently installing tooling is not.

Connection details come from the environment (`DATABASE_URL`, `.env`, project config, `docker-compose`) — the same env-connection pattern the `e2e-test` skill uses.

Before running anything, establish **which environment** you're pointed at. Prefer a read replica, a staging/analytics copy, or a local dev DB. If the only reachable source is production, say so explicitly and stay strictly read-only.

### 2. Explore — read-only

Identify the engine (MySQL / PostgreSQL / other) and follow [references/explore-playbook.md](references/explore-playbook.md) for the concrete read-only queries. The queries are the same regardless of which channel above you used to reach the DB:

- **Inventory** — list tables/views, sizes, row-count estimates.
- **Schema reality** — columns, types, constraints, indexes for the tables in scope.
- **Sample** — `SELECT … LIMIT n` to see real rows (never an unbounded select).
- **Distribution** — `COUNT`, `GROUP BY`, null rates, min/max/cardinality for the fields that matter to the question.

### 3. Record findings with provenance, secrets redacted

Write conclusions back into the active research report (`docs/research/<...>/`). For each data-backed claim record:

- Engine + database/schema + table(s) — but **never the raw connection string, host, or credentials** (redact to `mysql://***@***/<db>`).
- The query you ran (or its shape) and the sampling/aggregation口径 (e.g. "100-row sample", "full `COUNT` as of <time>").
- The query time — data is a moving target, so a finding without a timestamp can silently go stale.

## Safety red lines

These are non-negotiable — getting them wrong can corrupt production or leak secrets:

- **Never auto-install tooling.** No `brew`/`apt`/`pip`/`npm` install and no new project dependency to get a DB client. Use an already-present channel (MCP tool, container client, existing project tooling, pre-installed CLI); if none exists, ask the user. Installing is a side effect outside research's mandate.
- **Read-only, always.** Only `SELECT` / `SHOW` / `EXPLAIN` / catalog reads. **No `INSERT`/`UPDATE`/`DELETE`, no DDL (`CREATE`/`ALTER`/`DROP`/`TRUNCATE`), no `GRANT`.** If the task seems to need a write, stop and ask — writing is not research.
- **Always bound result size.** No unbounded `SELECT *` on an unknown table. Add `LIMIT`; for counts use `COUNT(*)`/estimates, not by fetching rows.
- **Estimate cost before heavy queries.** On large tables, `EXPLAIN` first; prefer planner row estimates and indexed columns over full scans. Don't run a multi-minute aggregate on prod without saying so.
- **Redact secrets.** Connection strings, hosts, tokens, and PII sample values must be masked in anything you write down — this repo's rule is that credentials never land in files/commits.
