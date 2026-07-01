import os

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.auth import router as auth_router

app = FastAPI(title="Project Management API")
app.include_router(auth_router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# Serve the Next.js static export; mounted last so /api/* routes take precedence.
# The directory only exists inside the Docker image, not during local pytest.
_static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
if os.path.isdir(_static_dir):
    app.mount("/", StaticFiles(directory=_static_dir, html=True), name="static")
