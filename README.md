# Codex Studio (Mini‑IDE for Agent/Vibe Coding)

A chat‑first, local‑first workspace that pairs a Monaco editor, terminal, and a FastAPI backend. Built to orchestrate a single agent (for now) with a clean path to more.

## Decisions
- Web first; desktop later (via Tauri).
- Languages: Python + JS/TS. Docker optional for runners.
- Single‑project focus. Terminal + Git + Tests.
- Dark, sleek UI with subtle motion.

## Getting Started
See **scripts/bootstrap.sh** or **scripts/bootstrap.ps1** to scaffold Next.js, Tailwind, shadcn/ui, and the FastAPI env.

### Run
- API: `cd apps/api && source .venv/bin/activate && uvicorn main:app --reload --port 5050`
- Web: `cd apps/web && pnpm dev` → http://localhost:3000

### Env
Create `apps/api/.env` from `.env.example` values below.

```
PROJECT_ROOT=/absolute/path/to/your/project
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/codex
REDIS_URL=redis://localhost:6379/0
CODEX_COMMAND=pnpm dlx codex  # or npx codex
API_PORT=5050
CORS_ORIGIN=http://localhost:3000
```

### What Works in v0.1
- Chat page with WebSocket to FastAPI (`/ws/session/:id`)
- Monaco editor pane with file open/save
- Terminal pane (xterm) attached to a server pty process
- File explorer (basic)
- Mock agent stream (replace with Codex CLI via `CODEX_COMMAND`)

### Integrating Codex CLI
By default the backend uses a **mock stream**. To enable Codex:
1. Install your CLI: `pnpm add -D codex` or install globally.
2. Set `CODEX_COMMAND` (e.g., `pnpm dlx codex` or `npx codex`).
3. Implement the `invoke_codex()` function in `apps/api/services/codex_adapter.py` to pass the prompt and parse its stdout.

### Security Notes
- FS tools are root‑jailed to `PROJECT_ROOT`.
- Shell commands are allowlisted in v0.1. See `services/fs.py`.

### Roadmap
- Real tool calls from chat (FS, shell, git)
- LSP diagnostics; Git UI; test runner surface
- Multi‑agent (Planner/Coder/Critic) behind a feature flag
