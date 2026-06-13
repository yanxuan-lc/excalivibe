# MySQL Usage Guidelines

Rules for MySQL/MariaDB schema design, migrations, and queries. Thresholds in **bold** come straight from our internal audit config and are MUST values. Read the Universal Principles in `SKILL.md` first; this file adds MySQL-specific syntax and the engine-specific rules.

## Table of Contents
- [DDL — Naming](#ddl--naming)
- [DDL — Field Types](#ddl--field-types)
- [DDL — Constraints & Defaults](#ddl--constraints--defaults)
- [DDL — Indexes & Table Limits](#ddl--indexes--table-limits)
- [DDL — Online Schema Change](#ddl--online-schema-change)
- [DML](#dml)
- [DQL](#dql)
- [Reference Skeleton](#reference-skeleton)

---

## DDL — Naming

| Level | Rule | Why |
|-------|------|-----|
| 强制 | Table/column/index names: lowercase letters, digits, underscore only; no leading digit. Identifier check is on (`CheckIdentifier`). | Linux is case-sensitive on table files. |
| 强制 | No identifier is a MySQL reserved word or keyword (`order`, `desc`, `range`, `match`, `key`, `user`, `group`, `select`, `table`, `interval`, `rank`…). Rename to a non-reserved word (`sort_order`, not `order`). | Reserved words force backtick-escaping in every statement; one forgotten backtick errors or silently parses as the keyword. The full list is in the MySQL manual's "Keywords and Reserved Words". |
| 强制 | Primary key column is named `id`. | Our config enforces `DDLPrimaryKeyMust`. |
| 强制 | Index naming: ordinary index `idx_<cols>`, unique index `uniq_<cols>`; index name must not be empty. `uk_` is **not** an accepted unique-index prefix — use `uniq_`. | `DDLIndexNameSpec` is on; identifies intent and prevents duplicate indexes. |
| 推荐 | Table name reads `business_purpose` (e.g. `order_refund`), singular noun (maps to one DO/entity). | Consistency with ORM mapping. |
| 推荐 | Boolean-ish column named `is_xxx`. | Self-describing; pairs with the `is_deleted` convention. |
| 强制 | Table name length ≤ **64** characters. | `MaxTableNameLen` = 64. |

## DDL — Field Types

| Level | Rule | Why |
|-------|------|-----|
| 强制 | Money / exact decimals use `decimal`; `float`/`double` are auto-rewritten to `decimal`. | `DDLCheckFloatDouble`. Binary float loses precision. |
| 强制 | No `bit`, `enum`, or `set` columns (`AllowSpecialType` off). Model enums as `tinyint`/`int` with each value explained in the column comment. | `enum`/`set` are painful to alter; integer + comment is portable. |
| 强制 | `char` column length ≤ **36** (`DDLMaxCharLength`). Use `char` only for true fixed-length values (e.g. a 32/36-char hash or UUID); use `varchar` for variable text. | Fixed-length `char` pads storage; long fixed fields are usually a modeling smell. |
| 推荐 | Time columns use `datetime`, not `timestamp`, for business time. | Avoids the 2038 limit and implicit time-zone conversion. |
| 推荐 | Integers default to `unsigned` when the value is never negative; keep `varchar` lengths tight and split very long text into its own table. | Wider positive range; oversized rows hurt index and row storage. |
| 强制 | Column type changes are allowed only for safe widening or compatible conversions (`int → bigint`, `int(50) → int(20)` per `DDLAllowColumnType`). Narrowing that can truncate data is not. | Prevents silent data loss on migration. |

## DDL — Constraints & Defaults

| Level | Rule | Why |
|-------|------|-----|
| 强制 | Every table and every column has a `COMMENT`. | `DDLCheckTableComment` + `DDLCheckColumnComment`. |
| 强制 | Every column is `NOT NULL` — no engine exemption, including `datetime`/`timestamp` (`DDLCheckColumnNullable`). `DEFAULT NULL` must never appear in a column definition. | NULL costs index/statistics overhead and complicates logic; we want zero NULL defaults sneaking in via the `timestamp` loophole. |
| 强制 | Non-`text`/`blob`/`json` columns have an explicit non-NULL `DEFAULT` (`DDLCheckColumnDefault`) — never `DEFAULT NULL`. For `datetime`/`timestamp`: bookkeeping columns (`created_time`, `updated_time`) use `CURRENT_TIMESTAMP` (with `ON UPDATE CURRENT_TIMESTAMP` for `updated_time`); business time columns that may not have happened yet (e.g. `paid_time`, `closed_time`, `expired_at`) use the sentinel `'1970-01-01 00:00:00'` and document it in the column comment — do **not** default them to `CURRENT_TIMESTAMP`, which would falsely record "now" as the event time. | Predictable values, and the default actually means what it says. |
| 强制 | `text`/`blob` columns take **no `DEFAULT`** — and `DEFAULT ''` is banned (MySQL rejects a bare literal default on `TEXT`/`BLOB` anyway, and an empty-string default is a `NULL`-in-disguise that hides "app never set it"). They stay `NOT NULL`; the application supplies the value on every insert. | An empty default on a large column masks the missing-write bug `NOT NULL` exists to catch. |
| 强制 | `json` columns **never** default to `''` (not valid JSON). Prefer no default (app supplies a valid document). If a default is genuinely needed, use a shape-matching empty document as an **expression default** (MySQL 8.0.13+): `DEFAULT (JSON_OBJECT())` for an object column, `DEFAULT (JSON_ARRAY())` for an array column — parentheses required. Stays `NOT NULL`. | `''` is malformed JSON; an expression default keeps the stored value a valid, queryable document. |
| 强制 | Every table has a primary key named `id` (`DDLEnablePrimaryKey` + `DDLPrimaryKeyMust`). | Stable row identity. |
| 强制 | Auto-increment columns start at 1 (`DDLEnableAutoincrementInit`). | Consistent baseline. |
| 推荐 | PK is typically `bigint unsigned auto_increment` — but our config does **not** force this: non-int PKs are allowed (`DDLAllowPRINotInt` on), and auto-increment/unsigned are **not** mandatory (`DDLEnableAutoIncrement` / `DDLEnableAutoincrementUnsigned` off). Use a non-int or externally-generated id when the design needs it (distributed/snowflake ids). | We support distributed id schemes, so we don't hard-require auto-increment. |
| 强制 | Every business table includes `created_time`, `updated_time`, `is_deleted` (`MustHaveColumns`). Delete logically via `is_deleted`. | Auditability and recoverability. |
| 强制 | Engine is InnoDB; charset is `utf8mb4`. Don't set per-column charset/collation outside the approved set. | Transactions + row locks + crash recovery; full Unicode incl. emoji. |
| 强制 | No foreign keys / cascades. Enforce relationships in the application. | FK locking hurts concurrency and complicates sharding/migration. |

## DDL — Indexes & Table Limits

| Level | Rule | Why |
|-------|------|-----|
| 强制 | At most **5** indexes per table (`DDLMaxKey`). | Each index taxes every write. |
| 强制 | At most **5** columns in a composite index (`DDLMaxKeyParts`). | Diminishing returns past a few columns. |
| 强制 | A column the business treats as unique gets a unique index. | Prevents duplicate/dirty data at the DB layer. |
| 推荐 | `varchar` indexes specify a prefix length when the full column is long (e.g. first 20 chars). | Balances index size against selectivity. |
| 推荐 | Leftmost-prefix design: high-selectivity / equality columns first; don't index frequently-updated columns needlessly. | Hit rate vs. maintenance cost. |
| 推荐 | Partitioned tables are off (`AllowCreatePartition` off). Views are allowed (`AllowCreateView` on). | Partitioning adds operational complexity we avoid by default. |

## DDL — Online Schema Change

| Level | Rule | Why |
|-------|------|-----|
| 强制 | Online schema change is on (`IsOSC`). When a table is larger than **100 MB** (`OscSize`), the `ALTER` runs through **gh-ost** (our configured `OSCExpr`) instead of a direct `ALTER`. | A bare `ALTER` on a big live table locks writes / stalls replication. |
| 强制 | Online DDL must throttle on replication lag and load (`--max-lag`, `--max-load Threads_running=N`, `--critical-load …`) so it pauses under pressure. | Prevents the migration from knocking over the primary/replicas. |
| 强制 | One ticket = one DDL statement; no multiple `ALTER`s batched into one ticket (`DDLMultiToCommit` / `DDLAllowMultiAlter` off). | Each change is independently reviewable and revertible. |
| 强制 | `DROP TABLE` / `DROP DATABASE` are disabled by default (`DDLEnableDropTable` / `DDLEnableDropDatabase` off). Confirm explicitly before any drop. | Irreversible data loss. |
| 推荐 | `ALTER ... AFTER/FIRST` column positioning is allowed (`DDLAllowChangeColumnPosition` on); cross-schema table moves are allowed (`DDLEnableAcrossDBRename` on). | Permitted by our config — no special handling needed. |

## DML

| Level | Rule | Why |
|-------|------|-----|
| 强制 | `INSERT` lists its columns explicitly; the column names must exist (`DMLInsertColumns`). No `INSERT INTO t VALUES (...)`. | Column-position inserts break silently when the schema changes. |
| 强制 | Every `UPDATE` / `DELETE` has a `WHERE` (`DMLWhere`). | A missing predicate mutates the whole table. |
| 强制 | No `ORDER BY` in DML statements (`DMLOrder`); no sub-`SELECT` clause inside DML (`DMLSelect`). | These signal an over-complex mutation that should be split. |
| 强制 | `UPDATE` also sets `updated_time`. | Change tracking. |
| 强制 | A single `INSERT` ≤ **10,000** rows (`DMLMaxInsertRows`); a DML statement should affect ≤ **2,000** rows (`MaxAffectRows`). Batch larger writes. | Caps lock scope, replication lag, and undo size. |
| 推荐 | `NULL` inserts are allowed (`DMLAllowInsertNull` on) and `update`/`insert` are not forced to carry `LIMIT` (`DMLAllowLimitSTMT` off) — but still scope every mutation tightly. | Our config is permissive here; judgment still applies. |
| 推荐 | Avoid `REPLACE INTO` / `INSERT ... ON DUPLICATE KEY UPDATE` unless you've reasoned about auto-increment gaps and the implicit delete. | Surprising side effects. |
| 强制 | Application SQL contains no DDL. | DDL implicitly commits and can lock the table. |

## DQL

| Level | Rule | Why |
|-------|------|-----|
| 强制 | No `SELECT *` — list columns explicitly. | Less parse/network/IO; keeps covering indexes usable. |
| 强制 | Use `#{}` parameter binding (MyBatis), never `${}` string interpolation. | `${}` is a SQL-injection hole. |
| 强制 | `count(*)` for row counts — not `count(col)` (skips NULL rows) or `count(1)`. Wrap `SUM` as `IFNULL(SUM(col), 0)` to avoid NULL results. | Correct semantics; NULL-safe aggregates. |
| 推荐 | Join at most 3 tables; joined columns share a type and the referenced column is indexed. | Controls join blow-up and avoids implicit conversion. |
| 推荐 | No leading-wildcard `LIKE '%x'` / `'%x%'` (use a search engine for that). Don't wrap an indexed column in a function or rely on implicit type conversion in `WHERE`. | Defeats B-tree leftmost-prefix; forces full scans. |
| 推荐 | Paginated queries carry an `ORDER BY`; for deep pagination use keyset (`WHERE id > ?`) instead of large `OFFSET`. | Stable ordering; avoids scanning+discarding rows. |
| 推荐 | Verify plans with `EXPLAIN`: aim for `type` of `ref`/`const`/`range`, not `index`/`ALL`; prefer covering indexes (`Using index`). | Catches full scans before production. |
| 推荐 | Keep `IN (...)` lists bounded (a few hundred elements); for big sets, join a temp table. | Huge `IN` lists are slow to plan and execute. |

---

## Reference Skeleton

A table that satisfies the MUST rules:

```sql
CREATE TABLE `order_refund` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `order_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '关联订单ID',
  `amount`       DECIMAL(12,2)   NOT NULL DEFAULT 0.00 COMMENT '退款金额(元)',
  `status`       TINYINT         NOT NULL DEFAULT 0 COMMENT '状态: 0待处理 1成功 2失败',
  `created_time` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_time` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`   TINYINT         NOT NULL DEFAULT 0 COMMENT '逻辑删除: 0否 1是',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_order_id` (`order_id`),
  KEY `idx_status_created` (`status`, `created_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单退款表';
```
