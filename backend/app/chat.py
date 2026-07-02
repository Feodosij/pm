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
