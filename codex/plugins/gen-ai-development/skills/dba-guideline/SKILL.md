---
name: dba-guideline
description: "Database guidelines (DDL / DML / DQL) for MySQL and PostgreSQL — our internal SQL-review rules plus industry best practices. Use for any work that produces or reviews SQL / schema / data-model artifacts: designing a schema, adding or altering tables/columns/indexes, choosing field types, writing DML or query logic, reviewing SQL or a migration. Trigger even when the user doesn't say \"guideline\": if the output includes a `CREATE TABLE` / `ALTER TABLE`, a migration file, an ORM model/entity, or a non-trivial query, consult this first and self-review against it."
---

# Database Usage Guidelines

Our internal SQL-review rules (the source of truth, derived from our Yearning audit config) plus the *why* behind them from industry practice. These exist so database design and query logic stay consistent and safe — the failures we're preventing (full-table updates, missing indexes, precision loss in money fields, un-migratable big-table alters) are expensive and often irreversible in production.

## How to Use This Skill

1. Read the **Universal Principles** below — they hold for every database and every statement.
2. Identify the database in play (MySQL or PostgreSQL) and read the matching reference file. The two engines differ enough — naming, types, online-DDL mechanics — that you cannot reuse one's rules for the other.
3. Apply the rules as a **review pass on your own output**: after you draft a `CREATE TABLE`, an `ALTER`, a migration, or a query, walk it against the relevant rules before presenting it. When you find a violation, fix it and briefly say what you changed and why.
4. When a database-specific rule conflicts with a universal principle, the database-specific rule wins (it encodes an engine reality).

If you don't yet know which engine the project uses, look for clues (connection strings, ORM dialect, existing migrations, `docker-compose`) before asking the user.

## Reference Routing

| Database | Reference | When to read |
|----------|-----------|--------------|
| MySQL | [references/mysql.md](references/mysql.md) | Any MySQL/MariaDB schema, migration, or query work |
| PostgreSQL | [references/postgresql.md](references/postgresql.md) | Any PostgreSQL schema, migration, or query work |

Read only the file for the engine in play — don't load both unless the task spans both.

## Severity Levels

Every rule carries a level. Use it to decide how hard to push:

- **【强制 / MUST】** — a hard rule from our audit config or a near-universal industry consensus. Don't produce output that violates it; if the user explicitly asks for something that breaks it, flag the risk before complying.
- **【推荐 / SHOULD】** — strong default. Follow it unless there's a concrete reason not to, and note the deviation when you skip it.

Thresholds (index counts, row limits, lengths) come straight from our internal config — they are not arbitrary, so treat them as MUST values, not suggestions.

---

## Universal Principles

These apply to both engines. Engine-specific syntax and exact thresholds live in the reference files.

### Every table and column is self-documenting 【强制】
Tables and columns must carry a comment. A status/enum column must spell out what each value means in its comment. Six months later, a column called `state tinyint` with no comment is a guessing game — the comment is the cheapest documentation we have and it lives next to the data.

### Identifiers are never reserved words 【强制】
A table, column, or index name must not be a reserved word or keyword of the engine in play (`order`, `desc`, `key`, `range`, `match`, `user`, `group`, `select`, `table`, …). A keyword identifier forces backtick/double-quote escaping in *every* statement that touches it — and the day someone forgets the quotes, the query either errors or silently parses as the keyword. Pick a non-reserved name instead of paying that tax forever (e.g. `sort_order`, not `order`). The exact reserved-word set differs per engine — see the reference file's naming section.

### NOT NULL with an explicit default — `DEFAULT NULL` is banned 【强制】
Two separate requirements, no engine-level exemptions:
- **NOT NULL** applies to *every* column, with no exceptions — including `datetime`/`timestamp` and the large/unstructured types (`text`/`blob`/`json`). `DEFAULT NULL` must never appear in a column definition.
- **An explicit DEFAULT** applies to every column except the large/unstructured types `text`/`blob`/`json` — those follow the separate default discipline below. `datetime`/`timestamp` columns must carry a concrete default; "even DATETIME" is not an excuse to fall back on `NULL`.

Pick the default by **semantics**, not reflex:
- **Bookkeeping times** where "now" is the correct meaning — `created_time`, `updated_time` — use `CURRENT_TIMESTAMP` (with `ON UPDATE CURRENT_TIMESTAMP` for `updated_time`).
- **Business times** that may not have happened yet — `paid_time`, `closed_time`, `expired_at` — use a fixed sentinel (we use `'1970-01-01 00:00:00'`) and document the meaning in the column comment, e.g. `COMMENT '支付时间; 1970-01-01 表示未支付'`. **Do not** use `CURRENT_TIMESTAMP` here — it would silently claim the event happened at insert time.

So an `int` column is `NOT NULL DEFAULT 0`; `created_time` is `NOT NULL DEFAULT CURRENT_TIMESTAMP`; `paid_time` is `NOT NULL DEFAULT '1970-01-01 00:00:00'`. `NULL` complicates every query (three-valued logic, `NULL`-safe comparisons, aggregates that silently skip rows) and costs more in indexes and statistics. Encode "unknown/absent" as the documented sentinel — never as `NULL`.

### Large/unstructured types have their own default discipline 【强制】
`text`/`blob`/`json` are still `NOT NULL`, but they do **not** follow the "every column gets a literal DEFAULT" rule — and the empty string is not an acceptable shortcut:
- **`text` / `blob`** carry **no `DEFAULT` at all** — and **`DEFAULT ''` is banned**. An empty-string default on a large column is a `NULL`-in-disguise: it looks like a value but really means "the application never set this", which hides the very bug a `NOT NULL` column is meant to surface. The application must always supply the value. (On MySQL a bare `DEFAULT ''` on a `TEXT`/`BLOB` is rejected by the engine anyway.) If a column is so optional that you reach for `DEFAULT ''`, it probably belongs in a separate table or should be a tightly-sized `varchar`.
- **`json`** must **never** default to `''` — the empty string is not valid JSON and will either error or store a malformed document. Prefer **no default** (the app supplies a valid document). If a default is genuinely required, it must be a **valid, shape-matching empty JSON document** expressed as an *expression* default — an empty object `{}` when the column holds an object, an empty array `[]` when it holds a list — never a bare empty string. The exact expression syntax is engine-specific (see the reference file).

The throughline: for these types, "absent" is expressed by the application writing a real, valid value on every insert — not by smuggling in `''` and pretending it's a default.

### Money and exact decimals never use float/double 【强制】
Binary floating point can't represent `0.1` exactly, so sums drift. Use the engine's exact-decimal type for money, rates, and anything where a rounding error is a bug, not a rounding.

### Every table has a primary key 【强制】
A primary key gives every row stable identity and lets replication and tooling address rows. Our convention names it `id`. We do **not** force the PK to be an auto-increment unsigned integer — a non-integer or externally-generated id (e.g. a distributed/snowflake id) is allowed — but the column must exist and be the primary key.

### Mandatory bookkeeping columns 【强制】
Every business table carries `created_time`, `updated_time`, and `is_deleted`. We delete logically (`is_deleted`), not physically — it keeps data recoverable and preserves an audit trail. `updated_time` must actually change on every `UPDATE`.

### Index naming and budget 【强制】
Index names carry a prefix that signals their kind, so they're identifiable and we don't build duplicates: ordinary indexes start with `idx_`, unique indexes with `uniq_` (the `uk_` prefix is **not** allowed — pick one prefix and stick to it). Keep indexes lean: **at most 5 indexes per table**, and **at most 5 columns in a composite index**. Every index taxes writes and storage; past a handful, the marginal index usually costs more than it saves. Put a unique index on any column the business treats as unique.

### Never scan or mutate the whole table by accident 【强制】
- `SELECT *` is banned — list the columns you need. It cuts parse/network/IO cost and keeps covering indexes usable.
- Every `UPDATE` / `DELETE` must have a `WHERE`. A missing (or `1=1`) predicate rewrites the entire table.
- Before a data-fix `UPDATE`/`DELETE`, `SELECT` the same predicate first to confirm the blast radius.

### Keep transactions and batches bounded 【推荐】
Large writes go in batches, not one giant statement. Our limits: a single `INSERT` ≤ 10,000 rows, and a DML statement should not affect more than ~2,000 rows in one shot. Big single transactions inflate locks, replication lag, and undo/WAL; batching keeps them survivable.

### Big-table DDL goes through online-change tooling 【强制】
A direct `ALTER` on a large, live table can lock writes or stall replication. When a table is large (our trigger: roughly **> 100 MB**), run the change through online-DDL tooling with load/lag throttling rather than a bare `ALTER`. The mechanism differs by engine — see the reference files (gh-ost/pt-osc for MySQL; native `CONCURRENTLY` and metadata-only adds for PostgreSQL).

### Destructive DDL is gated 【强制】
Dropping a table or database, and creating partitions, are disabled by default in our config. If a task genuinely needs one, call it out explicitly and confirm with the user — don't slip a `DROP` into a migration.

### Don't push integrity or logic into the database 【推荐】
Avoid foreign keys with cascades, triggers, and stored procedures for business logic — they add hidden lock contention and make behavior hard to reason about and migrate. Enforce relationships and rules in the application layer.

---

## Output Format When Reviewing SQL

When the user hands you SQL/DDL to review (rather than asking you to write it), produce a findings list rather than prose. For each issue:

```
[强制|推荐] <rule, one line> — <what's wrong in this statement>
  → <the concrete fix>
```

End with a corrected version of the statement(s) if there were any 【强制】 violations. If the SQL is clean, say so plainly and note which engine's rules you checked against — don't manufacture nitpicks.
