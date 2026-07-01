# Backend overview

FastAPI backend, packaged with `uv`. Currently a scaffold (Part 2 of
`docs/PLAN.md`): serves a static hello-world page and a health check.
Will grow to serve the built frontend, handle auth, the Kanban API, and
AI chat in later parts.

## File structure

- `app/main.py` — FastAPI app. `GET /` returns a static HTML hello-world page (will be replaced by the built frontend in Part 3). `GET /api/health` returns `{"status": "ok"}`
- `pyproject.toml` — `uv`-managed project, Python 3.12, depends on `fastapi` + `uvicorn[standard]`; dev group has `pytest`, `pytest-cov`, `httpx`
- `tests/test_health.py` — `TestClient`-based tests for the two routes above
- `Dockerfile` — builds the image with `uv sync`, runs `uvicorn app.main:app` on port 8000. Build context is the repo root (see root `docker-compose.yml`) so it can later also copy the frontend's static export

## Running locally (without Docker)

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

## Testing

```bash
cd backend
uv run pytest --cov=app --cov-report=term-missing
```

Project testing standard: minimum 80% coverage (lines/branches/functions)
on changed code, plus integration tests via FastAPI's `TestClient` for
every route.
