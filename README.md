# AI Kanban Board

A project management board with an AI chat assistant that can create, edit, move, and delete cards on your behalf.

**Stack:** Next.js 16 · FastAPI · SQLite · OpenRouter AI · dnd-kit · Tailwind CSS v4 · Docker

---

## Quick start (Docker — recommended)

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

### 1. Clone

```bash
git clone https://github.com/Feodosij/pm.git
cd pm
```

### 2. Add your OpenRouter API key

```bash
cp .env.example .env
```

Open `.env` and replace the placeholder:

```
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

Get a free key at [openrouter.ai](https://openrouter.ai) — no credit card required.  
The app uses the **nvidia/nemotron-3-super-120b-a12b:free** model (free tier).

### 3. Start

```bash
# macOS / Linux
./scripts/start.sh

# Windows
scripts\start.bat

# or directly:
docker compose up --build
```

Open **http://localhost:8000** in your browser.

### 4. Log in

| Field | Value |
|-------|-------|
| Username | `user` |
| Password | `password` |

### Stop

```bash
./scripts/stop.sh     # macOS / Linux
scripts\stop.bat      # Windows
# or:
docker compose down
```

---

## Development mode (without Docker)

Run the frontend and backend in separate terminals.

**Prerequisites:** Node.js 20+, Python 3.12+, [uv](https://docs.astral.sh/uv/getting-started/installation/)

### Backend

```bash
cd backend
uv sync
cp ../.env.example ../.env   # add your OpenRouter key to .env
uv run uvicorn app.main:app --reload --port 8000
```

API available at http://localhost:8000

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** — API calls are proxied to the backend on :8000 automatically.

---

## Features

- **Kanban board** with 5 columns: Backlog → To Do → In Progress → Review → Done
- **Drag & drop** cards between columns and within columns
- **AI chat sidebar** — describe what you want and the AI updates the board:
  - *"Add a card called Deploy to production in the To Do column"*
  - *"Move all Backlog cards to Done"*
  - *"Delete the card about competitors"*
- **Inline editing** — click any card to edit title and details
- **Column renaming** — double-click a column title

---

## Project structure

```
pm/
├── backend/          # FastAPI + SQLite
│   ├── app/
│   │   ├── main.py       # FastAPI app, static file serving
│   │   ├── board.py      # Board / card / column CRUD
│   │   ├── chat.py       # AI chat endpoint
│   │   ├── ai.py         # OpenRouter client
│   │   ├── auth.py       # Session auth
│   │   ├── db.py         # SQLite connection, schema, seed data
│   │   └── constants.py  # Shared constants
│   └── tests/            # pytest — 51 tests, 97% coverage
├── frontend/         # Next.js 16 + React 19
│   ├── src/
│   │   ├── components/   # Board, Column, Card, ChatSidebar, Login
│   │   └── lib/          # API client, dnd helpers, Zustand store
│   └── __tests__/        # Vitest — 77 tests
├── scripts/          # start.sh / stop.sh (Docker wrappers)
├── docker-compose.yml
└── .env.example
```

---

## Running tests

```bash
# Backend
cd backend
uv sync
uv run pytest

# Frontend
cd frontend
npm install
npm test           # Vitest unit tests
npm run test:e2e   # Playwright e2e (requires both servers running)
```

---

## Notes

- The database is created automatically on first start inside the Docker container (SQLite at `/data/pm.db`).
- Login credentials are hardcoded (`user` / `password`) — this is an intentional MVP simplification.
- The AI uses a free OpenRouter model. If the model is unavailable, the chat returns a graceful error message without breaking the board.
