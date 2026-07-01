import pytest
from fastapi.testclient import TestClient

from app import auth
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_sessions():
    auth._sessions.clear()
    yield
    auth._sessions.clear()


# ── login ──────────────────────────────────────────────────────────────────────

def test_login_success():
    res = client.post("/api/login", json={"username": "user", "password": "password"})
    assert res.status_code == 200
    assert res.json() == {"ok": True}
    assert "session" in res.cookies


def test_login_wrong_password():
    res = client.post("/api/login", json={"username": "user", "password": "wrong"})
    assert res.status_code == 401


def test_login_wrong_username():
    res = client.post("/api/login", json={"username": "admin", "password": "password"})
    assert res.status_code == 401


# ── me ─────────────────────────────────────────────────────────────────────────

def test_me_unauthenticated():
    res = client.get("/api/me")
    assert res.status_code == 200
    assert res.json() == {"authenticated": False}


def test_me_authenticated():
    login = client.post("/api/login", json={"username": "user", "password": "password"})
    token = login.cookies["session"]
    res = client.get("/api/me", cookies={"session": token})
    assert res.status_code == 200
    assert res.json() == {"authenticated": True, "username": "user"}


# ── logout ─────────────────────────────────────────────────────────────────────

def test_logout_clears_session():
    login = client.post("/api/login", json={"username": "user", "password": "password"})
    token = login.cookies["session"]
    client.post("/api/logout", cookies={"session": token})
    res = client.get("/api/me", cookies={"session": token})
    assert res.json() == {"authenticated": False}


def test_logout_without_session_returns_ok():
    res = client.post("/api/logout")
    assert res.status_code == 200


# ── require_auth dependency ────────────────────────────────────────────────────

def test_require_auth_raises_without_session():
    from fastapi import Depends
    from app.auth import require_auth
    from fastapi.testclient import TestClient as TC
    from fastapi import FastAPI

    tmp = FastAPI()

    @tmp.get("/protected")
    def protected(session: str = Depends(require_auth)):
        return {"session": session}

    tc = TC(tmp)
    assert tc.get("/protected").status_code == 401
    login = client.post("/api/login", json={"username": "user", "password": "password"})
    token = login.cookies["session"]
    assert tc.get("/protected", cookies={"session": token}).status_code == 200
