# Part 9: AI Structured Kanban Updates — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `POST /api/chat` that accepts a user message + conversation history, calls the AI with the current board as context, and applies the AI's optional list of card operations atomically.

**Architecture:** Prompt-based JSON — system prompt instructs the model to return `{reply, board_update}`. Pydantic validates structure; a separate referential check verifies IDs exist before any DB writes. All-or-nothing: if any operation in the batch is invalid, none are applied.

**Tech Stack:** FastAPI, Pydantic `model_validator`, Python `json` + `logging`, existing `ai.chat_completion`, existing SQLite helpers from `board.py` and `db.py`, `pytest` + `TestClient` + `unittest.mock`.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `backend/app/chat.py` | Schemas, system prompt builder, referential validator, DB apply logic, `POST /api/chat` route |
| Modify | `backend/app/main.py` | Mount chat router |
| Create | `backend/tests/test_chat.py` | All 12 test scenarios |
| Modify | `backend/AGENTS.md` | Document new endpoint |

---

## Task 1: Minimal router — 401 on unauthenticated

**Files:**
- Create: `backend/app/chat.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_chat.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_chat.py
import pytest
from fastapi.testclient import TestClient
from app import auth
from app.main import app


@pytest.fixture(autouse=True)
def clear_sessions():
    auth._sessions.clear()
    yield
    auth._sessions.clear()


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def authed_client():
    with TestClient(app) as c:
        res = c.post("/api/login", json={"username": "user", "password": "password"})
        c.cookies.set("session", res.cookies["session"])
        yield c


def test_chat_unauthenticated(client):
    res = client.post("/api/chat", json={"message": "hi", "history": []})
    assert res.status_code == 401
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && .venv/bin/pytest tests/test_chat.py::test_chat_unauthenticated -v
```
Expected: `FAILED` — `404 != 401` (route does not exist yet)

- [ ] **Step 3: Create minimal `backend/app/chat.py`**

```python
import json
import logging
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, model_validator

from app.ai import chat_completion
from app.auth import require_auth, _USERNAME
from app.board import _get_board_id, _get_user_id, _load_board, BoardOut
from app.db import get_connection

logger = logging.getLogger(__name__)
router = APIRouter()


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage]


class CardOperation(BaseModel):
    operation: Literal["create", "edit", "move", "delete"]
    card_id: str | None = None
    column_id: str | None = None
    title: str | None = None
    details: str | None = None
    position: int | None = None

    @model_validator(mode='after')
    def check_required_fields(self) -> 'CardOperation':
        if self.operation == "create" and (not self.title or not self.column_id):
            raise ValueError("create requires title and column_id")
        if self.operation in ("edit", "delete") and not self.card_id:
            raise ValueError(f"{self.operation} requires card_id")
        if self.operation == "move" and (not self.card_id or not self.column_id):
            raise ValueError("move requires card_id and column_id")
        return self


class AIResponse(BaseModel):
    reply: str
    board_update: list[CardOperation] | None = None


class ChatResponse(BaseModel):
    reply: str
    board_update: list[CardOperation] | None = None


@router.post("/api/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, _: str = Depends(require_auth)):
    return ChatResponse(reply="not implemented", board_update=None)
```

- [ ] **Step 4: Mount the router in `backend/app/main.py`**

Add these two lines (after the existing imports and before the `lifespan` definition):

```python
from app.chat import router as chat_router
```

And after `app.include_router(board_router)`:

```python
app.include_router(chat_router)
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd backend && .venv/bin/pytest tests/test_chat.py::test_chat_unauthenticated -v
```
Expected: `PASSED`

- [ ] **Step 6: Commit**

```bash
git add backend/app/chat.py backend/app/main.py backend/tests/test_chat.py
git commit -m "feat(part9): add POST /api/chat skeleton with auth guard"
```

---

## Task 2: Reply-only path + malformed JSON handling

**Files:**
- Modify: `backend/app/chat.py`
- Modify: `backend/tests/test_chat.py`

- [ ] **Step 1: Write the failing tests**

Add to `backend/tests/test_chat.py`:

```python
import json
from unittest.mock import AsyncMock, patch


def test_chat_reply_only(authed_client):
    mock_reply = json.dumps({"reply": "Sure, happy to help!", "board_update": None})
    with patch("app.chat.chat_completion", new=AsyncMock(return_value=mock_reply)):
        res = authed_client.post("/api/chat", json={"message": "hello", "history": []})
    assert res.status_code == 200
    data = res.json()
    assert data["reply"] == "Sure, happy to help!"
    assert data["board_update"] is None


def test_chat_malformed_json(authed_client, caplog):
    import logging
    with patch("app.chat.chat_completion", new=AsyncMock(return_value="not json at all")):
        with caplog.at_level(logging.WARNING, logger="app.chat"):
            res = authed_client.post("/api/chat", json={"message": "hi", "history": []})
    assert res.status_code == 200
    data = res.json()
    assert data["reply"] == "not json at all"
    assert data["board_update"] is None
    assert any("not valid JSON" in r.message for r in caplog.records)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && .venv/bin/pytest tests/test_chat.py::test_chat_reply_only tests/test_chat.py::test_chat_malformed_json -v
```
Expected: `FAILED` — endpoint always returns "not implemented"

- [ ] **Step 3: Implement `_build_system_prompt`, `_build_messages`, and the full endpoint logic in `backend/app/chat.py`**

Replace the stub `chat` function and add helpers before it:

```python
def _build_system_prompt(board: BoardOut) -> str:
    board_json = json.dumps(board.model_dump(), indent=2)
    column_ids = ", ".join(f"{col.id}={col.title!r}" for col in board.columns)
    return (
        "You are a Kanban board assistant. You can create, edit, move, or delete cards.\n"
        "You cannot rename columns — that is done by the user directly.\n\n"
        f"Current board state:\n{board_json}\n\n"
        "Respond ONLY with valid JSON in this exact format — no markdown, no code fences:\n"
        '{"reply": "<your text reply to the user>", "board_update": null}\n'
        "or, if performing one or more card operations:\n"
        '{"reply": "<your text reply>", "board_update": [{"operation": "move", "card_id": "3", "column_id": "2"}]}\n\n'
        f"Valid column IDs and names: {column_ids}\n\n"
        "Operations:\n"
        "  create → required: title, column_id | optional: details\n"
        "  edit   → required: card_id          | optional: title, details\n"
        "  move   → required: card_id, column_id | optional: position (0-based, default: append to end)\n"
        "  delete → required: card_id"
    )


def _build_messages(board: BoardOut, history: list[ChatMessage], message: str) -> list[dict]:
    return [
        {"role": "system", "content": _build_system_prompt(board)},
        *[msg.model_dump() for msg in history],
        {"role": "user", "content": message},
    ]


def _validate_ops_referential(ops: list[CardOperation], board: BoardOut) -> str | None:
    """Return an error description if any op references a non-existent id, else None."""
    card_ids = {card.id for col in board.columns for card in col.cards}
    column_ids = {col.id for col in board.columns}
    for op in ops:
        if op.card_id and op.card_id not in card_ids:
            return f"unknown card_id {op.card_id!r}"
        if op.column_id and op.column_id not in column_ids:
            return f"unknown column_id {op.column_id!r}"
    return None


def _apply_operation(conn, op: CardOperation) -> None:
    if op.operation == "create":
        col_id = int(op.column_id)
        max_pos = conn.execute(
            "SELECT COALESCE(MAX(position), -1) FROM cards WHERE column_id = ?", (col_id,)
        ).fetchone()[0]
        conn.execute(
            "INSERT INTO cards (column_id, title, details, position) VALUES (?, ?, ?, ?)",
            (col_id, op.title, op.details or "", max_pos + 1),
        )

    elif op.operation == "edit":
        card_id = int(op.card_id)
        row = conn.execute("SELECT title, details FROM cards WHERE id = ?", (card_id,)).fetchone()
        new_title = op.title if op.title is not None else row["title"]
        new_details = op.details if op.details is not None else row["details"]
        conn.execute(
            "UPDATE cards SET title = ?, details = ? WHERE id = ?",
            (new_title, new_details, card_id),
        )

    elif op.operation == "move":
        card_id = int(op.card_id)
        dest_col_id = int(op.column_id)
        row = conn.execute("SELECT column_id, position FROM cards WHERE id = ?", (card_id,)).fetchone()
        src_col_id = row["column_id"]
        old_pos = row["position"]

        if op.position is not None:
            new_pos = op.position
        elif src_col_id == dest_col_id:
            new_pos = conn.execute(
                "SELECT COALESCE(MAX(position), 0) FROM cards WHERE column_id = ?", (src_col_id,)
            ).fetchone()[0]
        else:
            new_pos = conn.execute(
                "SELECT COALESCE(MAX(position), -1) FROM cards WHERE column_id = ?", (dest_col_id,)
            ).fetchone()[0] + 1

        if src_col_id == dest_col_id:
            if old_pos < new_pos:
                conn.execute(
                    "UPDATE cards SET position = position - 1 "
                    "WHERE column_id = ? AND position > ? AND position <= ?",
                    (src_col_id, old_pos, new_pos),
                )
            elif old_pos > new_pos:
                conn.execute(
                    "UPDATE cards SET position = position + 1 "
                    "WHERE column_id = ? AND position >= ? AND position < ?",
                    (src_col_id, new_pos, old_pos),
                )
            conn.execute("UPDATE cards SET position = ? WHERE id = ?", (new_pos, card_id))
        else:
            conn.execute(
                "UPDATE cards SET position = position - 1 WHERE column_id = ? AND position > ?",
                (src_col_id, old_pos),
            )
            if op.position is not None:
                conn.execute(
                    "UPDATE cards SET position = position + 1 "
                    "WHERE column_id = ? AND position >= ?",
                    (dest_col_id, new_pos),
                )
            conn.execute(
                "UPDATE cards SET column_id = ?, position = ? WHERE id = ?",
                (dest_col_id, new_pos, card_id),
            )

    elif op.operation == "delete":
        card_id = int(op.card_id)
        row = conn.execute("SELECT column_id, position FROM cards WHERE id = ?", (card_id,)).fetchone()
        conn.execute("DELETE FROM cards WHERE id = ?", (card_id,))
        conn.execute(
            "UPDATE cards SET position = position - 1 WHERE column_id = ? AND position > ?",
            (row["column_id"], row["position"]),
        )


@router.post("/api/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, _: str = Depends(require_auth)):
    with get_connection() as conn:
        user_id = _get_user_id(conn, _USERNAME)
        board_id = _get_board_id(conn, user_id)
        board = _load_board(conn, board_id)

    messages = _build_messages(board, body.history, body.message)
    reply_text = await chat_completion(messages)

    # Step 1: parse JSON
    try:
        raw = json.loads(reply_text)
    except (json.JSONDecodeError, ValueError):
        logger.warning("AI response is not valid JSON: %s", reply_text[:200])
        return ChatResponse(reply=reply_text, board_update=None)

    # Step 2: validate schema
    try:
        ai_resp = AIResponse.model_validate(raw)
    except Exception as err:
        logger.warning("AI response failed schema validation: %s", err)
        return ChatResponse(reply=raw.get("reply", reply_text), board_update=None)

    if not ai_resp.board_update:
        return ChatResponse(reply=ai_resp.reply, board_update=None)

    # Step 3: referential validation (all-or-nothing)
    ref_err = _validate_ops_referential(ai_resp.board_update, board)
    if ref_err:
        logger.warning("board_update references unknown id: %s", ref_err)
        return ChatResponse(reply=ai_resp.reply, board_update=None)

    # Step 4: apply all operations
    try:
        with get_connection() as conn:
            for op in ai_resp.board_update:
                _apply_operation(conn, op)
    except Exception as err:
        logger.error("Failed to apply board_update: %s", err)
        return ChatResponse(reply=ai_resp.reply, board_update=None)

    return ChatResponse(reply=ai_resp.reply, board_update=ai_resp.board_update)
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd backend && .venv/bin/pytest tests/test_chat.py::test_chat_reply_only tests/test_chat.py::test_chat_malformed_json -v
```
Expected: `2 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/app/chat.py
git commit -m "feat(part9): implement chat endpoint — reply path and JSON parse error handling"
```

---

## Task 3: Schema validation error path

**Files:**
- Modify: `backend/tests/test_chat.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_chat.py`:

```python
def test_chat_invalid_schema(authed_client, caplog):
    import logging
    # create operation without required title — passes JSON parse but fails @model_validator
    bad_payload = json.dumps({"reply": "ok", "board_update": [{"operation": "create", "column_id": "1"}]})
    with patch("app.chat.chat_completion", new=AsyncMock(return_value=bad_payload)):
        with caplog.at_level(logging.WARNING, logger="app.chat"):
            res = authed_client.post("/api/chat", json={"message": "hi", "history": []})
    assert res.status_code == 200
    data = res.json()
    assert data["reply"] == "ok"
    assert data["board_update"] is None
    assert any("schema validation" in r.message for r in caplog.records)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && .venv/bin/pytest tests/test_chat.py::test_chat_invalid_schema -v
```
Expected: `FAILED`

- [ ] **Step 3: Run the test after implementation from Task 2 is in place**

The implementation in `chat.py` from Task 2 already handles this case (step 2 in the endpoint: `AIResponse.model_validate` fails because `CardOperation`'s `@model_validator` raises). No code change needed.

```bash
cd backend && .venv/bin/pytest tests/test_chat.py::test_chat_invalid_schema -v
```
Expected: `PASSED`

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_chat.py
git commit -m "test(part9): add schema validation error path test"
```

---

## Task 4: Referential validation — unknown ID

**Files:**
- Modify: `backend/tests/test_chat.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_chat.py`:

```python
def test_chat_unknown_card_id(authed_client, caplog):
    import logging
    payload = json.dumps({
        "reply": "Moving card",
        "board_update": [{"operation": "delete", "card_id": "99999"}],
    })
    with patch("app.chat.chat_completion", new=AsyncMock(return_value=payload)):
        with caplog.at_level(logging.WARNING, logger="app.chat"):
            res = authed_client.post("/api/chat", json={"message": "delete card 99999", "history": []})
    assert res.status_code == 200
    data = res.json()
    assert data["reply"] == "Moving card"
    assert data["board_update"] is None
    assert any("unknown id" in r.message for r in caplog.records)
    # Verify DB is unchanged — board still has all seeded cards
    board = authed_client.get("/api/board").json()
    total = sum(len(col["cards"]) for col in board["columns"])
    assert total == 10  # seeded board has 10 cards total (3+2+2+1+2)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && .venv/bin/pytest tests/test_chat.py::test_chat_unknown_card_id -v
```
Expected: `FAILED`

- [ ] **Step 3: Run after Task 2 implementation is in place**

No code change needed — `_validate_ops_referential` already handles this.

```bash
cd backend && .venv/bin/pytest tests/test_chat.py::test_chat_unknown_card_id -v
```
Expected: `PASSED`

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_chat.py
git commit -m "test(part9): add referential validation test for unknown card_id"
```

---

## Task 5: Valid create, edit, move, delete operations

**Files:**
- Modify: `backend/tests/test_chat.py`

- [ ] **Step 1: Write the failing tests**

Add to `backend/tests/test_chat.py`:

```python
def _get_board(authed_client):
    return authed_client.get("/api/board").json()


def test_chat_valid_create(authed_client):
    board = _get_board(authed_client)
    col_id = board["columns"][0]["id"]  # Backlog
    payload = json.dumps({
        "reply": "Created a card.",
        "board_update": [{"operation": "create", "title": "AI card", "column_id": col_id}],
    })
    with patch("app.chat.chat_completion", new=AsyncMock(return_value=payload)):
        res = authed_client.post("/api/chat", json={"message": "add a card", "history": []})
    assert res.status_code == 200
    assert res.json()["board_update"] is not None
    board2 = _get_board(authed_client)
    titles = [c["title"] for c in board2["columns"][0]["cards"]]
    assert "AI card" in titles


def test_chat_valid_edit(authed_client):
    board = _get_board(authed_client)
    card = board["columns"][0]["cards"][0]  # "Research competitors"
    payload = json.dumps({
        "reply": "Renamed the card.",
        "board_update": [{"operation": "edit", "card_id": card["id"], "title": "Renamed by AI"}],
    })
    with patch("app.chat.chat_completion", new=AsyncMock(return_value=payload)):
        res = authed_client.post("/api/chat", json={"message": "rename first card", "history": []})
    assert res.status_code == 200
    assert res.json()["board_update"] is not None
    board2 = _get_board(authed_client)
    titles = [c["title"] for c in board2["columns"][0]["cards"]]
    assert "Renamed by AI" in titles
    assert "Research competitors" not in titles


def test_chat_valid_move(authed_client):
    board = _get_board(authed_client)
    card = board["columns"][0]["cards"][0]  # first card in Backlog
    done_col = next(col for col in board["columns"] if col["title"] == "Done")
    payload = json.dumps({
        "reply": "Moved to Done.",
        "board_update": [{"operation": "move", "card_id": card["id"], "column_id": done_col["id"]}],
    })
    with patch("app.chat.chat_completion", new=AsyncMock(return_value=payload)):
        res = authed_client.post("/api/chat", json={"message": "move to done", "history": []})
    assert res.status_code == 200
    assert res.json()["board_update"] is not None
    board2 = _get_board(authed_client)
    done_cards = next(col for col in board2["columns"] if col["title"] == "Done")["cards"]
    assert any(c["id"] == card["id"] for c in done_cards)


def test_chat_valid_delete(authed_client):
    board = _get_board(authed_client)
    card = board["columns"][0]["cards"][0]
    payload = json.dumps({
        "reply": "Deleted the card.",
        "board_update": [{"operation": "delete", "card_id": card["id"]}],
    })
    with patch("app.chat.chat_completion", new=AsyncMock(return_value=payload)):
        res = authed_client.post("/api/chat", json={"message": "delete first card", "history": []})
    assert res.status_code == 200
    assert res.json()["board_update"] is not None
    board2 = _get_board(authed_client)
    all_ids = [c["id"] for col in board2["columns"] for c in col["cards"]]
    assert card["id"] not in all_ids
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && .venv/bin/pytest tests/test_chat.py::test_chat_valid_create tests/test_chat.py::test_chat_valid_edit tests/test_chat.py::test_chat_valid_move tests/test_chat.py::test_chat_valid_delete -v
```
Expected: `4 FAILED`

- [ ] **Step 3: Run after Task 2 implementation is in place**

The implementation in `chat.py` from Task 2 already includes `_apply_operation`. No code change needed.

```bash
cd backend && .venv/bin/pytest tests/test_chat.py::test_chat_valid_create tests/test_chat.py::test_chat_valid_edit tests/test_chat.py::test_chat_valid_move tests/test_chat.py::test_chat_valid_delete -v
```
Expected: `4 passed`

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_chat.py
git commit -m "test(part9): add positive tests for create/edit/move/delete operations"
```

---

## Task 6: Multi-operation batch tests

**Files:**
- Modify: `backend/tests/test_chat.py`

- [ ] **Step 1: Write the failing tests**

Add to `backend/tests/test_chat.py`:

```python
def test_chat_multi_op_all_valid(authed_client):
    board = _get_board(authed_client)
    # Move first 3 cards from Backlog to Done
    backlog = board["columns"][0]
    done_col = next(col for col in board["columns"] if col["title"] == "Done")
    cards_to_move = backlog["cards"][:3]
    ops = [
        {"operation": "move", "card_id": c["id"], "column_id": done_col["id"]}
        for c in cards_to_move
    ]
    payload = json.dumps({"reply": "Moved 3 cards to Done.", "board_update": ops})
    with patch("app.chat.chat_completion", new=AsyncMock(return_value=payload)):
        res = authed_client.post("/api/chat", json={"message": "move all backlog to done", "history": []})
    assert res.status_code == 200
    data = res.json()
    assert data["board_update"] is not None
    assert len(data["board_update"]) == 3
    board2 = _get_board(authed_client)
    done_cards = next(col for col in board2["columns"] if col["title"] == "Done")["cards"]
    done_ids = {c["id"] for c in done_cards}
    for c in cards_to_move:
        assert c["id"] in done_ids, f"card {c['id']} not in Done"


def test_chat_multi_op_one_invalid_rejects_all(authed_client):
    board = _get_board(authed_client)
    valid_card = board["columns"][0]["cards"][0]
    done_col = next(col for col in board["columns"] if col["title"] == "Done")
    ops = [
        {"operation": "move", "card_id": valid_card["id"], "column_id": done_col["id"]},
        {"operation": "delete", "card_id": "99999"},  # non-existent
    ]
    payload = json.dumps({"reply": "Mixed ops.", "board_update": ops})
    with patch("app.chat.chat_completion", new=AsyncMock(return_value=payload)):
        res = authed_client.post("/api/chat", json={"message": "mixed ops", "history": []})
    assert res.status_code == 200
    data = res.json()
    assert data["board_update"] is None  # batch rejected
    # valid card must still be in Backlog (not moved)
    board2 = _get_board(authed_client)
    backlog_ids = {c["id"] for c in board2["columns"][0]["cards"]}
    assert valid_card["id"] in backlog_ids
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && .venv/bin/pytest tests/test_chat.py::test_chat_multi_op_all_valid tests/test_chat.py::test_chat_multi_op_one_invalid_rejects_all -v
```
Expected: `2 FAILED`

- [ ] **Step 3: Run after Task 2 implementation is in place**

No code change needed.

```bash
cd backend && .venv/bin/pytest tests/test_chat.py::test_chat_multi_op_all_valid tests/test_chat.py::test_chat_multi_op_one_invalid_rejects_all -v
```
Expected: `2 passed`

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_chat.py
git commit -m "test(part9): add multi-op batch tests (all-valid and partial-invalid)"
```

---

## Task 7: Messages structure assertion test

**Files:**
- Modify: `backend/tests/test_chat.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_chat.py`:

```python
def test_chat_messages_structure(authed_client):
    """Verifies that messages are built as: [system_prompt, ...history, user_msg]."""
    mock_reply = json.dumps({"reply": "ok", "board_update": None})
    history = [
        {"role": "user", "content": "previous question"},
        {"role": "assistant", "content": "previous answer"},
    ]
    with patch("app.chat.chat_completion", new=AsyncMock(return_value=mock_reply)) as mock_fn:
        authed_client.post("/api/chat", json={"message": "new question", "history": history})

    call_args = mock_fn.call_args
    messages = call_args[0][0]  # first positional arg

    assert messages[0]["role"] == "system"
    # System prompt should contain the board JSON (at minimum the word "columns")
    assert "columns" in messages[0]["content"]
    # History comes next
    assert messages[1] == {"role": "user", "content": "previous question"}
    assert messages[2] == {"role": "assistant", "content": "previous answer"}
    # Last message is the new user message
    assert messages[-1] == {"role": "user", "content": "new question"}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && .venv/bin/pytest tests/test_chat.py::test_chat_messages_structure -v
```
Expected: `FAILED` — function not yet implemented

- [ ] **Step 3: Run after Task 2 implementation is in place**

No code change needed — `_build_messages` in `chat.py` produces exactly this structure.

```bash
cd backend && .venv/bin/pytest tests/test_chat.py::test_chat_messages_structure -v
```
Expected: `PASSED`

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_chat.py
git commit -m "test(part9): add messages structure assertion test"
```

---

## Task 8: Full test suite — verify all tests pass at ≥80% coverage

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

```bash
cd backend && .venv/bin/pytest --cov=app --cov-report=term-missing -v
```

Expected: all tests pass, coverage ≥80% for `app/chat.py`.

If any test fails, fix the failing test before proceeding.

- [ ] **Step 2: Check `app/chat.py` coverage specifically**

The missing lines in the coverage report should be limited to:
- The `logger.error` branch in the DB apply exception handler (hard to trigger without DB corruption)

If coverage for `app/chat.py` is below 80%, add a test for the uncovered branch.

---

## Task 9: Update `backend/AGENTS.md` and `docs/PLAN.md`

**Files:**
- Modify: `backend/AGENTS.md`
- Modify: `docs/PLAN.md`

- [ ] **Step 1: Add the chat endpoint to `backend/AGENTS.md`**

In the `## File structure` section, add a new bullet after the `app/board.py` entry:

```markdown
- `app/chat.py` — AI chat route and supporting logic:
  - `POST /api/chat` — body: `{message: str, history: [{role, content}]}`. Loads current board, builds a system prompt (board JSON + instructions), calls OpenRouter, parses `{reply, board_update}` from the response. `board_update` is a list of card operations (create/edit/move/delete). All operations are validated referentially (card_id and column_id must exist) before any DB write; if any fail the entire batch is rejected. Returns `{reply, board_update}`. Requires auth.
  - `CardOperation` — Pydantic model with `@model_validator` enforcing per-operation required fields.
  - `_build_messages(board, history, message)` — assembles `[system, ...history, user]` message list.
  - `_validate_ops_referential(ops, board)` — checks all IDs exist; returns error string or None.
  - `_apply_operation(conn, op)` — applies a single CardOperation to the DB.
```

Also update the `## Running locally` section to note `OPENROUTER_API_KEY` is required for the chat endpoint.

- [ ] **Step 2: Mark Part 9 complete in `docs/PLAN.md`**

Change all `- [ ]` to `- [x]` under `## Part 9` and add an implementation notes section similar to Part 8.

- [ ] **Step 3: Commit everything**

```bash
git add backend/app/chat.py backend/app/main.py backend/tests/test_chat.py backend/AGENTS.md docs/PLAN.md
git commit -m "feat(part9): AI structured Kanban updates via POST /api/chat"
```
