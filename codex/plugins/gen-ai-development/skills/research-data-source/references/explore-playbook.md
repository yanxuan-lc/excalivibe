# Data-Source Exploration Playbook

Concrete read-only queries for exploring a live data source, plus channel selection and the safety red lines restated where they bite. Everything here is `SELECT`/catalog-read only — if you find yourself writing anything else, stop.

## Channel selection (no-install-first)

**Never install a DB client to run a query** (no `brew`/`apt`/`pip`/`npm` install, no new project dep). Use what's already there, in order:

1. **MCP data tool (preferred).** If a database/warehouse MCP server is connected this session, use its query interface — access is already scoped and you avoid handling raw credentials. Look for an `mcp__<server>__*` tool whose name matches the engine.
2. **Container client.** If the DB runs in Docker, the client already lives in the container — no host install:
   - `docker compose exec <db-service> psql -U <user> -d <db> -c "<query>"`
   - `docker compose exec <db-service> mysql -u <user> -p<pass> <db> -e "<query>"`
3. **Project's own DB access.** Reuse a runner the repo already wired: `python manage.py dbshell`, `prisma db execute --stdin`, `rails dbconsole`, a `make db-shell` target, etc.
4. **Client library already in the project's deps.** e.g. a tiny read-only `psycopg`/`pymysql` (Python) or `pg`/`mysql2` (Node) snippet — only if the driver is *already* installed.
5. **System CLI, only if already installed.** Check first: `command -v psql` / `command -v mysql`. If present:
   - PostgreSQL: `psql "$DATABASE_URL" -c "<query>"`
   - MySQL: `mysql --defaults-extra-file=<cnf>` or `mysql -h … -u … -p…` (prefer a defaults file so the password isn't in argv/history)
6. **None available → ask the user** how to connect, or hand them a query to run and paste back. Don't install.

Pull connection details from `DATABASE_URL` / `.env` / project config / `docker-compose` (same env-connection pattern as the `e2e-test` skill). Whichever channel: confirm **which environment** (prod / staging / replica / local) before the first query, and prefer a non-prod copy.

## PostgreSQL — read-only exploration

```sql
-- Inventory: tables + estimated row counts + size (fast, uses catalog stats)
SELECT relname AS table, n_live_tup AS est_rows,
       pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC
LIMIT 50;

-- Schema reality for one table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = '<table>'
ORDER BY ordinal_position;

-- Indexes
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = '<table>';

-- Sample real rows (ALWAYS bounded)
SELECT * FROM <table> LIMIT 20;

-- Distribution / cardinality / null rate
SELECT count(*) AS total,
       count(<col>) AS non_null,
       count(*) - count(<col>) AS nulls,
       count(DISTINCT <col>) AS distinct_vals
FROM <table>;

SELECT <col>, count(*) FROM <table> GROUP BY <col> ORDER BY count(*) DESC LIMIT 20;

-- Cost check before a heavy query
EXPLAIN SELECT ... ;   -- read the planner's row estimate before running for real
```

## MySQL — read-only exploration

```sql
-- Inventory: tables + estimated rows + size
SELECT table_name,
       table_rows AS est_rows,
       ROUND((data_length + index_length) / 1024 / 1024, 1) AS size_mb
FROM information_schema.tables
WHERE table_schema = DATABASE()
ORDER BY est_rows DESC
LIMIT 50;

-- Schema reality
SHOW FULL COLUMNS FROM `<table>`;
SHOW INDEX FROM `<table>`;

-- Sample real rows (ALWAYS bounded)
SELECT * FROM `<table>` LIMIT 20;

-- Distribution / cardinality / null rate
SELECT COUNT(*) AS total,
       COUNT(`<col>`) AS non_null,
       COUNT(*) - COUNT(`<col>`) AS nulls,
       COUNT(DISTINCT `<col>`) AS distinct_vals
FROM `<table>`;

SELECT `<col>`, COUNT(*) FROM `<table>` GROUP BY `<col>` ORDER BY COUNT(*) DESC LIMIT 20;

-- Cost check before a heavy query
EXPLAIN SELECT ... ;
```

## Cross-dataset checks

When the question is "do these line up", verify with bounded queries rather than assuming referential integrity:

```sql
-- Orphans: rows in child with no matching parent (bounded)
SELECT c.id FROM child c
LEFT JOIN parent p ON p.id = c.parent_id
WHERE p.id IS NULL
LIMIT 20;
```

## Safety red lines (restated — these bite here)

- **`SELECT` / `SHOW` / `EXPLAIN` / catalog reads only.** No `INSERT`/`UPDATE`/`DELETE`, no DDL, no `GRANT`. Writing is not research.
- **Bound everything.** No unbounded `SELECT *`. Use `LIMIT`; for size use `COUNT`/catalog estimates, not by pulling rows.
- **`EXPLAIN` before heavy aggregates** on large tables; prefer indexed columns and planner estimates over full scans.
- **Redact** connection strings, hosts, credentials, and any PII sample values in everything you write down. Credentials never land in files or commits.
