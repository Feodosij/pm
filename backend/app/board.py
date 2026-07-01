from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import require_auth
from app.db import get_connection, get_db_path

router = APIRouter()


# ── Pydantic models ────────────────────────────────────────────────────────────

class CardOut(BaseModel):
    id: str
    title: str
    details: str


class ColumnOut(BaseModel):
    id: str
    title: str
    cards: list[CardOut]


class BoardOut(BaseModel):
    id: str
    title: str
    columns: list[ColumnOut]


class CreateCardBody(BaseModel):
    column_id: str
    title: str
    details: str = ""


class PatchCardBody(BaseModel):
    title: Optional[str] = None
    details: Optional[str] = None
    column_id: Optional[str] = None
    position: Optional[int] = None


class PatchColumnBody(BaseModel):
    title: str


# ── helpers ────────────────────────────────────────────────────────────────────

def _get_user_id(conn, username: str) -> int:
    row = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="User not found")
    return row["id"]


def _get_board_id(conn, user_id: int) -> int:
    row = conn.execute("SELECT id FROM boards WHERE user_id = ?", (user_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Board not found")
    return row["id"]


def _load_board(conn, board_id: int) -> BoardOut:
    board_row = conn.execute("SELECT id, title FROM boards WHERE id = ?", (board_id,)).fetchone()
    cols = conn.execute(
        "SELECT id, title FROM columns WHERE board_id = ? ORDER BY position",
        (board_id,),
    ).fetchall()
    columns_out = []
    for col in cols:
        cards = conn.execute(
            "SELECT id, title, details FROM cards WHERE column_id = ? ORDER BY position",
            (col["id"],),
        ).fetchall()
        columns_out.append(ColumnOut(
            id=str(col["id"]),
            title=col["title"],
            cards=[CardOut(id=str(c["id"]), title=c["title"], details=c["details"]) for c in cards],
        ))
    return BoardOut(id=str(board_row["id"]), title=board_row["title"], columns=columns_out)


# ── routes ─────────────────────────────────────────────────────────────────────

@router.get("/api/board", response_model=BoardOut)
def get_board(session: str = Depends(require_auth)):
    from app.auth import _USERNAME
    with get_connection() as conn:
        user_id = _get_user_id(conn, _USERNAME)
        board_id = _get_board_id(conn, user_id)
        return _load_board(conn, board_id)


@router.post("/api/board/cards", response_model=CardOut, status_code=201)
def create_card(body: CreateCardBody, session: str = Depends(require_auth)):
    from app.auth import _USERNAME
    with get_connection() as conn:
        user_id = _get_user_id(conn, _USERNAME)
        board_id = _get_board_id(conn, user_id)
        col_id = int(body.column_id)
        col = conn.execute(
            "SELECT id FROM columns WHERE id = ? AND board_id = ?", (col_id, board_id)
        ).fetchone()
        if not col:
            raise HTTPException(status_code=404, detail="Column not found")
        max_pos = conn.execute(
            "SELECT COALESCE(MAX(position), -1) FROM cards WHERE column_id = ?", (col_id,)
        ).fetchone()[0]
        conn.execute(
            "INSERT INTO cards (column_id, title, details, position) VALUES (?, ?, ?, ?)",
            (col_id, body.title, body.details, max_pos + 1),
        )
        card_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        return CardOut(id=str(card_id), title=body.title, details=body.details)


@router.patch("/api/board/cards/{card_id}", response_model=CardOut)
def patch_card(card_id: str, body: PatchCardBody, session: str = Depends(require_auth)):
    from app.auth import _USERNAME
    with get_connection() as conn:
        user_id = _get_user_id(conn, _USERNAME)
        board_id = _get_board_id(conn, user_id)

        row = conn.execute(
            """SELECT c.id, c.title, c.details, c.column_id, c.position
               FROM cards c
               JOIN columns col ON col.id = c.column_id
               WHERE c.id = ? AND col.board_id = ?""",
            (int(card_id), board_id),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Card not found")

        new_title = body.title if body.title is not None else row["title"]
        new_details = body.details if body.details is not None else row["details"]

        if body.column_id is not None or body.position is not None:
            # Move operation
            dest_col_id = int(body.column_id) if body.column_id is not None else row["column_id"]
            dest_col = conn.execute(
                "SELECT id FROM columns WHERE id = ? AND board_id = ?", (dest_col_id, board_id)
            ).fetchone()
            if not dest_col:
                raise HTTPException(status_code=404, detail="Destination column not found")

            src_col_id = row["column_id"]
            old_pos = row["position"]
            new_pos = body.position if body.position is not None else 0

            if src_col_id == dest_col_id:
                # Reorder within same column
                if old_pos < new_pos:
                    conn.execute(
                        "UPDATE cards SET position = position - 1 WHERE column_id = ? AND position > ? AND position <= ?",
                        (src_col_id, old_pos, new_pos),
                    )
                elif old_pos > new_pos:
                    conn.execute(
                        "UPDATE cards SET position = position + 1 WHERE column_id = ? AND position >= ? AND position < ?",
                        (src_col_id, new_pos, old_pos),
                    )
                conn.execute("UPDATE cards SET position = ?, title = ?, details = ? WHERE id = ?",
                             (new_pos, new_title, new_details, int(card_id)))
            else:
                # Move to different column: close gap in source, open slot in dest
                conn.execute(
                    "UPDATE cards SET position = position - 1 WHERE column_id = ? AND position > ?",
                    (src_col_id, old_pos),
                )
                conn.execute(
                    "UPDATE cards SET position = position + 1 WHERE column_id = ? AND position >= ?",
                    (dest_col_id, new_pos),
                )
                conn.execute(
                    "UPDATE cards SET column_id = ?, position = ?, title = ?, details = ? WHERE id = ?",
                    (dest_col_id, new_pos, new_title, new_details, int(card_id)),
                )
        else:
            conn.execute(
                "UPDATE cards SET title = ?, details = ? WHERE id = ?",
                (new_title, new_details, int(card_id)),
            )

        return CardOut(id=card_id, title=new_title, details=new_details)


@router.delete("/api/board/cards/{card_id}", status_code=204)
def delete_card(card_id: str, session: str = Depends(require_auth)):
    from app.auth import _USERNAME
    with get_connection() as conn:
        user_id = _get_user_id(conn, _USERNAME)
        board_id = _get_board_id(conn, user_id)

        row = conn.execute(
            """SELECT c.id, c.column_id, c.position
               FROM cards c
               JOIN columns col ON col.id = c.column_id
               WHERE c.id = ? AND col.board_id = ?""",
            (int(card_id), board_id),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Card not found")

        conn.execute("DELETE FROM cards WHERE id = ?", (int(card_id),))
        conn.execute(
            "UPDATE cards SET position = position - 1 WHERE column_id = ? AND position > ?",
            (row["column_id"], row["position"]),
        )


@router.patch("/api/board/columns/{column_id}", response_model=ColumnOut)
def patch_column(column_id: str, body: PatchColumnBody, session: str = Depends(require_auth)):
    from app.auth import _USERNAME
    with get_connection() as conn:
        user_id = _get_user_id(conn, _USERNAME)
        board_id = _get_board_id(conn, user_id)

        row = conn.execute(
            "SELECT id, title FROM columns WHERE id = ? AND board_id = ?",
            (int(column_id), board_id),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Column not found")

        conn.execute("UPDATE columns SET title = ? WHERE id = ?", (body.title, int(column_id)))
        cards = conn.execute(
            "SELECT id, title, details FROM cards WHERE column_id = ? ORDER BY position",
            (int(column_id),),
        ).fetchall()
        return ColumnOut(
            id=column_id,
            title=body.title,
            cards=[CardOut(id=str(c["id"]), title=c["title"], details=c["details"]) for c in cards],
        )
