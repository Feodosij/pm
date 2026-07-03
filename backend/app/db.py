import os
import sqlite3
from contextlib import contextmanager
from typing import Generator

from app.constants import USERNAME

_DB_PATH = os.environ.get("DB_PATH", "/data/pm.db")

_SEED_COLUMNS = [
    {"title": "Backlog", "cards": [
        {"title": "Research competitors",  "details": "Analyze top 5 competitors and document their key features."},
        {"title": "Define MVP scope",      "details": "Work with stakeholders to finalize the feature set for v1."},
        {"title": "Design system audit",   "details": "Review existing design tokens and identify inconsistencies."},
    ]},
    {"title": "To Do", "cards": [
        {"title": "Set up CI/CD pipeline",    "details": "Configure GitHub Actions for automated testing and deployment."},
        {"title": "Write API documentation",  "details": "Document all REST endpoints using OpenAPI 3.0 spec."},
    ]},
    {"title": "In Progress", "cards": [
        {"title": "Implement auth flow",      "details": "Build login, register, and password reset screens."},
        {"title": "Database schema design",   "details": "Finalize ERD and write migration scripts."},
    ]},
    {"title": "Review", "cards": [
        {"title": "Landing page redesign",    "details": "New hero section with improved conversion copy."},
    ]},
    {"title": "Done", "cards": [
        {"title": "Project kickoff",          "details": "Initial team alignment meeting completed."},
        {"title": "Tech stack decision",      "details": "Agreed on Next.js, TypeScript, and Tailwind CSS."},
    ]},
]

_BOARD_TITLE = "My Board"


def get_db_path() -> str:
    return _DB_PATH


@contextmanager
def get_connection(db_path: str | None = None) -> Generator[sqlite3.Connection, None, None]:
    path = db_path or _DB_PATH
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db(db_path: str | None = None) -> None:
    with get_connection(db_path) as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id         INTEGER PRIMARY KEY,
                username   TEXT    UNIQUE NOT NULL,
                created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
            );
            CREATE TABLE IF NOT EXISTS boards (
                id      INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title   TEXT    NOT NULL
            );
            CREATE TABLE IF NOT EXISTS columns (
                id       INTEGER PRIMARY KEY,
                board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
                title    TEXT    NOT NULL,
                position INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS cards (
                id        INTEGER PRIMARY KEY,
                column_id INTEGER NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
                title     TEXT    NOT NULL,
                details   TEXT    NOT NULL DEFAULT '',
                position  INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_users_username  ON users(username);
            CREATE INDEX IF NOT EXISTS idx_boards_user_id  ON boards(user_id);
            CREATE INDEX IF NOT EXISTS idx_columns_board_id ON columns(board_id);
            CREATE INDEX IF NOT EXISTS idx_cards_column_id ON cards(column_id);
        """)
        _seed_if_needed(conn)


def _seed_if_needed(conn: sqlite3.Connection) -> None:
    row = conn.execute("SELECT id FROM users WHERE username = ?", (USERNAME,)).fetchone()
    if row:
        return

    conn.execute("INSERT INTO users (username) VALUES (?)", (USERNAME,))
    user_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]

    conn.execute("INSERT INTO boards (user_id, title) VALUES (?, ?)", (user_id, _BOARD_TITLE))
    board_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]

    for col_pos, col_data in enumerate(_SEED_COLUMNS):
        conn.execute(
            "INSERT INTO columns (board_id, title, position) VALUES (?, ?, ?)",
            (board_id, col_data["title"], col_pos),
        )
        col_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        for card_pos, card in enumerate(col_data["cards"]):
            conn.execute(
                "INSERT INTO cards (column_id, title, details, position) VALUES (?, ?, ?, ?)",
                (col_id, card["title"], card["details"], card_pos),
            )
