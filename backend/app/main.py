import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.auth import router as auth_router
from app.board import router as board_router
from app.chat import router as chat_router
from app.db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Project Management API", lifespan=lifespan)

# Allow the Next.js dev server (localhost:3000) in local development.
_dev_origins = os.environ.get("CORS_ORIGINS", "").split(",")
if _dev_origins := [o.strip() for o in _dev_origins if o.strip()]:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_dev_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(auth_router)
app.include_router(board_router)
app.include_router(chat_router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# Serve the Next.js static export; mounted last so /api/* routes take precedence.
# The directory only exists inside the Docker image, not during local pytest.
_static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
if os.path.isdir(_static_dir):
    app.mount("/", StaticFiles(directory=_static_dir, html=True), name="static")
