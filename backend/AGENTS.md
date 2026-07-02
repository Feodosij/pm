# Backend overview

FastAPI backend, packaged with `uv`. Serves the built Next.js frontend, handles
auth, the Kanban board API, and (in Part 8+) AI chat.

## File structure

- `app/main.py` — FastAPI app. Mounts the Next.js static export at `/` when inside
  Docker. Initialises the SQLite DB via `lifespan`. Registers the auth and board routers.
- `app/auth.py` — Auth routes and `require_auth` dependency:
  - `POST /api/login` — validates `{username, password}` against hardcoded credentials; sets an httpOnly session cookie on success.
  - `POST /api/logout` — clears the session cookie.
  - `GET /api/me` — returns `{authenticated: bool, username?: str}`.
  - `require_auth(session)` — FastAPI dependency; raises 401 when no valid session cookie is present.
- `app/db.py` — SQLite setup (create-on-first-run), seeding, and `get_connection()` context manager:
  - `init_db(db_path?)` — creates all tables and seeds the hardcoded user + default board if missing.
  - `get_connection(db_path?)` — context manager that yields a `sqlite3.Connection` with WAL mode and FK enforcement; auto-commits or rolls back.
  - DB path: `/data/pm.db` (env var `DB_PATH` overrides). Tests override via `monkeypatch`.
- `app/chat.py` — AI chat route and supporting logic:
  - `POST /api/chat` — body: `{message: str, history: [{role, content}]}`. Loads current board, builds a system prompt (board JSON + instructions), calls OpenRouter, parses `{reply, board_update}` from the response. `board_update` is a list of card operations (create/edit/move/delete). All operations are validated referentially (card_id and column_id must exist) before any DB write; if any fail the entire batch is rejected. Returns `{reply, board_update}`. Requires auth.
  - `CardOperation` — Pydantic model with `@model_validator` enforcing per-operation required fields.
  - `_build_messages(board, history, message)` — assembles `[system, ...history, user]` message list.
  - `_validate_ops_referential(ops, board)` — checks all IDs exist; returns error string or None.
  - `_apply_operation(conn, op)` — applies a single CardOperation to the DB.
- `app/board.py` — Board API routes (all require a valid session via `require_auth`):
  - `GET /api/board` — returns the current user's board as `{id, title, columns[{id, title, cards[{id, title, details}]}]}`. Column and card order is by `position` ascending.
  - `POST /api/board/cards` — body: `{column_id, title, details?}`. Creates a card at the end of the column. Returns 201 + `{id, title, details}`.
  - `PATCH /api/board/cards/{id}` — body: `{title?, details?, column_id?, position?}`. Edit title/details and/or move the card to a new column + position. Returns 200 + updated card.
  - `DELETE /api/board/cards/{id}` — deletes the card, shifts positions of remaining cards in the same column. Returns 204.
  - `PATCH /api/board/columns/{id}` — body: `{title}`. Renames a column. Returns 200 + updated column with its cards.
- `pyproject.toml` — `uv`-managed project, Python 3.12, depends on `fastapi` + `uvicorn[standard]`; dev group has `pytest`, `pytest-cov`, `httpx`.
- `Dockerfile` — multi-stage build: node stage builds the Next.js static export, python stage installs deps with `uv sync` and copies the export into `static/`. Runs `uvicorn app.main:app` on port 8000.
- `tests/conftest.py` — autouse `tmp_db` fixture that redirects `DB_PATH` to a fresh temp SQLite file for every test.
- `tests/test_health.py` — health route test.
- `tests/test_auth.py` — login / logout / me / require_auth tests.
- `tests/test_board.py` — full CRUD tests for all board routes (success, 404, 401 cases).

## Running locally (without Docker)

```bash
cd backend
uv sync
DB_PATH=./dev.db OPENROUTER_API_KEY=<your_key> uv run uvicorn app.main:app --reload
```

`OPENROUTER_API_KEY` is required for the `POST /api/chat` endpoint. Without it the AI call will fail with a 401 from OpenRouter.

## Testing

```bash
cd backend
uv run pytest --cov=app --cov-report=term-missing
```

Project testing standard: minimum 80% coverage (lines/branches/functions)
on changed code, plus integration tests via FastAPI's `TestClient` for
every route.
