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
    """Client with a valid session cookie already set."""
    with TestClient(app) as c:
        res = c.post("/api/login", json={"username": "user", "password": "password"})
        token = res.cookies["session"]
        c.cookies.set("session", token)
        yield c


# ── login ──────────────────────────────────────────────────────────────────────

def test_login_success(client):
    res = client.post("/api/login", json={"username": "user", "password": "password"})
    assert res.status_code == 200
    assert res.json() == {"ok": True}
    assert "session" in res.cookies


def test_login_wrong_password(client):
    res = client.post("/api/login", json={"username": "user", "password": "wrong"})
    assert res.status_code == 401


def test_login_wrong_username(client):
    res = client.post("/api/login", json={"username": "admin", "password": "password"})
    assert res.status_code == 401


# ── me ─────────────────────────────────────────────────────────────────────────

def test_me_unauthenticated(client):
    assert client.get("/api/me").json() == {"authenticated": False}


def test_me_authenticated(authed_client):
    res = authed_client.get("/api/me")
    assert res.status_code == 200
    assert res.json() == {"authenticated": True, "username": "user"}


# ── logout ─────────────────────────────────────────────────────────────────────

def test_logout_clears_session(authed_client):
    authed_client.post("/api/logout")
    assert authed_client.get("/api/me").json() == {"authenticated": False}


def test_logout_without_session_returns_ok(client):
    assert client.post("/api/logout").status_code == 200


# ── require_auth dependency ────────────────────────────────────────────────────

def test_require_auth_raises_without_session(client, authed_client):
    from fastapi import Depends, FastAPI
    from app.auth import require_auth

    tmp = FastAPI()

    @tmp.get("/protected")
    def protected(session: str = Depends(require_auth)):
        return {"ok": True}

    with TestClient(tmp) as tc:
        assert tc.get("/protected").status_code == 401

    with TestClient(tmp) as tc:
        tc.cookies.set("session", next(iter(auth._sessions)))
        assert tc.get("/protected").status_code == 200
