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


def test_chat_openrouter_unavailable_returns_200_with_error_reply(authed_client):
    """When chat_completion raises RuntimeError (timeout/auth/connection),
    the endpoint must return 200 with a graceful error reply, not 500."""
    with patch("app.chat.chat_completion", new=AsyncMock(side_effect=RuntimeError("OpenRouter timed out"))):
        res = authed_client.post("/api/chat", json={"message": "hi", "history": []})
    assert res.status_code == 200
    data = res.json()
    assert "unavailable" in data["reply"].lower() or "timed out" in data["reply"].lower()
    assert data["board_update"] is None


def test_chat_openrouter_error_leaves_board_unchanged(authed_client):
    """Board must not be touched when the AI call itself fails."""
    board_before = authed_client.get("/api/board").json()
    total_before = sum(len(col["cards"]) for col in board_before["columns"])

    with patch("app.chat.chat_completion", new=AsyncMock(side_effect=RuntimeError("auth failed"))):
        authed_client.post("/api/chat", json={"message": "delete everything", "history": []})

    board_after = authed_client.get("/api/board").json()
    total_after = sum(len(col["cards"]) for col in board_after["columns"])
    assert total_after == total_before


def test_chat_intra_column_reorder_shift_down(authed_client):
    """AI can move first card to last position within same column (shift-down reorder)."""
    board = _get_board(authed_client)
    backlog = board["columns"][0]          # 3 cards: positions 0, 1, 2
    first_card  = backlog["cards"][0]
    second_card = backlog["cards"][1]
    last_pos = len(backlog["cards"]) - 1   # 2
    payload = json.dumps({
        "reply": "Reordered.",
        "board_update": [{"operation": "move", "card_id": first_card["id"],
                          "column_id": backlog["id"], "position": last_pos}],
    })
    with patch("app.chat.chat_completion", new=AsyncMock(return_value=payload)):
        res = authed_client.post("/api/chat", json={"message": "move to last", "history": []})
    assert res.status_code == 200
    assert res.json()["board_update"] is not None
    updated = _get_board(authed_client)["columns"][0]["cards"]
    assert updated[-1]["id"] == first_card["id"],  "first card should now be last"
    assert updated[0]["id"]  == second_card["id"], "second card should now be first"


def test_chat_intra_column_reorder_shift_up(authed_client):
    """AI can move last card to first position within same column (shift-up reorder)."""
    board = _get_board(authed_client)
    backlog = board["columns"][0]          # 3 cards: positions 0, 1, 2
    last_card   = backlog["cards"][-1]
    second_card = backlog["cards"][1]
    payload = json.dumps({
        "reply": "Reordered.",
        "board_update": [{"operation": "move", "card_id": last_card["id"],
                          "column_id": backlog["id"], "position": 0}],
    })
    with patch("app.chat.chat_completion", new=AsyncMock(return_value=payload)):
        res = authed_client.post("/api/chat", json={"message": "move to first", "history": []})
    assert res.status_code == 200
    assert res.json()["board_update"] is not None
    updated = _get_board(authed_client)["columns"][0]["cards"]
    assert updated[0]["id"]  == last_card["id"],   "last card should now be first"
    assert updated[-1]["id"] == second_card["id"], "middle card should now be last"


def test_chat_same_column_move_without_position_appends_to_end(authed_client):
    """AI move to same column with no position appends card to end (MAX position)."""
    board = _get_board(authed_client)
    backlog = board["columns"][0]          # 3 cards: positions 0, 1, 2
    first_card = backlog["cards"][0]
    payload = json.dumps({
        "reply": "Moved.",
        "board_update": [{"operation": "move", "card_id": first_card["id"],
                          "column_id": backlog["id"]}],  # no position
    })
    with patch("app.chat.chat_completion", new=AsyncMock(return_value=payload)):
        res = authed_client.post("/api/chat", json={"message": "move", "history": []})
    assert res.status_code == 200
    assert res.json()["board_update"] is not None
    updated = _get_board(authed_client)["columns"][0]["cards"]
    assert updated[-1]["id"] == first_card["id"], "card should be last after no-position same-col move"


def test_chat_cross_column_move_with_explicit_position(authed_client):
    """AI move to different column with position=0 inserts at head, shifting existing cards."""
    board = _get_board(authed_client)
    backlog = board["columns"][0]          # 3 cards
    todo    = board["columns"][1]          # 2 cards
    card    = backlog["cards"][0]
    orig_todo_first = todo["cards"][0]
    payload = json.dumps({
        "reply": "Inserted at head.",
        "board_update": [{"operation": "move", "card_id": card["id"],
                          "column_id": todo["id"], "position": 0}],
    })
    with patch("app.chat.chat_completion", new=AsyncMock(return_value=payload)):
        res = authed_client.post("/api/chat", json={"message": "move", "history": []})
    assert res.status_code == 200
    assert res.json()["board_update"] is not None
    board2     = _get_board(authed_client)
    todo_cards = next(c for c in board2["columns"] if c["id"] == todo["id"])["cards"]
    assert todo_cards[0]["id"] == card["id"],            "moved card should be first"
    assert todo_cards[1]["id"] == orig_todo_first["id"], "original first shifted to second"
    assert len(todo_cards) == len(todo["cards"]) + 1


def test_chat_db_error_during_apply_returns_graceful_response(authed_client, caplog):
    """DB error during _apply_operation must return 200 with board_update=None and log error."""
    import logging
    board = _get_board(authed_client)
    card  = board["columns"][0]["cards"][0]
    payload = json.dumps({
        "reply": "Moving card.",
        "board_update": [{"operation": "move", "card_id": card["id"],
                          "column_id": board["columns"][1]["id"]}],
    })
    with patch("app.chat.chat_completion", new=AsyncMock(return_value=payload)), \
         patch("app.chat._apply_operation", side_effect=Exception("DB connection failed")):
        with caplog.at_level(logging.ERROR, logger="app.chat"):
            res = authed_client.post("/api/chat", json={"message": "move", "history": []})
    assert res.status_code == 200
    data = res.json()
    assert data["reply"] == "Moving card."
    assert data["board_update"] is None
    assert any("Failed to apply" in r.message for r in caplog.records)
    board2    = _get_board(authed_client)
    backlog   = next(c for c in board2["columns"] if c["id"] == board["columns"][0]["id"])
    backlog_ids = {c["id"] for c in backlog["cards"]}
    assert card["id"] in backlog_ids, "card must remain in source column after DB error"


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
