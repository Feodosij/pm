# High level steps for project

Status legend: `[ ]` not started, `[x]` done.

Project-wide testing standard (applies to every part below): minimum 80%
unit test coverage (lines/branches/functions) for any code touched, plus
reliable integration tests — Playwright e2e for frontend user flows,
FastAPI `TestClient`-based tests for backend API flows. "Tests" sections
below list the specific tests for that part; the 80% bar is the floor on
top of them.

---

## Part 1: Plan

**Goal:** Turn the one-paragraph-per-part outline into an actionable,
checkable plan, and document the existing frontend so future work doesn't
have to rediscover it by reading every file.

Checklist:
- [x] Enrich this document with substeps, tests and success criteria for Parts 1-10
- [x] Create `frontend/AGENTS.md` describing the existing frontend code
- [x] Define the project-wide testing standard (80% coverage + integration tests)
- [ ] User reviews and approves this plan

Tests: none (documentation only).

Success criteria: user has read this document and `frontend/AGENTS.md` and
approved them (or requested changes).

---

## Part 2: Scaffolding

**Goal:** Docker infrastructure, a FastAPI backend skeleton, and start/stop
scripts. Serves a static "hello world" page and one API call, running
locally via the scripts.

Checklist:
- [x] `backend/pyproject.toml` set up for `uv`, depending on `fastapi` and `uvicorn`
- [x] `backend/app/main.py`: FastAPI app with `GET /` returning a static hello-world HTML page and `GET /api/health` returning `{"status": "ok"}`
- [x] `backend/Dockerfile`: installs deps with `uv`, runs the app with `uvicorn`
- [x] Root `docker-compose.yml` (or equivalent) building the backend image and exposing a single port
- [x] `scripts/start.sh` (Mac/Linux) and `scripts/start.bat` (Windows): build + run the container
- [x] `scripts/stop.sh` and `scripts/stop.bat`: stop + remove the container
- [x] `backend/AGENTS.md` updated to describe the FastAPI app layout
- [x] `scripts/AGENTS.md` updated to describe each script

Tests:
- `backend/tests/test_health.py` using FastAPI `TestClient`: `GET /api/health` returns 200 and `{"status": "ok"}`
- Manual: `scripts/start.sh`, then `curl localhost:<port>/` returns the hello-world HTML and `curl localhost:<port>/api/health` returns the health JSON
- Manual: `scripts/stop.sh` actually stops the container (verify with `docker ps`)

Success criteria:
- `scripts/start.*` builds and runs the container with one command, `scripts/stop.*` cleanly tears it down
- `pytest backend/tests` passes with >=80% coverage of the code written in this part

---

## Part 3: Add in Frontend

**Goal:** Statically build the Next.js frontend and serve it from FastAPI
at `/`, so the existing demo Kanban board is reachable through the backend
container. Comprehensive unit and integration tests.

Checklist:
- [x] `frontend/next.config.ts`: set `output: 'export'`
- [x] Multi-stage `backend/Dockerfile`: node stage runs `npm run build` (static export), python stage copies the exported `out/` into the image
- [x] `backend/app/main.py`: mount the exported static directory at `/` via `StaticFiles`
- [x] Confirm no server-only Next.js features are relied on (e.g. `next/image` optimization, server actions) since this is a static export
- [x] Verify existing frontend unit tests (`__tests__/`) still pass and cover the components at >=80%
- [x] Verify/extend the Playwright e2e suite (`playwright/kanban.spec.ts`) to run against the production build, not just `next dev`

Tests:
- `npm run test` (vitest, with coverage) for `Board`, `Column`, `Card`, `AddCardForm`, `store`
- Playwright e2e against the built static site served by FastAPI: add a card, drag a card between columns, rename a column, delete a card
- Manual: `scripts/start.sh`, open `http://localhost:<port>/`, confirm the Kanban board renders and is fully interactive

Success criteria:
- `npm run build` produces a static export with no broken server-only features
- FastAPI serves the exported site correctly at `/` (HTML, JS, CSS, fonts all load)
- Unit tests pass at >=80% coverage; Playwright e2e suite passes against the dockerized build

---

## Part 4: Fake user sign-in

**Goal:** Require login (hardcoded `user` / `password`) before the Kanban
board is visible, with a working logout.

Checklist:
- [x] `POST /api/login`: validates `{username, password}` against the hardcoded credentials; on success sets an httpOnly session cookie
- [x] `POST /api/logout`: clears the session cookie
- [x] `GET /api/me`: returns current auth state (used by the frontend to decide whether to show login or board)
- [x] FastAPI dependency that protects board/chat routes (added in later parts) and returns 401 when unauthenticated
- [x] Frontend `Login` component/page: username/password form, calls `/api/login`, shows an error on bad credentials
- [x] Frontend: on load, call `/api/me`; show `Login` if unauthenticated, otherwise show the board
- [x] Frontend: logout control that calls `/api/logout` and returns to the login screen
- [x] `frontend/AGENTS.md` and `backend/AGENTS.md` updated with the auth flow

Tests:
- Backend pytest: `/api/login` success and failure (wrong username/password), `/api/logout`, a protected route returns 401 without a session and 200 with one
- Frontend vitest: `Login` component renders, submits, shows error on 401; routing logic shows login vs. board based on `/api/me`
- Playwright e2e: full flow — visit `/` unauthenticated, get the login screen, log in with `user`/`password`, see the board, log out, confirm redirected to login

Success criteria:
- Unauthenticated visitors never see the Kanban board
- Correct credentials grant access; incorrect credentials show an error and grant nothing
- Logout reliably clears the session
- All new tests pass at >=80% coverage, e2e flow green

---

## Part 5: Database modeling

**Goal:** Propose and document a SQLite schema for users, board, columns
and cards. Get explicit user sign-off before any backend DB code is written.

Checklist:
- [ ] Propose tables/columns/types/foreign keys/indices covering: `users`, `boards` (one per user for MVP), `columns`, `cards`
- [ ] Save the schema as `docs/db-schema.json`
- [ ] Write `docs/DATABASE.md`: SQLite file location, "create DB on first run if missing" strategy, rationale for the design
- [ ] Present the schema to the user and get explicit approval

Tests: validate `docs/db-schema.json` is well-formed JSON (e.g. `python -c "import json; json.load(open('docs/db-schema.json'))"`).

Success criteria:
- `docs/db-schema.json` and `docs/DATABASE.md` exist and are internally consistent
- User has explicitly approved the schema before Part 6 starts

---

## Part 6: Backend (DB-backed API)

**Goal:** API routes to read and change the logged-in user's Kanban board,
backed by the SQLite schema from Part 5. DB is created automatically if
missing. Thorough backend unit tests.

Checklist:
- [ ] DB layer creates tables on startup from the Part 5 schema if the SQLite file doesn't exist
- [ ] Seed a default board (matching the current demo columns/cards) for the hardcoded user on first run
- [ ] `GET /api/board`: returns the current user's board as JSON
- [ ] `POST /api/board/cards`: create a card
- [ ] `PATCH /api/board/cards/{id}`: edit a card's title/details, or move it (column + position)
- [ ] `DELETE /api/board/cards/{id}`: delete a card
- [ ] `PATCH /api/board/columns/{id}`: rename a column
- [ ] All board routes require a valid session (Part 4)
- [ ] `backend/AGENTS.md` documents each route

Tests:
- pytest per route: success case, not-found case (bad card/column id -> 404), unauthenticated case (-> 401)
- Each test runs against a fresh temp SQLite file/dir, no shared state between tests
- Coverage >=80% for `backend/app`

Success criteria:
- First run on a clean checkout auto-creates the DB with the seeded board
- All CRUD routes work and are covered by passing tests at >=80% coverage
- Manual check: add a card, restart the container, the card is still there

---

## Part 7: Frontend + Backend integration

**Goal:** Replace the in-memory `useReducer` store with real API calls so
the board persists. Test thoroughly.

Checklist:
- [ ] Replace `frontend/src/lib/store.ts`'s in-memory reducer with API-backed hooks: fetch `GET /api/board` on load, call the Part 6 endpoints on add/move/edit/delete/rename
- [ ] Add loading and error states to `Board`
- [ ] Retire `frontend/src/lib/data.ts` demo seed data (no longer needed once the backend seeds it)
- [ ] Update unit tests to mock the fetch/API layer; keep any pure-logic tests that still apply
- [ ] Extend Playwright e2e to run against the full dockerized stack: log in, add/move/delete a card, reload the page, confirm the change persisted

Tests:
- vitest: API hook layer with mocked fetch, success and error responses
- Playwright e2e against the running container, including a reload-and-verify-persistence step
- Coverage >=80%

Success criteria:
- Board actions persist to SQLite and survive a page reload and a container restart
- All unit + e2e tests pass at >=80% coverage
- No production code path still uses the static in-memory demo data

---

## Part 8: AI connectivity

**Goal:** Backend can call OpenRouter. Verify connectivity with a simple
"2+2" sanity check.

Checklist:
- [ ] OpenRouter client config in the backend: API key from `.env` (`OPENROUTER_API_KEY`), base URL `https://openrouter.ai/api/v1`
- [ ] Pick and document the free model to use, replacing the `some free` placeholder in `AGENTS.md`
- [ ] `backend/app/ai.py` (or similar): function to call the chat completions endpoint
- [ ] Diagnostic test asking "What is 2+2?" and asserting the reply contains "4"
- [ ] Clean error handling for auth failures/timeouts from OpenRouter

Tests:
- pytest with the OpenRouter HTTP call mocked, so the suite stays network-free in CI
- One live integration test gated behind an env flag (e.g. `RUN_LIVE_AI_TESTS=1`) for manual verification of real connectivity

Success criteria:
- A live call to OpenRouter answers "What is 2+2?" correctly, confirming the API key and model work end-to-end
- The mocked unit test passes without network access
- The chosen model is documented in `AGENTS.md`

---

## Part 9: AI structured Kanban updates

**Goal:** Extend the AI call to receive the full board JSON plus the
user's question and conversation history, and respond with Structured
Outputs containing a reply and an optional board update.

Checklist:
- [ ] Pydantic response schema, e.g. `AIResponse{ reply: str, board_update: Optional[BoardUpdate] }`
- [ ] Build the request: serialized current board JSON + user message + prior turns
- [ ] Use OpenRouter Structured Outputs (JSON-schema `response_format`) to constrain the model's output to that schema
- [ ] `POST /api/chat`: accepts `{message, history}`, returns `{reply, board_update}`; if `board_update` is present, apply it via the Part 6 CRUD logic before responding
- [ ] Validate any AI-proposed update (referenced column/card ids must exist) before applying; reject invalid updates without touching the DB

Tests:
- pytest with mocked OpenRouter responses: (a) reply-only, (b) reply + valid update applied correctly, (c) reply + invalid update rejected, DB unchanged
- Coverage >=80%

Success criteria:
- A request like "Move 'Research competitors' to Done" returns a reply and the DB reflects the change
- Malformed/invalid AI output never corrupts the stored board (covered by a test)

---

## Part 10: AI chat sidebar UI

**Goal:** A chat sidebar in the frontend for full AI chat, applying
Kanban updates returned by the AI, with the board refreshing automatically.

Checklist:
- [ ] `ChatSidebar` component: message list, input box, send button, styled per the color scheme
- [ ] Wire it to `POST /api/chat`, keeping conversation history in component state
- [ ] On a response with `board_update`, refetch the board (reuse Part 7's loading logic) so the Kanban view updates automatically
- [ ] Loading and error states for the chat call
- [ ] Toggle to show/hide the sidebar

Tests:
- vitest: `ChatSidebar` renders messages, sends on submit, triggers a board refresh when `board_update` is present, shows an error state on a failed call (mocked fetch)
- Playwright e2e: send a chat message instructing a card move, confirm the board updates without a manual reload
- Coverage >=80%

Success criteria:
- User can chat with the AI in the sidebar and get replies
- When the AI updates the board, the Kanban view refreshes automatically
- All unit + e2e tests pass at >=80% coverage; the full login -> chat -> board-update flow is verified manually in Docker
