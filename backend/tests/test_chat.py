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
