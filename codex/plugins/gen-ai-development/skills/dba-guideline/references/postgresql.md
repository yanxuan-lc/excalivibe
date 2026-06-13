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
| 强制 | `snake_case`, all lowercase; identifier ≤ **63** characters; no leading `pg`, no `$` or non-ASCII. | Mixed case forces double-quoting everywhere; 63 is the identifier byte limit. |
| 强制 | No table/column/index name is a PostgreSQL reserved word or keyword (`order`, `user`, `group`, `desc`, `select`, `table`, `default`, `column`, `limit`…). Rename to a non-reserved word (`sort_order`, not `order`; `app_user`, not `user`). | A keyword identifier forces double-quoting in every statement; one forgotten quote errors or parses as the keyword. The full set is in the PostgreSQL manual's "SQL Key Words" appendix. |
| 推荐 | Table names are **plural** nouns (`orders`, `order_refunds`) — opposite of our MySQL singular convention. | PostgreSQL community norm; keeps generated code idiomatic. |
| 推荐 | Index names use PostgreSQL's suffix style: `<table>_<cols>_idx`, unique `<table>_<cols>_key`, pk `<table>_pkey`. (PostgreSQL auto-generates these.) | Matches what the engine emits; avoids fighting the defaults. |
| 推荐 | Primary key `id`; bookkeeping columns `created_time`/`updated_time`; booleans `is_`/`has_`. | Consistency with our internal conventions. |

## DDL — Field Types & Constraints

| Level | Rule | Why |
|-------|------|-----|
| 强制 | Every table and column has a comment via `COMMENT ON TABLE/COLUMN ...`; keep it updated on change. | Same self-documentation rule as MySQL; PostgreSQL needs separate `COMMENT ON` statements. |
| 强制 | Every column is `NOT NULL` with no engine exemption — including `timestamptz`/`timestamp`. `DEFAULT NULL` must never appear in a column definition. | NULL complicates logic, indexes, and statistics; if "unknown/absent" needs to be modeled, use a sentinel value with the meaning in the column comment, not NULL. |
| 强制 | Every column except the large/unstructured types carries an explicit non-NULL `DEFAULT` (e.g. `0`, `false`, a concrete timestamp). For `timestamptz`/`timestamp`: bookkeeping columns (`created_time`, `updated_time`) default to `now()`; business time columns that may not have happened yet default to the sentinel `'1970-01-01 00:00:00+00'` with the meaning documented in `COMMENT ON COLUMN` — do **not** use `now()` for them, since it would record "insert time" as the event. | Predictable values; avoids implicit NULL **and** avoids `now()` silently lying about when a business event happened. |
| 强制 | `text`/`bytea` columns take **no `DEFAULT`** — and `DEFAULT ''` is banned even though PostgreSQL would accept it. An empty-string default on a large column is a `NULL`-in-disguise that hides "app never set it". They stay `NOT NULL`; the application supplies the value on every insert. | Same intent as MySQL: an empty default masks the missing-write bug `NOT NULL` exists to catch. |
| 强制 | `jsonb` columns **never** default to `''` (errors — not valid JSON). Prefer no default (app supplies a valid document). If a default is genuinely needed, use a shape-matching empty document literal: `DEFAULT '{}'::jsonb` for an object column, `DEFAULT '[]'::jsonb` for an array column. Stays `NOT NULL`. | A valid empty document keeps every stored value queryable; `''` is malformed. |
| 强制 | Primary key required; use an **identity column**: `id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY` (preferred over legacy `serial`). | Identity is the SQL standard and avoids `serial`'s sequence-ownership pitfalls; PostgreSQL logical replication needs a key. Note: a non-int / externally-generated id is still acceptable per our PK rule. |
| 强制 | Money / exact decimals use `numeric`/`decimal`; avoid `real`/`double precision`. | Floating-point drift, same as MySQL's float/double ban. |
| 强制 | Booleans use the native `boolean` type — **not** `tinyint`/`smallint`. | PostgreSQL has a real boolean; integer flags are a MySQL-ism. |
| 推荐 | Business time uses `timestamptz`, stored in UTC. | Consistent cross-time-zone behavior. |
| 推荐 | Semi-structured/variable data uses `jsonb` (not `json`); store an array as one `jsonb`, not `jsonb[]`. | `jsonb` supports GIN indexing and efficient queries. |
| 推荐 | A column the business treats as unique gets a `UNIQUE` constraint. | Enforce uniqueness at the DB layer. |
| 推荐 | Mandatory bookkeeping columns `created_time timestamptz`, `updated_time timestamptz`, `is_deleted boolean`; delete logically. | Mirrors our `MustHaveColumns` rule. |
| 推荐 | No foreign keys with cascades / triggers / stored procedures for business logic. | Lock contention and hidden behavior, same rationale as MySQL. |

## DDL — Indexes & DDL Locking

This is where PostgreSQL diverges most from MySQL — there's no gh-ost/pt-osc; the engine has native online operations, and some `ALTER`s are metadata-only.

| Level | Rule | Why |
|-------|------|-----|
| 强制 | Build indexes on a production table with `CREATE INDEX CONCURRENTLY`. | A plain `CREATE INDEX` takes a lock that blocks writes for the build duration. |
| 强制 | `ADD COLUMN` with no default, or (PostgreSQL 11+) with a **constant** `DEFAULT` and `NOT NULL`, is a metadata-only change and completes instantly. A `volatile` default (e.g. `now()`, `random()`) still rewrites the whole table — avoid it on big tables. | Lets you add columns to large live tables without a long lock — but only if the default is constant. |
| 强制 | Online query paths must have a matching index; don't leave a large table to sequential scan (small fixed lookup tables excepted), and don't create indexes nothing uses. | Performance and wasted write/storage cost. |
| 推荐 | Keep indexes lean — our budget of ≤5 indexes per table and ≤5 columns per composite index applies here too. Index column data ≤ ~2 KB; for large/text columns use an expression index or GIN rather than a raw B-tree. | Same write-tax reasoning; PostgreSQL also caps index entry size at ~1/3 of a page. |
| 推荐 | Pick the index type for the access pattern: B-tree for equality/range, GIN for `jsonb`/full-text/array membership, GiST for geometric/KNN, BRIN for naturally-ordered huge tables (time series). | PostgreSQL's index variety is a strength — use the right one. |
| 推荐 | Match index sort direction to the query; for nullable sort columns, state `NULLS FIRST/LAST` explicitly. | `DESC` defaults to `NULLS FIRST`, which is often not what you want. |
| 强制 | `DROP TABLE`/`DROP DATABASE` are gated — confirm explicitly before any drop, same as MySQL. | Irreversible. |

## DDL — Partitioning & Maintenance

| Level | Rule | Why |
|-------|------|-----|
| 推荐 | Consider declarative partitioning only when a table exceeds ~100M rows or ~10 GB; shard above ~1 TB. Don't pre-partition small tables. | Avoids operational complexity until the size justifies it. |
| 推荐 | For large/high-churn tables, set an explicit autovacuum strategy and monitor bloat and transaction-id freeze. | **PostgreSQL-specific:** dead tuples accumulate (MVCC) and XID wraparound is a real outage risk; MySQL has no equivalent. |

## DML

| Level | Rule | Why |
|-------|------|-----|
| 强制 | `INSERT` lists its columns explicitly; `RETURNING` lists columns, never `RETURNING *`. | Schema-change safety. |
| 强制 | Every `UPDATE`/`DELETE` has a `WHERE`. | Prevents whole-table mutation. |
| 强制 | `UPDATE` also sets `updated_time`; before a data-fix, `SELECT` the predicate first. | Change tracking and blast-radius check. |
| 推荐 | Batch large writes; keep single-transaction row counts and duration bounded (our guides: ≤10,000 rows/insert, ≤2,000 rows affected/statement as a default ceiling). | Long transactions block autovacuum and bloat WAL — costlier on PostgreSQL than on MySQL. |
| 推荐 | Use native upsert `INSERT ... ON CONFLICT (...) DO UPDATE` instead of app-side select-then-insert. | **PostgreSQL-specific:** atomic and race-free; there's no `REPLACE INTO`. |

## DQL

| Level | Rule | Why |
|-------|------|-----|
| 强制 | No `SELECT *` — list columns. | Same as MySQL. |
| 推荐 | Don't leave large tables to sequential scan; in `WHERE`, avoid leading `!=`/`<>` on the driving condition and avoid wrapping indexed columns in functions (use an expression index if you must). | Negation and function-wrapped columns defeat index use. |
| 推荐 | For nullable sort columns, specify `NULLS FIRST/LAST`. | Default ordering is often unexpected. |
| 推荐 | Large result sets carry `LIMIT`; for deep pagination use keyset/cursor, not large `OFFSET`. | OFFSET scans and discards rows. |
| 推荐 | Read plans with `EXPLAIN (ANALYZE, BUFFERS)`; be suspicious of a `Seq Scan` on a big table. | **PostgreSQL-specific:** there's no MySQL-style `type` ladder — you read plan nodes instead. |

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

COMMENT ON TABLE  order_refunds              IS '订单退款表';
COMMENT ON COLUMN order_refunds.order_id     IS '关联订单ID';
COMMENT ON COLUMN order_refunds.amount       IS '退款金额(元)';
COMMENT ON COLUMN order_refunds.status       IS '状态: 0待处理 1成功 2失败';
COMMENT ON COLUMN order_refunds.is_deleted   IS '逻辑删除';

-- build secondary indexes online:
CREATE INDEX CONCURRENTLY order_refunds_status_created_idx
  ON order_refunds (status, created_time);
```
