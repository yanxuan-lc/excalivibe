# Schema Change & Release

How a schema change travels from a migration file to a production database: **who** is allowed to apply it, what the application may do about the schema at startup, how a change that cannot be applied in one shot is expressed, and what the repository ships for a reviewer to run. Engine-agnostic — `mysql.md` and `postgresql.md` govern what a statement may look like, this file governs who runs it and when. The engine-specific mechanics that change the answers are collected at the bottom.

Read this whenever the work produces a migration, changes how migrations are executed, prepares a release's SQL, or asks "who applies this DDL".

## Who applies a change

| Level | Rule | Why |
|-------|------|-----|
| [MUST] | **Production DDL is applied by a person**, through the change-review process (a DBA ticket, a migration platform with an approval step) — never by the application process, and never as a side effect of a deploy. | A schema change is the one operation that is both irreversible and invisible in a code review that only looked at the diff. Review and timing have to be someone's explicit decision: an `ALTER` that locks a large table is an outage whose start time nobody chose. |
| [MUST] | **The application's database account holds no DDL privileges** — no `CREATE`, `ALTER`, `DROP`, `TRUNCATE`, `RENAME`. | Process discipline is not enforcement. The privilege is what holds when configuration is wrong, when someone runs the binary with the wrong flag, or when a dependency decides to "helpfully" auto-migrate. With the grant absent, the worst case is a process that refuses to start. |
| [MUST] | The runtime account gets **only the DML it actually uses**. Where deletion is logical (`is_deleted`), `DELETE` is not part of that set. | The narrower the grant, the smaller the blast radius of an injection or a mistaken data fix. Deriving it from what the code does, rather than from a template, is the only way it stays narrow. |
| [SHOULD] | Where a platform *does* apply migrations automatically (Flyway, Liquibase, Atlas, goose in a pipeline step), it uses a **separate migration account** with DDL, invoked only by the release step. The runtime account still has none. | Automation is fine; automation *inside the application process* is not. Separate accounts keep "may change the schema" attached to a step someone scheduled. |

```sql
-- MySQL: the runtime account of a service that deletes logically
GRANT SELECT, INSERT, UPDATE ON `app`.* TO 'app_rw'@'10.%';

-- PostgreSQL: same intent, plus the default-privileges clause future tables need
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE ON TABLES TO app_rw;
```

## The ledger

A ledger table (`schema_migration`, `flyway_schema_history`, `goose_db_version`, …) is what makes "which migrations has this database had" a fact rather than an assumption. Whether it comes from a tool or is 200 lines of your own, the rules are the same.

| Level | Rule | Why |
|-------|------|-----|
| [MUST] | Migrations are **versioned files, applied in filename order**, one concern per file, and the file is the unit the ledger records. | Ordering has to be readable from the directory listing, not reconstructed from timestamps in a table. |
| [MUST] | A ledger row is written **only after that file executed successfully**, and carries the file's **name plus a checksum of its content**. | A half-applied file must look unapplied so it is retried. The checksum is what turns "someone edited a migration that already ran" from an invisible divergence into a startup failure. |
| [MUST] | **A released migration is immutable.** Changing one is a startup failure, not a correction — ship the change as a new file. | The database is the record of what ran. A binary carrying an edited copy of an applied migration cannot know which version the schema actually has. |
| [MUST] | When a human applies the DDL, the release artifact **also writes the ledger rows** for exactly the files it applied. | Otherwise the next process to start finds them unapplied and replays them. Most `ALTER`s are not idempotent, so "replays them" means "fails to start", and the failure looks like a code bug rather than a missing bookkeeping row. |
| [MUST] | The ledger is read **without a soft-delete predicate**. | If a hand-deleted row made an applied migration look unapplied, the one mechanism that prevents replay would be defeated by an `UPDATE`. |
| [SHOULD] | Creating the ledger table is **probed first** (`information_schema` / `pg_catalog`), not issued unconditionally as `CREATE TABLE IF NOT EXISTS`. | `IF NOT EXISTS` is idempotent but not privilege-free: engines check the `CREATE` grant before checking existence, so an unconditional statement makes every startup require DDL rights even when there is nothing to do. See the engine notes. |

## Startup: apply, or verify and refuse

The application still has to **know** whether the schema it needs is there. Two modes, selected by one configuration value (`<APP>_MIGRATE=apply|verify`):

| | `apply` | `verify` |
|---|---|---|
| Where | Local development, CI, throwaway environments | **Production, and any environment whose account lacks DDL** |
| Ledger table absent | Create it | Refuse to start — the schema has not been built, and this process is the wrong actor to build it |
| Migration not recorded | Execute it, then record it | Refuse to start, naming every missing file and the release directory that carries it |
| Checksum mismatch | Refuse to start | Refuse to start |
| Ledger rows this binary does not carry | Ignore | Ignore — that is a rollback (older binary, newer schema), and refusing would turn "roll back the release" into "roll back the release and the database" |

| Level | Rule | Why |
|-------|------|-----|
| [MUST] | **`verify` is the default.** `apply` is opted into. | The environment that must not self-migrate is the one nobody remembers to configure. Defaulting the other way means a forgotten setting is a silent unreviewed DDL run, on a schedule nobody chose. |
| [MUST] | In `verify`, the process emits **no DDL at all** — including the ledger-table creation — and needs only `SELECT` on the ledger. | "Emits no DDL" is the property the least-privilege grant is chosen against. One unconditional statement is enough to break it. |
| [MUST] | `verify` **never writes the missing ledger rows**, even where the account is allowed to. | Recording "this migration ran" is a claim about DDL this process never saw run. Whoever forgot the row must be told, not covered for. |
| [MUST] | The failure is **a refusal to start**, not a warning and a degraded run. | A process serving traffic against a schema it was not built for produces wrong answers rather than errors. |
| [SHOULD] | Seeding **data** (reference rows, catalogues, a bootstrap admin) is separate from migrating **schema** and may keep running in `verify` — it is DML, and it often depends on secrets only the process holds (an encryption key, a password hash), which is exactly why it cannot live in a reviewed SQL file. | Conflating the two either pushes secrets into version-controlled SQL or blocks a deployment on data the DBA has no way to write. |

## Two-phase change (expand–contract)

Some changes cannot be applied in one step, because **DDL and deployment happen at different moments and in a fixed order**: the DBA applies SQL, then the new binary rolls out. A change that removes something the old code still reads must therefore be split.

- **Expand** — additive and backward-compatible: add a column *with a default*, add a table, add an index. Applied **before** the deployment, so the new binary may require it.
- **Contract** — removes or tightens: drop a column, drop a table, add a `NOT NULL`, narrow a type. Applied **after** the deployment is confirmed healthy, because until then the old code is still running.

| Level | Rule | Why |
|-------|------|-----|
| [MUST] | **The phase is declared in the migration file itself**, not in a wiki or a ticket description. A file that declares nothing is expand. | Which side of a deployment a statement belongs on is a property of the change. Anything that lets it be re-derived by hand gets re-derived wrongly at 2am. |
| [MUST] | A contract migration also declares **which release it belongs to**. | That release is the only window in which the schema may legitimately lag the binary. Without it, "tolerated" has no end. |
| [MUST] | `verify` grades an unapplied migration three ways: **expand → refuse**; **contract from this binary's own release → start, and warn**; **contract from an earlier release → refuse**. | The first keeps phase 1 mandatory. The second is what makes a two-phase change deployable at all. The third is the close-out: a forgotten phase 2 stops the *next* upgrade instead of living forever in a warning nobody reads. |
| [MUST] | **Expanding changes must be backward-compatible on their own.** Add columns with a default; never add a `NOT NULL` column without one. | Between phase 1 and the deployment, the new schema runs under the old code, and nothing guards that window. |
| [SHOULD] | Treat shipping a contract migration as **a commitment**. Withdrawing it after release is not clean: the file is immutable, so the only ways out are to apply it or to fake its ledger row. | Better to notice this before the release than to discover it while looking for a third option that does not exist. |

```sql
-- 004_drop_legacy_flag.sql
-- phase: contract
-- release: 0.3.0
ALTER TABLE `account` DROP COLUMN `legacy_flag`;
```

## What the repository ships

The reviewer runs SQL, not your migration runner. So the repository carries the same changes a second time, in the shape a DBA can read, review, and execute.

```text
database/<engine>/
  full/                                   empty database -> current version
    ddl/01-<table>.sql … NN-<table>.sql    final shape per table, not a replay of history
    dml/01-<table>.sql                     initialization data, ledger rows included
  incremental/<from>-to-<to>/             one directory per release
    pre-deploy/   ddl/ dml/                phase 1: before the deployment
    post-deploy/  ddl/ dml/                phase 2: after it is confirmed healthy (absent when empty)
  manifest.txt                             digests, so staleness is detectable without a database
```

| Level | Rule | Why |
|-------|------|-----|
| [MUST] | **One table per file**, named `<NN>-<table>.sql`, the number giving execution order within its directory. | A reviewer's unit is a table, and a ticket's unit is one DDL statement (see the online-schema-change rules). Both are served by the same split; a single 2,000-line release file serves neither. |
| [MUST] | **DDL and DML live in separate directories**, DDL first. | They are reviewed by different criteria and, on a big table, executed by different tooling. |
| [MUST] | **Ledger rows travel with the phase that ran their DDL.** A contract migration's ledger row belongs in `post-deploy/dml/`. | Put it in phase 1 and the ledger claims a change that has not happened, which also silences the warning that phase 2 is still owed. |
| [MUST] | The full build is the **current shape** of each table, not `CREATE` followed by the historical `ALTER`s. | It exists to stand up an empty database; replaying history there means every new environment re-enacts every past mistake, and the file stops answering "what does this table look like now". |
| [SHOULD] | These files are **generated from the migrations, never hand-written**, behind task-runner targets (`db-scripts` to generate, `db-check` to verify) with the check wired into the repository's gate. | Two hand-maintained copies of one schema diverge; the question is only when. Generation also re-proves, every time, that the migrations apply cleanly to an empty database. |
| [SHOULD] | The staleness check **must not need a database** — compare digests recorded in a manifest (of the migration sources, and of each generated file). | A gate that needs a live server is a gate that gets skipped. Recording both digests catches "a migration changed under the artifacts" and "someone edited a generated file". |
| [MUST] | Generation **refuses** when a migration that shipped in an earlier release has been edited or removed, and leaves the committed artifacts untouched when it refuses. | The deployed ledger still carries the old checksum. A refusal that had already overwritten the artifacts would put the tampered DDL into the file people trust. |

## Engine notes

**MySQL**

- There is **no `ADD COLUMN IF NOT EXISTS`** (8.0). A bare `ALTER` is therefore not idempotent, and the ledger is the only thing preventing a replay — which is exactly why a human-applied release must write the ledger rows.
- Privilege checks precede existence checks: `CREATE TABLE IF NOT EXISTS` on an existing table still needs `CREATE` and fails with `ER_TABLEACCESS_DENIED_ERROR (1142)` without it. Probe `information_schema.tables` instead — it also answers "the table exists but this account cannot see it" the same way, which is the answer you want.
- DDL is not transactional and each statement commits implicitly, so a multi-statement file can leave a half-applied schema behind. Keep one concern per file and let the ledger drive the retry.
- Large tables: see the online-schema-change rules in `mysql.md` (gh-ost above the size threshold, with lag and load throttling).

**PostgreSQL**

- DDL **is** transactional, so a multi-statement migration either lands or does not — but that makes the exceptions load-bearing: `CREATE INDEX CONCURRENTLY` and `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block, and most runners wrap each migration in one.
- `IF NOT EXISTS` exists for most objects, which makes idempotence easier but does not remove the privilege problem above: `CREATE` on the schema is still checked. Probe `pg_catalog`/`information_schema`.
- Set `lock_timeout` (and `statement_timeout`) per session inside the migration so a change that cannot get its lock fails fast instead of queueing behind — and blocking — every reader. See `postgresql.md`.
