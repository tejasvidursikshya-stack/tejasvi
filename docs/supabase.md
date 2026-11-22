# Running Tejasvi on Supabase (PostgreSQL)

Tejasvi Campus now uses a Supabase PostgreSQL database instead of MySQL.

## Configuration

`.env` needs one database setting:

```
DATABASE_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
```

Write `@` in the password as `%40` (and `#` as `%23`). The old `DATABASE_HOST/PORT/NAME/USER/PASSWORD` lines are no longer read.

## Everyday commands

| Command | What it does |
|---|---|
| `npm start` | Applies pending migrations, builds if needed, starts http://localhost:3000 |
| `npm run doctor` | Checks the connection and installation marker |
| `npm run build` | Rebuild after changing code (`npm start` only builds when no build exists) |
| `npm run backup` | Exports every table (JSON Lines) and `storage/` to `backups/` |
| `node scripts/migrate.mjs` | Applies pending migrations in `database/postgres/` |

Supabase also keeps daily backups: Dashboard → Database → Backups.

## How the code talks to Postgres

The SQL in the app is still written in the MySQL style (`?` placeholders, backticks, `INSERT IGNORE`,
`ON DUPLICATE KEY UPDATE`, `UTC_TIMESTAMP(3)`, `col->>'$.key'`). `lib/pg-compat.mjs` translates each statement
to PostgreSQL and returns results in the shape mysql2 did (`[rows]`, `affectedRows`, `'YYYY-MM-DD HH:MM:SS.mmm'`
timestamps in UTC, 1/0 for booleans, numbers for counts). MySQL helper functions live in
`database/postgres/003_mysql_compat.sql`.

When writing new SQL:

- Quote identifiers with backticks, never double quotes (`"text"` is a string, as in MySQL).
- A new `ON DUPLICATE KEY UPDATE` table needs its conflict key in `UPSERT_KEYS` in `lib/pg-compat.mjs`.
- Use `CASE WHEN … END` instead of `IF()`, `SUM(CASE WHEN … THEN 1 ELSE 0 END)` instead of `SUM(condition)`,
  and subqueries instead of multi-table `UPDATE … JOIN` / `DELETE t FROM … JOIN`.
- Flag columns are `smallint` 0/1, as in MySQL.
- Text comparisons with `=` are case-sensitive in PostgreSQL (`LIKE` is translated to case-insensitive `ILIKE`).
- Set `TEJASVI_SQL_DEBUG=1` to log failing translated SQL to the console.

New schema changes go in a new numbered file in `database/postgres/`.
Every new table needs `ALTER TABLE … ENABLE ROW LEVEL SECURITY;` so Supabase's public API cannot read it.

## Files

- `database/postgres/001_schema.sql`, `002_constraints.sql`: schema converted from MySQL
- `database/postgres/003_mysql_compat.sql`: MySQL-compatible functions
- `scripts/pg/convert-mysql-dump.mjs`: converts a MySQL dump into the files above plus a data file
- `scripts/pg/load.mjs`: loads schema + data into an empty database (`--check` tests the connection)
- `scripts/pg/verify.mjs`: compares row counts and checks Row Level Security
- `database/migrations/`: the original MySQL migration history, kept for reference
