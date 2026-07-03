import secrets

from fastapi import APIRouter, Cookie, HTTPException, Response
from pydantic import BaseModel

from app.constants import USERNAME as _USERNAME

router = APIRouter()

# In-memory sessions — reset on restart, sufficient for MVP with a single hardcoded user
_sessions: set[str] = set()

_PASSWORD = "password"


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/api/login")
def login(body: LoginRequest, response: Response) -> dict:
    if body.username != _USERNAME or body.password != _PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = secrets.token_hex(32)
    _sessions.add(token)
    response.set_cookie("session", token, httponly=True, samesite="strict", max_age=86400)
    return {"ok": True}


@router.post("/api/logout")
def logout(response: Response, session: str | None = Cookie(default=None)) -> dict:
    if session:
        _sessions.discard(session)
    response.delete_cookie("session")
    return {"ok": True}


@router.get("/api/me")
def me(session: str | None = Cookie(default=None)) -> dict:
    if session and session in _sessions:
        return {"authenticated": True, "username": _USERNAME}
    return {"authenticated": False}


def require_auth(session: str | None = Cookie(default=None)) -> str:
    """FastAPI dependency — raises 401 if no valid session cookie."""
    if not session or session not in _sessions:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return session
