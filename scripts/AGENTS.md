# Scripts overview

Start/stop scripts for the dockerized app, for Mac/Linux (`.sh`) and
Windows (`.bat`). Both just wrap `docker compose`, run from the repo root.

- `start.sh` / `start.bat` — `docker compose up --build -d`, then prints the URL (`http://localhost:8000`)
- `stop.sh` / `stop.bat` — `docker compose down`

Requires Docker (and Docker Compose) installed and running. Reads
environment variables (e.g. `OPENROUTER_API_KEY`) from the root `.env`
via `docker-compose.yml`'s `env_file`.
