# Database

## Engine

SQLite via Python's built-in `sqlite3` module. No additional driver needed.

## File location

`/data/pm.db` inside the Docker container (volume-mounted so data survives restarts).
During local `pytest` runs each test gets its own temp file via a fixture.

## Create-on-first-run strategy

`backend/app/db.py` is imported at app startup. It opens (or creates) the SQLite file,
runs `CREATE TABLE IF NOT EXISTS` for every table, enables WAL mode and foreign-key
enforcement, then checks whether the hardcoded user already exists. If not, it seeds
the default board with the five demo columns and ten demo cards so the app is
immediately usable without manual setup.

## Schema

See `docs/db-schema.json` for the full column/constraint/index listing. Summary:

| Table     | Purpose                                       |
|-----------|-----------------------------------------------|
| `users`   | One row per user (MVP has a single hard-coded user). |
| `boards`  | One board per user for MVP.                   |
| `columns` | Ordered columns belonging to a board. `position` (0-based integer) controls display order. |
| `cards`   | Cards belonging to a column. `position` (0-based integer) controls order within the column. |

All foreign keys cascade on delete. WAL journal mode is used so concurrent readers
don't block the writer.

## Design rationale

- **Integer primary keys** — simplest for SQLite; avoids UUID generation overhead.
- **`position` integer** — explicit ordering column, updated on every move. Simpler
  than gap-based schemes for an MVP with a small card count.
- **`details TEXT NOT NULL DEFAULT ''`** — details are always a string, never NULL,
  which simplifies the API layer.
- **No `updated_at` timestamps** — not required by any Part 1-10 feature; can be
  added later without a migration (SQLite ALTER TABLE ADD COLUMN).
