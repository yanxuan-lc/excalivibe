# Database Write Verification (MySQL / PostgreSQL)

Applies to **both** GUI and API modes. The interface result is a claim; the database row is the proof. After the action under test, connect to the DB and assert that the expected data actually persisted — correctly typed, with the right derived/bookkeeping columns.

## Connect via the env connection string

Read the connection from the environment — do not hardcode credentials, and never paste them into the transcript. Common variable names to check, in order:

- A single URL: `DATABASE_URL`, `DB_URL` (e.g. `mysql://user:pass@host:3306/db`, `postgresql://user:pass@host:5432/db`).
- Discrete vars — MySQL: `MYSQL_HOST` / `MYSQL_PORT` / `MYSQL_USER` / `MYSQL_PASSWORD` / `MYSQL_DATABASE`. PostgreSQL: `PGHOST` / `PGPORT` / `PGUSER` / `PGPASSWORD` / `PGDATABASE`.
- A project `.env` / test config — read it if present.

**Point at a test/staging database, never production.** Confirm the target DB name before querying. If you can only find production credentials, stop and ask.

## Query — use the engine's client or a tiny script

Keep it to scoped `SELECT`s. Pick whatever's available:

```bash
# MySQL — psql/mysql CLI reads PGPASSWORD/MYSQL_PWD or takes -p
mysql -h "$MYSQL_HOST" -P "${MYSQL_PORT:-3306}" -u "$MYSQL_USER" "$MYSQL_DATABASE" \
  -e "SELECT id, status, is_deleted, created_time FROM orders WHERE order_no = 'E2E-123';"

# PostgreSQL — psql honors PG* env vars
psql -h "$PGHOST" -p "${PGPORT:-5432}" -U "$PGUSER" -d "$PGDATABASE" \
  -c "SELECT id, status, is_deleted, created_time FROM orders WHERE order_no = 'E2E-123';"
```

For richer assertions (JSON columns, multi-row counts), a small inline script in the project's language (psycopg/`mysql2`/`database/sql`) is fine — keep it read-only.

## What to assert

Don't just check "a row exists" — verify the write is *correct*:

- **Existence & uniqueness**: exactly the expected number of rows for the test's key (e.g. one `user` for the registered email, the right number of `order_item`s).
- **Column values**: the fields the feature set match what was submitted; derived fields (totals, status enums) are right.
- **Bookkeeping & conventions**: `created_time`/`updated_time` populated and sane; a "delete" flow sets `is_deleted = 1` (logical delete) rather than removing the row; money columns hold exact decimals. These conventions come from the `dba-guideline` skill — cross-check the engine's rules there when unsure what "correct" means.
- **No collateral writes**: the action didn't touch rows it shouldn't have.

## Timing — account for async writes

The interface often returns before the write settles (event handlers, queues, workers). Don't assert instantly — **poll** the table with a short bounded timeout (e.g. retry every 200ms up to a few seconds) and fail only if the row never appears. An immediate-assert false-negative is a classic e2e flake.

## Isolation & cleanup

- **Scope every query with a `WHERE`** tied to the test's own data (a unique e2e marker — `order_no = 'E2E-<runid>'`, an email like `e2e+<runid>@…`). Never `SELECT`/scan whole tables to "find" the row.
- Prefer reading; if the suite seeds or tears down fixtures, let it — don't hand-mutate. Any cleanup `DELETE` must be scoped to the test's marker and, outside an automated teardown, confirmed.
- Never run `UPDATE`/`DELETE` without a scoped `WHERE`, and never against production. (Same rule the `dba-guideline` skill enforces for app code.)

## Report

Fold the result into the skill's report table:

| Table | Expected write | Found? | Detail |
|-------|----------------|--------|--------|
| `users` | 1 row, email=e2e+42@x.io, is_deleted=0 | ✅ | id=9001, created_time set |
| `orders` | status=1 (paid) | ❌ | row present but status=0 (unpaid) → product bug |

A failed DB assertion with a green UI/API result is a **real** finding — surface it as prominently as an interface failure.
