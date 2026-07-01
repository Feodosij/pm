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
        token = res.cookies["session"]
        c.cookies.set("session", token)
        yield c


# ── GET /api/board ─────────────────────────────────────────────────────────────

def test_get_board_unauthenticated(client):
    assert client.get("/api/board").status_code == 401


def test_get_board_returns_seeded_data(authed_client):
    res = authed_client.get("/api/board")
    assert res.status_code == 200
    data = res.json()
    assert "columns" in data
    assert len(data["columns"]) == 5
    titles = [c["title"] for c in data["columns"]]
    assert titles == ["Backlog", "To Do", "In Progress", "Review", "Done"]
    backlog = data["columns"][0]
    assert len(backlog["cards"]) == 3
    assert backlog["cards"][0]["title"] == "Research competitors"


# ── POST /api/board/cards ──────────────────────────────────────────────────────

def test_create_card_unauthenticated(client):
    assert client.post("/api/board/cards", json={"column_id": "1", "title": "X"}).status_code == 401


def test_create_card_success(authed_client):
    board = authed_client.get("/api/board").json()
    col_id = board["columns"][0]["id"]
    res = authed_client.post("/api/board/cards", json={"column_id": col_id, "title": "New card", "details": "desc"})
    assert res.status_code == 201
    card = res.json()
    assert card["title"] == "New card"
    assert card["details"] == "desc"
    assert "id" in card


def test_create_card_bad_column(authed_client):
    res = authed_client.post("/api/board/cards", json={"column_id": "9999", "title": "X"})
    assert res.status_code == 404


def test_create_card_appears_on_board(authed_client):
    board = authed_client.get("/api/board").json()
    col_id = board["columns"][1]["id"]
    authed_client.post("/api/board/cards", json={"column_id": col_id, "title": "Task Y"})
    board2 = authed_client.get("/api/board").json()
    titles = [c["title"] for c in board2["columns"][1]["cards"]]
    assert "Task Y" in titles


# ── PATCH /api/board/cards/{id} ────────────────────────────────────────────────

def test_patch_card_unauthenticated(client):
    assert client.patch("/api/board/cards/1", json={"title": "X"}).status_code == 401


def test_patch_card_edit_title_details(authed_client):
    board = authed_client.get("/api/board").json()
    card = board["columns"][0]["cards"][0]
    res = authed_client.patch(f"/api/board/cards/{card['id']}", json={"title": "Updated", "details": "New details"})
    assert res.status_code == 200
    assert res.json()["title"] == "Updated"
    assert res.json()["details"] == "New details"


def test_patch_card_not_found(authed_client):
    assert authed_client.patch("/api/board/cards/9999", json={"title": "X"}).status_code == 404


def test_patch_card_move_to_different_column(authed_client):
    board = authed_client.get("/api/board").json()
    src_col = board["columns"][0]
    dst_col = board["columns"][1]
    card = src_col["cards"][0]
    res = authed_client.patch(
        f"/api/board/cards/{card['id']}",
        json={"column_id": dst_col["id"], "position": 0},
    )
    assert res.status_code == 200
    board2 = authed_client.get("/api/board").json()
    dst_titles = [c["title"] for c in board2["columns"][1]["cards"]]
    src_titles = [c["title"] for c in board2["columns"][0]["cards"]]
    assert card["title"] in dst_titles
    assert card["title"] not in src_titles


def test_patch_card_move_within_column(authed_client):
    board = authed_client.get("/api/board").json()
    col = board["columns"][0]
    # Move the first card to position 2 (last among 3)
    card = col["cards"][0]
    res = authed_client.patch(
        f"/api/board/cards/{card['id']}",
        json={"column_id": col["id"], "position": 2},
    )
    assert res.status_code == 200
    board2 = authed_client.get("/api/board").json()
    cards = board2["columns"][0]["cards"]
    assert cards[2]["id"] == card["id"]


def test_patch_card_bad_dest_column(authed_client):
    board = authed_client.get("/api/board").json()
    card = board["columns"][0]["cards"][0]
    res = authed_client.patch(f"/api/board/cards/{card['id']}", json={"column_id": "9999", "position": 0})
    assert res.status_code == 404


# ── DELETE /api/board/cards/{id} ───────────────────────────────────────────────

def test_delete_card_unauthenticated(client):
    assert client.delete("/api/board/cards/1").status_code == 401


def test_delete_card_success(authed_client):
    board = authed_client.get("/api/board").json()
    card = board["columns"][0]["cards"][0]
    res = authed_client.delete(f"/api/board/cards/{card['id']}")
    assert res.status_code == 204
    board2 = authed_client.get("/api/board").json()
    ids = [c["id"] for c in board2["columns"][0]["cards"]]
    assert card["id"] not in ids


def test_delete_card_not_found(authed_client):
    assert authed_client.delete("/api/board/cards/9999").status_code == 404


# ── PATCH /api/board/columns/{id} ─────────────────────────────────────────────

def test_patch_column_unauthenticated(client):
    assert client.patch("/api/board/columns/1", json={"title": "New"}).status_code == 401


def test_patch_column_rename(authed_client):
    board = authed_client.get("/api/board").json()
    col = board["columns"][0]
    res = authed_client.patch(f"/api/board/columns/{col['id']}", json={"title": "Renamed"})
    assert res.status_code == 200
    assert res.json()["title"] == "Renamed"
    board2 = authed_client.get("/api/board").json()
    assert board2["columns"][0]["title"] == "Renamed"


def test_patch_column_not_found(authed_client):
    assert authed_client.patch("/api/board/columns/9999", json={"title": "X"}).status_code == 404
