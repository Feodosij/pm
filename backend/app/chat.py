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
