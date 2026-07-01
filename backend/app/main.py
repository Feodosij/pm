from fastapi import FastAPI
from fastapi.responses import HTMLResponse

app = FastAPI(title="Project Management API")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/", response_class=HTMLResponse)
def root() -> str:
    return "<html><body><h1>Hello World</h1></body></html>"
