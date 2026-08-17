---
name: dba-guideline
description: "Decide how data should be modelled and queried here, and check the result against the recorded SQL-review rules rather than against general best practice — whether a column's type is right, whether an index earns its place, whether a migration can run on a large table without locking it, whether a query will scan. Carries the internal review rules for MySQL and PostgreSQL, including the thresholds and the money-and-precision rules that a reasonable-looking ORM mapping quietly violates. Reach for it whenever the work produces or reviews a schema, a migration, an ORM model or entity, a DDL or DML statement, or a non-trivial query — including when nobody says \"guideline\", and including when the question is only \"is this field type ok\". It also carries how a schema change reaches a production database: who is allowed to apply the DDL and with which privileges, what the service may and may not do about the schema at startup, how a two-phase expand-contract change is declared, and what SQL the repository ships for a reviewer to run. It supplies the judgment about how the data layer ought to look; querying a live database to find out what is actually stored is separate work."
---

# Database Usage Guidelines

Our internal SQL-review rules (the source of truth, derived from our Yearning audit config) plus the *why* behind them from industry practice. These exist so database design and query logic stay consistent and safe — the failures we're preventing (full-table updates, missing indexes, precision loss in money fields, un-migratable big-table alters) are expensive and often irreversible in production.

## How to Use This Skill

1. Read the **Universal Principles** below — they hold for every database and every statement.
2. Identify the database in play (MySQL or PostgreSQL) and read the matching reference file. The two engines differ enough — naming, types, online-DDL mechanics — that you cannot reuse one's rules for the other. When the work is a *migration* rather than a query, read [references/schema-change.md](references/schema-change.md) too: it answers who applies the change and when, which the engine files do not.
3. Apply the rules as a **review pass on your own output**: after you draft a `CREATE TABLE`, an `ALTER`, a migration, or a query, walk it against the relevant rules before presenting it. When you find a violation, fix it and briefly say what you changed and why.
4. When a database-specific rule conflicts with a universal principle, the database-specific rule wins (it encodes an engine reality).

If you don't yet know which engine the project uses, look for clues (connection strings, ORM dialect, existing migrations, `docker-compose`) before asking the user.

## Reference Routing

| Topic | Reference | When to read |
|-------|-----------|--------------|
| MySQL | [references/mysql.md](references/mysql.md) | Any MySQL/MariaDB schema, migration, or query work |
| PostgreSQL | [references/postgresql.md](references/postgresql.md) | Any PostgreSQL schema, migration, or query work |
| Schema change & release | [references/schema-change.md](references/schema-change.md) | Writing or executing a migration, deciding who may apply DDL and with which privileges, expressing a two-phase (expand–contract) change, or shipping a release's SQL for someone else to run |

Read only the engine file for the engine in play — don't load both unless the task spans both. `schema-change.md` is engine-agnostic and collects the engine differences that change its answers, so read it *alongside* the engine file whenever the work is a migration rather than a query.

## Severity Levels

Every rule carries a level. Use it to decide how hard to push:

- **[MUST]** — a hard rule from our audit config or a near-universal industry consensus. Don't produce output that violates it; if the user explicitly asks for something that breaks it, flag the risk before complying.
- **[SHOULD]** — strong default. Follow it unless there's a concrete reason not to, and note the deviation when you skip it.

Thresholds (index counts, row limits, lengths) come straight from our internal audit config. **The number is a MUST even when the rule carrying it is a [SHOULD]** — the [SHOULD] governs whether the rule applies to your case at all; once it does, the threshold is not yours to round. So "batch large writes" is advice you may have a reason to skip, but if you are batching, 2,000 rows is the limit, not a suggestion.

---

## Universal Principles

These apply to both engines. Engine-specific syntax and exact thresholds live in the reference files.

### Every table and column is self-documenting [MUST]
Tables and columns must carry a comment. A status/enum column must spell out what each value means in its comment. Six months later, a column called `state tinyint` with no comment is a guessing game — the comment is the cheapest documentation we have and it lives next to the data.

**Write comments in whatever language the schema already uses.** A schema half in English and half in another language is worse than either, and a migration is the wrong place to start switching. On a greenfield schema with nothing to match, follow the project's own documentation language. The skeletons in the reference files are written in English because they are examples for you to read — copying their *language* into a schema whose existing comments differ is a mistake.

### Identifiers are never reserved words [MUST]
A table, column, or index name must not be a reserved word or keyword of the engine in play (`order`, `desc`, `key`, `range`, `match`, `user`, `group`, `select`, `table`, …). A keyword identifier forces backtick/double-quote escaping in *every* statement that touches it — and the day someone forgets the quotes, the query either errors or silently parses as the keyword. Pick a non-reserved name instead of paying that tax forever (e.g. `sort_order`, not `order`). The exact reserved-word set differs per engine — see the reference file's naming section.

### NOT NULL with an explicit default — `DEFAULT NULL` is banned [MUST]
Two separate requirements, no engine-level exemptions:
- **NOT NULL** applies to *every* column, with no exceptions — including `datetime`/`timestamp` and the large/unstructured types (`text`/`blob`/`json`). `DEFAULT NULL` must never appear in a column definition.
- **An explicit DEFAULT** applies to every column except the large/unstructured types `text`/`blob`/`json` — those follow the separate default discipline below. `datetime`/`timestamp` columns must carry a concrete default; "even DATETIME" is not an excuse to fall back on `NULL`.

Pick the default by **semantics**, not reflex:
- **Bookkeeping times** where "now" is the correct meaning — `created_time`, `updated_time` — use `CURRENT_TIMESTAMP` (with `ON UPDATE CURRENT_TIMESTAMP` for `updated_time`).
- **Business times** that may not have happened yet — `paid_time`, `closed_time`, `expired_at` — use a fixed sentinel (we use `'1970-01-01 00:00:00'`) and document the meaning in the column comment, e.g. `COMMENT 'payment time; 1970-01-01 means not yet paid'`. **Do not** use `CURRENT_TIMESTAMP` here — it would silently claim the event happened at insert time.
- **Business times the application must always supply** — a coupon's `valid_start_time`, a contract's `effective_date` — have no "not yet" state to encode, so a sentinel there means only "the app forgot to write this". That is the same `NULL`-in-disguise the `text`/`blob` rule below rejects, and it hides the bug a `NOT NULL` column exists to surface. Still write the sentinel (the explicit-DEFAULT rule has no exemption), but say so in the comment — `COMMENT 'validity start; required, 1970-01-01 means the writer omitted it'` — and put the real guard where it can act: a `CHECK` or the application's own validation. The default is a schema formality here, not the contract.

So an `int` column is `NOT NULL DEFAULT 0`; `created_time` is `NOT NULL DEFAULT CURRENT_TIMESTAMP`; `paid_time` is `NOT NULL DEFAULT '1970-01-01 00:00:00'`. `NULL` complicates every query (three-valued logic, `NULL`-safe comparisons, aggregates that silently skip rows) and costs more in indexes and statistics. Encode "unknown/absent" as the documented sentinel — never as `NULL`.

### Large/unstructured types have their own default discipline [MUST]
`text`/`blob`/`json` are still `NOT NULL`, but they do **not** follow the "every column gets a literal DEFAULT" rule — and the empty string is not an acceptable shortcut:
- **`text` / `blob`** carry **no `DEFAULT` at all** — and **`DEFAULT ''` is banned**. An empty-string default on a large column is a `NULL`-in-disguise: it looks like a value but really means "the application never set this", which hides the very bug a `NOT NULL` column is meant to surface. The application must always supply the value. (On MySQL a bare `DEFAULT ''` on a `TEXT`/`BLOB` is rejected by the engine anyway.) If a column is so optional that you reach for `DEFAULT ''`, it probably belongs in a separate table or should be a tightly-sized `varchar`.
- **`json`** must **never** default to `''` — the empty string is not valid JSON and will either error or store a malformed document. Prefer **no default** (the app supplies a valid document). If a default is genuinely required, it must be a **valid, shape-matching empty JSON document** expressed as an *expression* default — an empty object `{}` when the column holds an object, an empty array `[]` when it holds a list — never a bare empty string. The exact expression syntax is engine-specific (see the reference file).

The throughline: for these types, "absent" is expressed by the application writing a real, valid value on every insert — not by smuggling in `''` and pretending it's a default.

### Money and exact decimals never use float/double [MUST]
Binary floating point can't represent `0.1` exactly, so sums drift. Use the engine's exact-decimal type for money, rates, and anything where a rounding error is a bug, not a rounding.

### Every table has a primary key [MUST]
A primary key gives every row stable identity and lets replication and tooling address rows. Our convention names it `id`. We do **not** force the PK to be an auto-increment unsigned integer — a non-integer or externally-generated id (e.g. a distributed/snowflake id) is allowed — but the column must exist and be the primary key.

### Mandatory bookkeeping columns [MUST]
Every business table carries `created_time`, `updated_time`, and `is_deleted`. We delete logically (`is_deleted`), not physically — it keeps data recoverable and preserves an audit trail. `updated_time` must actually change on every `UPDATE`.

### Index naming and budget [MUST]
Index names carry a prefix that signals their kind, so they're identifiable and we don't build duplicates: ordinary indexes start with `idx_`, unique indexes with `uniq_` (the `uk_` prefix is **not** allowed — pick one prefix and stick to it). Keep indexes lean: **at most 5 indexes per table**, and **at most 5 columns in a composite index**. Every index taxes writes and storage; past a handful, the marginal index usually costs more than it saves. Put a unique index on any column the business treats as unique.

### Never scan or mutate the whole table by accident [MUST]
- `SELECT *` is banned — list the columns you need. It cuts parse/network/IO cost and keeps covering indexes usable.
- Every `UPDATE` / `DELETE` must have a `WHERE`. A missing (or `1=1`) predicate rewrites the entire table.
- Before a data-fix `UPDATE`/`DELETE`, `SELECT` the same predicate first to confirm the blast radius.

### Keep transactions and batches bounded [SHOULD]
Large writes go in batches, not one giant statement. Our limits: a single `INSERT` ≤ 10,000 rows, and a DML statement should not affect more than ~2,000 rows in one shot. Big single transactions inflate locks, replication lag, and undo/WAL; batching keeps them survivable.

### Big-table DDL goes through online-change tooling [MUST]
A direct `ALTER` on a large, live table can lock writes or stall replication. When a table is large (our trigger: roughly **> 100 MB**), run the change through online-DDL tooling with load/lag throttling rather than a bare `ALTER`. The mechanism differs by engine — see the reference files (gh-ost/pt-osc for MySQL; native `CONCURRENTLY` and metadata-only adds for PostgreSQL).

### Production schema changes are applied by a person, never by the application [MUST]
A production DDL statement is executed through the change-review process — a DBA ticket, or a migration platform with an approval step — and the application's own database account is **not granted `CREATE` / `ALTER` / `DROP`** so that this cannot be bypassed by a misconfiguration. The application still verifies at startup that the schema it needs is there, and refuses to start when it is not; it just never changes it. A change that removes something (drop a column, add a `NOT NULL`) is therefore two-phase: expand before the deployment, contract after it. The full rules — the ledger, the two modes, the phase declaration, and what SQL the repository ships for review — are in [references/schema-change.md](references/schema-change.md).

### Destructive DDL is gated [MUST]
Dropping a table or database is disabled by default in our config, on both engines. If a task genuinely needs one, call it out explicitly and confirm with the user — don't slip a `DROP` into a migration.

**Partitioning is engine-scoped, not universal.** Our audit config also rejects `CREATE ... PARTITION BY` on MySQL, and `references/mysql.md` carries that rule. PostgreSQL is the opposite case: declarative partitioning there is a legitimate tool past the size thresholds in `references/postgresql.md`, and the [SHOULD] that governs it is about *when*, not *whether*. Read the engine's reference file for the verdict — this principle does not ban partitioning outright.

### Don't push integrity or logic into the database [SHOULD]
Avoid foreign keys with cascades, triggers, and stored procedures for business logic — they add hidden lock contention and make behavior hard to reason about and migrate. Enforce relationships and rules in the application layer.

---

## Output Format When Reviewing SQL

When the user hands you SQL/DDL to review (rather than asking you to write it), produce a findings list rather than prose. For each issue:

```
[MUST|SHOULD] <rule, one line> — <what's wrong in this statement>
  → <the concrete fix>
```

End with a corrected version of the statement(s) if there were any [MUST] violations. If the SQL is clean, say so plainly and note which engine's rules you checked against — don't manufacture nitpicks.
