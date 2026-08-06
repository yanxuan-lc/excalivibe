# PostgreSQL Usage Guidelines

Rules for PostgreSQL schema design, migrations, and queries. Our internal audit config is MySQL-oriented, so these rules carry our internal *intent* (comments mandatory, NOT NULL + defaults, exact decimals, bounded indexes, mandatory bookkeeping columns, online-safe DDL) translated into PostgreSQL idioms, with the engine differences from industry practice (Bytebase review guide + PostgreSQL official docs) made explicit. Read the Universal Principles in `SKILL.md` first.

> **The big PostgreSQL-vs-MySQL differences** (don't carry MySQL habits over): table names are **plural**, index names use **suffixes** not the `idx_` prefix, booleans are a **native type** (not `tinyint`), there is **no `unsigned`** integer, identity columns replace `auto_increment`, time is `timestamptz`, and online index builds are **native** (`CONCURRENTLY`) rather than an external tool.

## Table of Contents
- [DDL — Naming](#ddl--naming)
- [DDL — Field Types & Constraints](#ddl--field-types--constraints)
- [DDL — Indexes & DDL Locking](#ddl--indexes--ddl-locking)
- [DDL — Partitioning & Maintenance](#ddl--partitioning--maintenance)
- [DML](#dml)
- [DQL](#dql)
- [Reference Skeleton](#reference-skeleton)

---

## DDL — Naming

| Level | Rule | Why |
|-------|------|-----|
| [MUST] | `snake_case`, all lowercase; identifier ≤ **63** characters; no leading `pg`, no `$` or non-ASCII. | Mixed case forces double-quoting everywhere; 63 is the identifier byte limit. |
| [MUST] | No table/column/index name is a PostgreSQL reserved word or keyword (`order`, `user`, `group`, `desc`, `select`, `table`, `default`, `column`, `limit`…). Rename to a non-reserved word (`sort_order`, not `order`; `app_user`, not `user`). | A keyword identifier forces double-quoting in every statement; one forgotten quote errors or parses as the keyword. The full set is in the PostgreSQL manual's "SQL Key Words" appendix. |
| [SHOULD] | Table names are **plural** nouns (`orders`, `order_refunds`) — opposite of our MySQL singular convention. | PostgreSQL community norm; keeps generated code idiomatic. |
| [SHOULD] | Index names use PostgreSQL's suffix style: `<table>_<cols>_idx`, unique `<table>_<cols>_key`, pk `<table>_pkey`. (PostgreSQL auto-generates these.) | Matches what the engine emits; avoids fighting the defaults. |
| [SHOULD] | Primary key `id`; bookkeeping columns `created_time`/`updated_time`; booleans `is_`/`has_`. | Consistency with our internal conventions. |

## DDL — Field Types & Constraints

| Level | Rule | Why |
|-------|------|-----|
| [MUST] | Every table and column has a comment via `COMMENT ON TABLE/COLUMN ...`; keep it updated on change. | Same self-documentation rule as MySQL; PostgreSQL needs separate `COMMENT ON` statements. |
| [MUST] | Every column is `NOT NULL` with no engine exemption — including `timestamptz`/`timestamp`. `DEFAULT NULL` must never appear in a column definition. | NULL complicates logic, indexes, and statistics; if "unknown/absent" needs to be modeled, use a sentinel value with the meaning in the column comment, not NULL. |
| [MUST] | Every column except the large/unstructured types carries an explicit non-NULL `DEFAULT` (e.g. `0`, `false`, a concrete timestamp). For `timestamptz`/`timestamp`: bookkeeping columns (`created_time`, `updated_time`) default to `now()`; business time columns that may not have happened yet default to the sentinel `'1970-01-01 00:00:00+00'` with the meaning documented in `COMMENT ON COLUMN` — do **not** use `now()` for them, since it would record "insert time" as the event. | Predictable values; avoids implicit NULL **and** avoids `now()` silently lying about when a business event happened. |
| [MUST] | `text`/`bytea` columns take **no `DEFAULT`** — and `DEFAULT ''` is banned even though PostgreSQL would accept it. An empty-string default on a large column is a `NULL`-in-disguise that hides "app never set it". They stay `NOT NULL`; the application supplies the value on every insert. | Same intent as MySQL: an empty default masks the missing-write bug `NOT NULL` exists to catch. |
| [MUST] | `jsonb` columns **never** default to `''` (errors — not valid JSON). Prefer no default (app supplies a valid document). If a default is genuinely needed, use a shape-matching empty document literal: `DEFAULT '{}'::jsonb` for an object column, `DEFAULT '[]'::jsonb` for an array column. Stays `NOT NULL`. | A valid empty document keeps every stored value queryable; `''` is malformed. |
| [MUST] | Primary key required; use an **identity column**: `id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY` (preferred over legacy `serial`). | Identity is the SQL standard and avoids `serial`'s sequence-ownership pitfalls; PostgreSQL logical replication needs a key. Note: a non-int / externally-generated id is still acceptable per our PK rule. |
| [MUST] | Money / exact decimals use `numeric`/`decimal`; avoid `real`/`double precision`. | Floating-point drift, same as MySQL's float/double ban. |
| [MUST] | Booleans use the native `boolean` type — **not** `tinyint`/`smallint`. | PostgreSQL has a real boolean; integer flags are a MySQL-ism. |
| [SHOULD] | Business time uses `timestamptz`, stored in UTC. | Consistent cross-time-zone behavior. |
| [SHOULD] | Semi-structured/variable data uses `jsonb` (not `json`); store an array as one `jsonb`, not `jsonb[]`. | `jsonb` supports GIN indexing and efficient queries. |
| [SHOULD] | A column the business treats as unique gets a `UNIQUE` constraint. | Enforce uniqueness at the DB layer. |
| [SHOULD] | Mandatory bookkeeping columns `created_time timestamptz`, `updated_time timestamptz`, `is_deleted boolean`; delete logically. | Mirrors our `MustHaveColumns` rule. |
| [SHOULD] | No foreign keys with cascades / triggers / stored procedures for business logic. | Lock contention and hidden behavior, same rationale as MySQL. |

## DDL — Indexes & DDL Locking

This is where PostgreSQL diverges most from MySQL — there's no gh-ost/pt-osc; the engine has native online operations, and some `ALTER`s are metadata-only.

| Level | Rule | Why |
|-------|------|-----|
| [MUST] | Build indexes on a production table with `CREATE INDEX CONCURRENTLY`. | A plain `CREATE INDEX` takes a lock that blocks writes for the build duration. |
| [MUST] | `ADD COLUMN` with no default, or (PostgreSQL 11+) with a **constant** `DEFAULT` and `NOT NULL`, is a metadata-only change and completes instantly. A `volatile` default (e.g. `now()`, `random()`) still rewrites the whole table — avoid it on big tables. | Lets you add columns to large live tables without a long lock — but only if the default is constant. |
| [MUST] | Online query paths must have a matching index; don't leave a large table to sequential scan (small fixed lookup tables excepted), and don't create indexes nothing uses. | Performance and wasted write/storage cost. |
| [SHOULD] | Keep indexes lean — our budget of ≤5 indexes per table and ≤5 columns per composite index applies here too. Index column data ≤ ~2 KB; for large/text columns use an expression index or GIN rather than a raw B-tree. | Same write-tax reasoning; PostgreSQL also caps index entry size at ~1/3 of a page. |
| [SHOULD] | Pick the index type for the access pattern: B-tree for equality/range, GIN for `jsonb`/full-text/array membership, GiST for geometric/KNN, BRIN for naturally-ordered huge tables (time series). | PostgreSQL's index variety is a strength — use the right one. |
| [SHOULD] | Match index sort direction to the query; for nullable sort columns, state `NULLS FIRST/LAST` explicitly. | `DESC` defaults to `NULLS FIRST`, which is often not what you want. |
| [MUST] | Set a short `lock_timeout` (a few seconds) before any `ALTER TABLE` on a live table, and retry. | Without it a blocked DDL takes the whole table down — see below. |
| [MUST] | Run `CREATE INDEX CONCURRENTLY` outside a transaction block, and check afterwards that the index came out valid. | CIC is rejected inside a transaction, and a failed CIC leaves a broken index behind — see below. |
| [MUST] | `DROP TABLE`/`DROP DATABASE` are gated — confirm explicitly before any drop, same as MySQL. | Irreversible. |

### "Metadata-only" is not "risk-free": the lock queue

A metadata-only `ADD COLUMN` finishes in microseconds, but it still takes an **ACCESS EXCLUSIVE**
lock to do it — and that is the part that causes outages. PostgreSQL's lock queue is ordered: if
one long-running transaction (an idle-in-transaction session, a slow analytics query, an open
`BEGIN` in a psql window) is holding a conflicting lock, your instant DDL waits — and **every
query that arrives after it queues behind the DDL**, including plain `SELECT`s that would
otherwise be unaffected. A migration that takes 0.6 ms in staging can stall an entire table in
production, and the cause is not the DDL's duration but the wait.

The guard is to refuse to wait:

```sql
SET lock_timeout = '3s';   -- fail fast instead of parking at the head of the queue
ALTER TABLE orders ADD COLUMN channel SMALLINT NOT NULL DEFAULT 0;
```

On timeout the statement errors, the queue drains, and you retry. Retrying a fast DDL a few times
costs nothing; blocking a table for the length of someone's forgotten transaction costs an
incident. Set it per-session in the migration, not globally.

### `CREATE INDEX CONCURRENTLY`: two hard edges

CIC is the [MUST] above, but it fails in two ways that a plain `CREATE INDEX` does not:

- **It cannot run inside a transaction block.** This is the first thing you hit when putting the
  rule into a migration file, because Flyway, Rails, Alembic, and most other tools wrap each
  migration in a transaction by default. Turn it off for that migration specifically
  (`disable_ddl_transaction!` in Rails, `transactional = false` in Flyway, autocommit in Alembic) —
  and if the tool cannot, the index does not belong in that migration.
- **A failed CIC does not roll back.** It leaves the index in place with `indisvalid = false`:
  the planner won't use it, writes still pay to maintain it, and — the part that makes this
  lasting rather than merely annoying — a later `CREATE INDEX CONCURRENTLY IF NOT EXISTS` sees
  the name is taken and **skips**, so the retry silently succeeds while the broken index stays
  forever. Always verify, and drop before retrying:

  ```sql
  SELECT c.relname FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
   WHERE NOT i.indisvalid;              -- must come back empty
  -- if it doesn't:
  DROP INDEX CONCURRENTLY idx_orders_created;   -- then rebuild
  ```

## DDL — Partitioning & Maintenance

| Level | Rule | Why |
|-------|------|-----|
| [SHOULD] | Consider declarative partitioning only when a table exceeds ~100M rows or ~10 GB; shard above ~1 TB. Don't pre-partition small tables. | Avoids operational complexity until the size justifies it. |
| [SHOULD] | For large/high-churn tables, set an explicit autovacuum strategy and monitor bloat and transaction-id freeze. | **PostgreSQL-specific:** dead tuples accumulate (MVCC) and XID wraparound is a real outage risk; MySQL has no equivalent. |

## DML

| Level | Rule | Why |
|-------|------|-----|
| [MUST] | `INSERT` lists its columns explicitly; `RETURNING` lists columns, never `RETURNING *`. | Schema-change safety. |
| [MUST] | Every `UPDATE`/`DELETE` has a `WHERE`. | Prevents whole-table mutation. |
| [MUST] | `UPDATE` also sets `updated_time`; before a data-fix, `SELECT` the predicate first. | Change tracking and blast-radius check. |
| [SHOULD] | Batch large writes; keep single-transaction row counts and duration bounded (our guides: ≤10,000 rows/insert, ≤2,000 rows affected/statement as a default ceiling). | Long transactions block autovacuum and bloat WAL — costlier on PostgreSQL than on MySQL. |
| [SHOULD] | Use native upsert `INSERT ... ON CONFLICT (...) DO UPDATE` instead of app-side select-then-insert. | **PostgreSQL-specific:** atomic and race-free; there's no `REPLACE INTO`. |

## DQL

| Level | Rule | Why |
|-------|------|-----|
| [MUST] | No `SELECT *` — list columns. | Same as MySQL. |
| [SHOULD] | Don't leave large tables to sequential scan; in `WHERE`, avoid leading `!=`/`<>` on the driving condition and avoid wrapping indexed columns in functions (use an expression index if you must). | Negation and function-wrapped columns defeat index use. |
| [SHOULD] | For nullable sort columns, specify `NULLS FIRST/LAST`. | Default ordering is often unexpected. |
| [SHOULD] | Large result sets carry `LIMIT`; for deep pagination use keyset/cursor, not large `OFFSET`. | OFFSET scans and discards rows. |
| [SHOULD] | Read plans with `EXPLAIN (ANALYZE, BUFFERS)`; be suspicious of a `Seq Scan` on a big table. | **PostgreSQL-specific:** there's no MySQL-style `type` ladder — you read plan nodes instead. |

---

## Reference Skeleton

A table that satisfies the rules above:

```sql
CREATE TABLE order_refunds (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id     BIGINT      NOT NULL DEFAULT 0,
  amount       NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  status       SMALLINT    NOT NULL DEFAULT 0,
  created_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted   BOOLEAN     NOT NULL DEFAULT false,
  CONSTRAINT order_refunds_order_id_key UNIQUE (order_id)
);

COMMENT ON TABLE  order_refunds              IS 'order refunds';
COMMENT ON COLUMN order_refunds.order_id     IS 'related order id';
COMMENT ON COLUMN order_refunds.amount       IS 'refund amount (yuan)';
COMMENT ON COLUMN order_refunds.status       IS 'status: 0 pending, 1 succeeded, 2 failed';
COMMENT ON COLUMN order_refunds.is_deleted   IS 'logical delete';

-- build secondary indexes online:
CREATE INDEX CONCURRENTLY order_refunds_status_created_idx
  ON order_refunds (status, created_time);
```
