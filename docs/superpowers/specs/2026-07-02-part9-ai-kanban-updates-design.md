# Part 9: AI Structured Kanban Updates — Design Spec

## Overview

Extend the backend with a `POST /api/chat` endpoint. The AI receives the current board state and conversation history, then replies with a text message and an optional list of card operations to apply. Operations are validated and applied atomically (all-or-nothing) before the response is returned.

---

## Scope

**AI can:** create, edit, move, delete cards (one or more per response).

**AI cannot:** rename columns — this remains a user-only action via the UI.

---

## Architecture

New file: `backend/app/chat.py` with a FastAPI router, mounted in `main.py`.

### Request / Response flow

```
POST /api/chat  (requires auth)
  │
  ├─ 1. Load current board from DB
  ├─ 2. Build messages list:
  │        [system_prompt(board_json)] + history + [user_message]
  ├─ 3. ai.chat_completion(messages)  →  reply_text
  │
  ├─ 4. json.loads(reply_text)
  │        fail → log warning, return {reply: reply_text, board_update: null}
  │
  ├─ 5. AIResponse.model_validate(raw)
  │        fail → log warning, return {reply: reply_text, board_update: null}
  │
  ├─ 6. Validate all operations referentially (loop, all-or-nothing):
  │        card_id / column_id must exist in the board loaded at step 1
  │        (structural validation already completed at step 5 via @model_validator)
  │        any fail → log warning, return {reply, board_update: null}
  │
  ├─ 7. Apply all operations via existing DB layer (in order)
  └─ 8. Return {reply, board_update}
```

On steps 4–6, `reply_text` is always returned — the user sees the assistant's message regardless of whether the board update succeeded.

---

## Pydantic Schemas

```python
class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage]

class CardOperation(BaseModel):
    operation: Literal["create", "edit", "move", "delete"]
    card_id: str | None = None    # edit / move / delete
    column_id: str | None = None  # create / move
    title: str | None = None      # create (required) / edit
    details: str | None = None    # create / edit
    position: int | None = None   # move (optional; if omitted, card is appended to end of target column)

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
```

**Validation split:**
- Structural (missing required fields per operation) → `@model_validator` in `CardOperation` — fails at step 5
- Referential (card_id / column_id must exist on the board) → explicit loop in `chat.py` at step 6

---

## System Prompt

Built dynamically on each request. Structure:

```
You are a Kanban board assistant. You can create, edit, move, or delete cards.
You cannot rename columns — that is done by the user directly.

Current board state:
{board_json}

Respond ONLY with valid JSON in this exact format — no markdown, no code fences:
{
  "reply": "<your text reply to the user>",
  "board_update": null
}
or, if performing one or more card operations:
{
  "reply": "<your text reply>",
  "board_update": [
    {"operation": "move", "card_id": "3", "column_id": "2"}
  ]
}

Valid column IDs and names: {column_ids_with_names}

Operations:
  create  → required: title, column_id  |  optional: details
  edit    → required: card_id           |  optional: title, details
  move    → required: card_id, column_id|  optional: position (0-based)
  delete  → required: card_id
```

---

## Logging

Use Python's standard `logging` module (`logger = logging.getLogger(__name__)`).

| Event | Level | Message |
|---|---|---|
| JSON parse failure | WARNING | `"AI response is not valid JSON: {reply_text[:200]}"` |
| Pydantic validation failure | WARNING | `"AI response failed schema validation: {err}"` |
| Referential validation failure | WARNING | `"board_update references unknown id: {detail}"` |
| DB apply failure | ERROR | `"Failed to apply board_update op {op}: {err}"` |

---

## Test Matrix (`backend/tests/test_chat.py`)

All tests mock `ai.chat_completion`. DB is real (existing `tmp_db` autouse fixture).

| # | Scenario | Asserts |
|---|---|---|
| 1 | Reply-only (`board_update: null`) | response has reply, `board_update` is null, DB unchanged |
| 2 | Malformed JSON from AI | warning logged, returns raw text as reply, `board_update: null` |
| 3 | Invalid structure (`create` without `title`) | Pydantic `@model_validator` rejects, warning logged |
| 4 | Unknown `card_id` in operation | referential validation fails, warning logged, DB unchanged |
| 5 | Valid `create` | card appears in DB |
| 6 | Valid `edit` | card title/details updated in DB |
| 7 | Valid `move` | card appears in target column in DB |
| 8 | Valid `delete` | card removed from DB |
| 9 | Multi-op: all valid (e.g. move 3 cards to Done) | all 3 cards moved, full `board_update` returned |
| 10 | Multi-op: one invalid (unknown id) | entire batch rejected, DB unchanged |
| 11 | Unauthenticated request | 401 |
| 12 | `messages` structure check | `call_args` asserts: first msg is system prompt containing board JSON, history in the middle, last msg is user message |

---

## Integration with Existing Code

- DB layer: reuse `create_card`, `edit_card`, `move_card`, `delete_card` from `board.py` / `db.py` (Part 6)
- Auth: same `require_auth` dependency as board routes
- `ai.chat_completion`: same function from Part 8, no changes needed. History `ChatMessage` objects are serialized to dicts (`msg.model_dump()`) before being inserted into the messages list.
- Board loaded once at step 1 is reused for both the system prompt (step 2) and referential validation (step 6) — no second DB call needed.
- `main.py`: `app.include_router(chat_router)`
- `backend/AGENTS.md`: document the new endpoint

---

## Out of Scope

- Rename columns via AI
- Streaming responses
- Retry on malformed JSON (logged and dropped)
- Partial application of a batch (all-or-nothing only)
