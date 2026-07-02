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
