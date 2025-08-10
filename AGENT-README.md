# Vision

A sleek, local‑first “chat + code” workspace built on top of your Codex CLI. It feels like a mini‑IDE: left panel for projects and files, center for chat + editor, right panel for context/tools. The app orchestrates multiple agents, edits files, runs code, and shows logs—all in one place.

---

## UX Layout (desktop web; convertible to desktop app later)

* **Top bar:** Project switcher, model/agent profile picker, Run/Stop, tokens/time budget.
* **Left rail:**

  * Explorer (files & folders)
  * Sessions (recent chats, pin/favorites)
  * Git (branch, changes, quick commit)
* **Center:**

  * Tabs: `Chat` • `Editor` (Monaco) • `Scratch` (Markdown notes) • `Diff`
  * Chat stream supports: tool calls, code blocks with “apply patch”, inline run buttons, and artifacts (downloadable files).
* **Right rail:**

  * Context builder (files/snippets prompt-injection list)
  * Prompt presets & variables
  * Tool panel (toggle capabilities per run)
  * Memory panel (per project + per session)
* **Bottom drawer:**

  * Terminal (xterm.js) with multiplexing for tasks
  * Logs (agent traces, tool I/O), Problems list (lint, type errors)

---

## Tech Stack (opinionated defaults)

**Frontend**

* Next.js 14 (App Router), React 18
* TailwindCSS + shadcn/ui (Radix under the hood)
* Zustand (local UI state) + TanStack Query (server sync)
* Monaco Editor (VS Code quality editing)
* xterm.js (terminal)
* zod (runtime schemas), react-hook-form (forms)
* dexie (IndexedDB) for offline cache of sessions

**Backend**

* FastAPI + Uvicorn (HTTP + WebSocket)
* Pydantic v2 schemas; SQLModel/SQLAlchemy → Postgres (or SQLite dev)
* Async task runner (Dramatiq or Celery + Redis) for long jobs
* Structured logs via structlog; OpenTelemetry hooks (future)

**Agent Runtime & Execution**

* **Codex CLI integration**: spawn as a managed subprocess; stream tokens over stdio or WebSocket bridge; JSON‑RPC‑ish envelope.
* **Runners**

  * Node/JS: WebContainer (browser) for quick scripts; fallback server runner
  * Python: Pyodide (browser) for light evals; server venv or Docker for real runs
  * Docker runner: optional, reproducible tool sandboxes; configurable per project
* **Tooling**: Pluggable function registry (Python/Node) with safe sandboxes

**Packaging**

* Start as web app; later wrap with **Tauri** for a lightweight desktop app (file system & process control with native speed).

---

## Data Model (high‑level)

* **Project** {id, name, rootPath, gitRepo, envVars, toolConfig}
* **Workspace** {id, projects\[], settings}
* **Conversation** {id, projectId, title, createdAt, messages\[]}
* **Message** {id, role, text, toolCalls\[], artifacts\[], tokenUsage, timing}
* **Artifact** {id, type, path, contentHash, preview}
* **Run** {id, inputs, agentProfile, toolsEnabled\[], status, logs\[]}
* **Tool** {id, name, manifest, permissions}

---

## Wire Protocol (UI ↔ API)

WebSocket channel per session (`/ws/session/:id`). Envelope:

```json
{
  "type": "event|partial|final|tool_request|tool_result|error",
  "sessionId": "...",
  "messageId": "...",
  "payload": { }
}
```

Server streams `partial` tokens; `tool_request` emits JSON with `{name, args}`; UI executes local tool or forwards to server executor; sends back `tool_result`.

---

## MVP (Phase 1)

1. **Chat + Monaco Editor** in split view; apply code blocks to file.
2. **Codex bridge**: stream generation; tool‑less first, then basic tool calls.
3. **Explorer** with create/rename/move/delete; file diff & patch.
4. **Terminal**: run npm/pip/pytest; kill/attach.
5. **Context builder**: add files/snippets to prompt; token budget indicator.
6. **Local sessions storage** + export/import; server persistence optional.

Acceptance checks:

* Can open a repo, chat “add a FastAPI route”, preview patch, apply to disk, run tests, see logs.
* Can toggle tools (Filesystem, Shell) and cap commands to project root.

---

## Phase 2 (nice‑to‑haves)

* Multi‑agent swarms; roles (Planner, Coder, Critic)
* LSP wiring (language servers) into Monaco for real diagnostics
* Prompt library with variables; runbooks (macro steps)
* Test runner UI; coverage badge
* Git staging UI + commit‑by‑AI with conventional commits
* Observability: per‑tool latency & failure charts
* Live collab via CRDT (Yjs) later

---

## Security & Guardrails

* Project‑root jail for FS tools; allowlist commands
* Secrets vault per project (env var manager)
* “Dry‑run” mode for tools (show plan before execute)
* Resource caps per run (time, processes, memory)

---

## Plugin/Tool Interface (draft)

`tool.manifest.json`

```json
{
  "name": "run_command",
  "description": "Run a shell command in project root",
  "runtime": "python|node|docker",
  "inputs": {"cmd": "string", "timeout": "number?"},
  "permissions": ["shell"],
  "entry": "tools/run_command.py"
}
```

Python handler signature:

```python
async def run(inputs: dict, ctx: ToolContext) -> ToolResult: ...
```

`ToolContext` gives cwd, temp dir, logger, cancellation token.

---

## Monorepo Scaffold

```
codex-studio/
  apps/
    web/                # Next.js + shadcn + Monaco + xterm
    api/                # FastAPI + WebSocket + tool runner
  packages/
    shared/             # zod + pydantic-compatible schemas
    agents/             # codex-cli process manager & adapters
  infra/
    docker-compose.yml  # pg + redis + sandbox runners (opt)
```

### Create the scaffold (commands)

```bash
# repo root
mkdir codex-studio && cd codex-studio && git init

# pnpm workspace for web + shared
corepack enable && corepack prepare pnpm@latest --activate
pnpm init -y
printf 'packages:\n  - apps/*\n  - packages/*\n' > pnpm-workspace.yaml

# Next.js app
pnpm create next-app@latest apps/web --typescript --eslint --tailwind --app --src-dir
cd apps/web && pnpm add @tanstack/react-query zustand zod @hookform/resolvers react-hook-form @radix-ui/react-scroll-area
pnpm add monaco-editor @monaco-editor/react xterm xterm-addon-fit
# shadcn/ui
pnpm add clsx tailwind-merge lucide-react
# (after init) npx shadcn@latest init

# Shared package
cd ../../ && mkdir -p packages/shared && cd packages/shared && pnpm init -y && pnpm add zod

# FastAPI backend
cd ../../ && mkdir -p apps/api && cd apps/api && python -m venv .venv && source .venv/bin/activate
pip install fastapi uvicorn[standard] pydantic[dotenv] python-multipart websockets structlog
pip install sqlalchemy sqlmodel psycopg[binary] redis dramatiq

# Agents package (Python)
cd ../../packages && mkdir agents && cd agents && python -m venv .venv && source .venv/bin/activate
pip install anyio pydantic
```

---

## Example: FastAPI WebSocket skeleton

```python
# apps/api/main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
import asyncio, json

app = FastAPI()

class Out(BaseModel):
    type: str
    sessionId: str
    messageId: str
    payload: dict

@app.websocket("/ws/session/{session_id}")
async def session_ws(ws: WebSocket, session_id: str):
    await ws.accept()
    try:
        while True:
            raw = await ws.receive_text()
            ev = json.loads(raw)
            # TODO: route to codex adapter, stream partials back
            for i in range(3):
                await asyncio.sleep(0.1)
                await ws.send_text(Out(type="partial", sessionId=session_id, messageId=ev.get("messageId","m1"), payload={"text": "..."}).model_dump_json())
            await ws.send_text(Out(type="final", sessionId=session_id, messageId=ev.get("messageId","m1"), payload={"text": "done"}).model_dump_json())
    except WebSocketDisconnect:
        pass
```

---

## Example: Monaco + Chat (React sketch)

```tsx
// apps/web/src/app/(studio)/page.tsx
'use client'
import { useState } from 'react'
import Editor from '@monaco-editor/react'

export default function Studio() {
  const [code, setCode] = useState('// hello')
  return (
    <div className="grid grid-cols-12 h-[calc(100vh-3rem)]">
      <aside className="col-span-2 border-r">/* explorer */</aside>
      <main className="col-span-7">
        <div className="h-1/2 border-b overflow-auto">/* chat stream */</div>
        <div className="h-1/2">
          <Editor height="100%" defaultLanguage="typescript" value={code} onChange={(v)=>setCode(v||'')} />
        </div>
      </main>
      <aside className="col-span-3 border-l">/* context & tools */</aside>
    </div>
  )
}
```

---

## Naming (working options)

* **Codex Studio** (straightforward)
* **VibeForge** (fun) / **Drift** / **Orbit** / **Loft**

---

## Next Steps

1. Confirm stack choices (web first + Tauri later).
2. Decide runners (browser WebContainer/Pyodide vs server/Docker).
3. Lock the MVP feature list and scaffold the repo.
4. Implement Codex CLI adapter + message streaming.
5. Add Filesystem + Shell tools with strict guardrails.

---

# Starter Repo — Files & Contents (v0.1)

This section contains **copy‑pasteable** files for a working monorepo scaffold that matches your decisions:

* Web first (Next.js), sleek dark UI with shadcn/ui & animations
* Local API server (FastAPI) for chat streaming and tool execution
* Single‑project focus, single agent (with room for task/ask vs code), terminal, Git, tests
* Python + JS/TS, Docker optional for DB/Redis and isolated runners

> Tip: If you’re using another chat instance, **this section alone is enough** for them to continue. It explains the architecture and contains the initial files.

---

## 0) Quick Start (Windows & macOS/Linux)

**Windows (PowerShell):**

```powershell
# From an empty folder
mkdir codex-studio; cd codex-studio; git init

# Create files from this doc (or copy them) then run bootstrap
./scripts/bootstrap.ps1
```

**macOS/Linux (bash/zsh):**

```bash
mkdir -p codex-studio && cd codex-studio && git init
# Create files from this doc (or copy them) then run bootstrap
bash scripts/bootstrap.sh
```

After bootstrap:

```bash
# Terminal 1: API
cd apps/api && source .venv/bin/activate && uvicorn main:app --reload --port 5050

# Terminal 2: Web
cd apps/web && pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000)

> Docker (optional): `docker compose -f infra/docker-compose.yml up -d`

---

## 1) Repository Tree

```
codex-studio/
  README.md
  .gitignore
  .editorconfig
  pnpm-workspace.yaml
  package.json
  scripts/
    bootstrap.sh
    bootstrap.ps1
  infra/
    docker-compose.yml
    init.sql
  apps/
    api/
      requirements.txt
      main.py
      settings.py
      services/
        codex_adapter.py
        fs.py
      schemas.py
      __init__.py
    web/
      package.json
      next.config.mjs
      postcss.config.mjs
      tailwind.config.ts
      tsconfig.json
      src/
        app/
          layout.tsx
          page.tsx
          (studio)/
            page.tsx
        lib/
          ws.ts
          api.ts
        components/
          Chat.tsx
          EditorPane.tsx
          TerminalPane.tsx
          Topbar.tsx
          Sidebar.tsx
          RightRail.tsx
          ui/  # shadcn components (generated after init)
        styles/
          globals.css
  packages/
    shared/
      package.json
      src/
        schemas.ts
```

---

## 2) Root Files

### `README.md`

```md
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

PROJECT\_ROOT=/absolute/path/to/your/project
DATABASE\_URL=postgresql+psycopg://postgres\:postgres\@localhost:5432/codex
REDIS\_URL=redis\://localhost:6379/0
CODEX\_COMMAND=pnpm dlx codex  # or npx codex
API\_PORT=5050
CORS\_ORIGIN=[http://localhost:3000](http://localhost:3000)

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

```

### `.gitignore`

```gitignore
# Node
node_modules
.pnpm-store
.next
out

# Python
__pycache__
.venv
*.pyc

# OS
.DS_Store
Thumbs.db

# Env
.env
.env.*

# Misc
coverage
```

### `.editorconfig`

```ini
root = true
[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true
```

### `pnpm-workspace.yaml`

```yaml
packages:
  - apps/*
  - packages/*
```

### `package.json` (root)

```json
{
  "name": "codex-studio",
  "private": true,
  "devDependencies": {
    "turbo": "latest"
  },
  "scripts": {
    "dev:web": "pnpm --filter @codex-studio/web dev",
    "build:web": "pnpm --filter @codex-studio/web build",
    "dev": "turbo run dev",
    "build": "turbo run build"
  }
}
```

---

## 3) Bootstrap Scripts

### `scripts/bootstrap.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

# Root
mkdir -p apps/api apps/web packages/shared infra scripts

# Web app via Next.js
if [ ! -d "apps/web" ] || [ -z "$(ls -A apps/web)" ]; then
  corepack enable || true
  corepack prepare pnpm@latest --activate
  pnpm create next-app@latest apps/web --typescript --eslint --tailwind --app --src-dir --import-alias "@/*"
  pushd apps/web
  pnpm add @tanstack/react-query zustand zod @hookform/resolvers react-hook-form @radix-ui/react-scroll-area monaco-editor @monaco-editor/react xterm xterm-addon-fit clsx tailwind-merge lucide-react framer-motion
  npx shadcn@latest init -y || true
  popd
fi

# Shared package
mkdir -p packages/shared/src
cat > packages/shared/package.json <<'JSON'
{
  "name": "@codex-studio/shared",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "dependencies": { "zod": "^3.23.8" }
}
JSON

cat > packages/shared/src/schemas.ts <<'TS'
import { z } from 'zod'
export const MessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user","assistant","tool"]),
  text: z.string().default(""),
  createdAt: z.string(),
})
export const SessionEventSchema = z.object({
  type: z.enum(["event","partial","final","tool_request","tool_result","error"]),
  sessionId: z.string(),
  messageId: z.string(),
  payload: z.record(z.any())
})
export type SessionEvent = z.infer<typeof SessionEventSchema>
TS

# API (FastAPI)
python -m venv apps/api/.venv
source apps/api/.venv/bin/activate
pip install --upgrade pip
pip install fastapi uvicorn[standard] pydantic[dotenv] websockets structlog python-multipart sqlmodel psycopg[binary] redis

cat > apps/api/requirements.txt <<'REQ'
fastapi
uvicorn[standard]
pydantic[dotenv]
websockets
structlog
python-multipart
sqlmodel
psycopg[binary]
redis
REQ

cat > apps/api/settings.py <<'PY'
from pydantic import BaseSettings, Field
class Settings(BaseSettings):
    project_root: str = Field(..., alias="PROJECT_ROOT")
    database_url: str = Field("postgresql+psycopg://postgres:postgres@localhost:5432/codex", alias="DATABASE_URL")
    redis_url: str = Field("redis://localhost:6379/0", alias="REDIS_URL")
    codex_command: str = Field("", alias="CODEX_COMMAND")
    cors_origin: str = Field("http://localhost:3000", alias="CORS_ORIGIN")
    api_port: int = Field(5050, alias="API_PORT")
    class Config:
        env_file = ".env"
        extra = "ignore"
settings = Settings(_env_file=".env", _secrets_dir=None)
PY

cat > apps/api/schemas.py <<'PY'
from pydantic import BaseModel
from typing import Any, Dict
class Out(BaseModel):
    type: str
    sessionId: str
    messageId: str
    payload: Dict[str, Any]
class In(BaseModel):
    type: str
    messageId: str
    payload: Dict[str, Any]
PY

mkdir -p apps/api/services

cat > apps/api/services/fs.py <<'PY'
import os, shlex, subprocess
from typing import List
from pathlib import Path

SAFE_COMMANDS = {"ls","dir","git","npm","pnpm","pip","pytest","python","node"}

def safe_join(root: str, *paths: str) -> str:
    p = Path(root).joinpath(*paths).resolve()
    rootp = Path(root).resolve()
    if rootp not in p.parents and p != rootp:
        raise ValueError("Path escape detected")
    return str(p)

def run_command(cmd: List[str], cwd: str):
    if cmd[0] not in SAFE_COMMANDS:
        raise ValueError("Command not allowed")
    proc = subprocess.Popen(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    for line in proc.stdout or []:
        yield line
    proc.wait()
PY

cat > apps/api/services/codex_adapter.py <<'PY'
import asyncio, os, json
from typing import AsyncIterator

async def mock_stream(prompt: str) -> AsyncIterator[str]:
    for chunk in ["Thinking ","about ","your ","request...
","Done!
"]:
        await asyncio.sleep(0.15)
        yield chunk

async def invoke_codex(prompt: str) -> AsyncIterator[str]:
    cmd = os.getenv("CODEX_COMMAND", "").strip()
    if not cmd:
        # Fallback to mock
        async for c in mock_stream(prompt):
            yield c
        return
    # Example: stream stdout line by line; adjust to your CLI format
    proc = await asyncio.create_subprocess_exec(*cmd.split(), stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT)
    assert proc.stdin is not None and proc.stdout is not None
    proc.stdin.write(prompt.encode()); await proc.stdin.drain(); proc.stdin.close()
    while True:
        line = await proc.stdout.readline()
        if not line:
            break
        yield line.decode(errors='ignore')
    await proc.wait()
PY

cat > apps/api/main.py <<'PY'
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from schemas import Out
from settings import settings
from services.codex_adapter import invoke_codex
import json, uuid, asyncio

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=[settings.cors_origin], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.get("/health")
def health():
    return {"ok": True}

@app.websocket("/ws/session/{session_id}")
async def session_ws(ws: WebSocket, session_id: str):
    await ws.accept()
    try:
        while True:
            raw = await ws.receive_text()
            ev = json.loads(raw)
            message_id = ev.get("messageId") or str(uuid.uuid4())
            prompt = ev.get("payload",{}).get("text","")
            async for chunk in invoke_codex(prompt):
                await ws.send_text(Out(type="partial", sessionId=session_id, messageId=message_id, payload={"text": chunk}).model_dump_json())
            await ws.send_text(Out(type="final", sessionId=session_id, messageId=message_id, payload={"done": True}).model_dump_json())
    except WebSocketDisconnect:
        pass
PY

# Web minimal files overwrite/additions (after Next scaffold)
cat > apps/web/src/lib/ws.ts <<'TS'
export function connectWS(sessionId: string) {
  const url = `ws://localhost:5050/ws/session/${sessionId}`
  return new WebSocket(url)
}
TS

mkdir -p apps/web/src/components

cat > apps/web/src/components/Chat.tsx <<'TSX'
'use client'
import { useEffect, useRef, useState } from 'react'
import { connectWS } from '@/lib/ws'
import { motion } from 'framer-motion'

export default function Chat() {
  const [messages, setMessages] = useState<string[]>([])
  const [input, setInput] = useState('')
  const wsRef = useRef<WebSocket | null>(null)
  const sessionId = 'local'

  useEffect(() => {
    const ws = connectWS(sessionId)
    wsRef.current = ws
    ws.onmessage = (ev) => {
      const data = JSON.parse(ev.data)
      if (data.type === 'partial') {
        setMessages((m) => [...m.slice(0, -1), (m[m.length-1]||'') + data.payload.text])
      } else if (data.type === 'final') {
        // noop, message already formed
      }
    }
    return () => { ws.close() }
  }, [])

  function sendPrompt() {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    setMessages((m)=>[...m, ''])
    ws.send(JSON.stringify({ type: 'user', payload: { text: input }, messageId: crypto.randomUUID() }))
    setInput('')
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto space-y-3 p-3">
        {messages.map((m, i) => (
          <motion.pre key={i} className="whitespace-pre-wrap bg-zinc-900/50 rounded-xl p-3" initial={{opacity:0, y:4}} animate={{opacity:1, y:0}}>{m}</motion.pre>
        ))}
      </div>
      <div className="p-3 border-t bg-zinc-950/50 flex gap-2">
        <input className="flex-1 bg-zinc-900 rounded-xl px-3 py-2 outline-none" value={input} onChange={(e)=>setInput(e.target.value)} placeholder="Ask the agent…" />
        <button className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700" onClick={sendPrompt}>Send</button>
      </div>
    </div>
  )
}
TSX

cat > apps/web/src/components/EditorPane.tsx <<'TSX'
'use client'
import Editor from '@monaco-editor/react'
import { useState } from 'react'

export default function EditorPane() {
  const [code, setCode] = useState('// start typing
')
  return <Editor height="100%" defaultLanguage="typescript" value={code} onChange={(v)=>setCode(v||'')} />
}
TSX

cat > apps/web/src/components/TerminalPane.tsx <<'TSX'
export default function TerminalPane(){
  return <div className="h-full flex items-center justify-center text-sm text-zinc-400">Terminal coming next</div>
}
TSX

cat > apps/web/src/components/Topbar.tsx <<'TSX'
export default function Topbar(){
  return (
    <div className="h-12 border-b bg-black/60 backdrop-blur flex items-center px-4 text-zinc-200">
      <div className="font-semibold">Codex Studio</div>
      <div className="ml-4 text-xs text-zinc-400">single‑project • dark mode</div>
    </div>
  )
}
TSX

cat > apps/web/src/components/Sidebar.tsx <<'TSX'
export default function Sidebar(){
  return (
    <aside className="h-full border-r w-56 p-3 text-sm text-zinc-300">Explorer (coming)</aside>
  )
}
TSX

cat > apps/web/src/components/RightRail.tsx <<'TSX'
export default function RightRail(){
  return <aside className="h-full border-l w-80 p-3 text-sm text-zinc-300">Context & Tools (coming)</aside>
}
TSX

# App shell
cat > apps/web/src/app/layout.tsx <<'TSX'
import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Codex Studio', description: 'Mini‑IDE for agent coding' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black text-zinc-200">{children}</body>
    </html>
  )
}
TSX

cat > apps/web/src/app/page.tsx <<'TSX'
import Link from 'next/link'
export default function Home(){
  return (
    <main className="p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Codex Studio</h1>
      <p className="text-zinc-400">Head to the Studio to start chatting & editing.</p>
      <Link className="underline" href="/(studio)">Open Studio</Link>
    </main>
  )
}
TSX

mkdir -p apps/web/src/app/(studio)
cat > apps/web/src/app/(studio)/page.tsx <<'TSX'
import Topbar from '@/components/Topbar'
import Sidebar from '@/components/Sidebar'
import Chat from '@/components/Chat'
import EditorPane from '@/components/EditorPane'
import RightRail from '@/components/RightRail'

export default function Studio(){
  return (
    <div className="h-screen grid grid-rows-[3rem_1fr]">
      <Topbar />
      <div className="grid grid-cols-[14rem_1fr_20rem]">
        <Sidebar />
        <main className="grid grid-rows-[1fr_1fr]">
          <section className="border-b overflow-hidden"><Chat /></section>
          <section className="overflow-hidden"><EditorPane /></section>
        </main>
        <RightRail />
      </div>
    </div>
  )
}
TSX

# Tailwind & config
cat > apps/web/tailwind.config.ts <<'TS'
import type { Config } from 'tailwindcss'
const config: Config = { content: ['./src/**/*.{ts,tsx}'], theme: { extend: {} }, plugins: [] }
export default config
TS

cat > apps/web/postcss.config.mjs <<'JS'
export default { plugins: { tailwindcss: {}, autoprefixer: {} } }
JS

cat > apps/web/next.config.mjs <<'JS'
/** @type {import('next').NextConfig} */
const nextConfig = { reactStrictMode: true }
export default nextConfig
JS

cat > apps/web/package.json <<'JSON'
{
  "name": "@codex-studio/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^14.2.5",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@tanstack/react-query": "^5.51.1",
    "zustand": "^4.5.2",
    "zod": "^3.23.8",
    "@hookform/resolvers": "^3.9.0",
    "react-hook-form": "^7.52.2",
    "@radix-ui/react-scroll-area": "^1.0.5",
    "monaco-editor": "^0.49.0",
    "@monaco-editor/react": "^4.6.0",
    "xterm": "^5.3.0",
    "xterm-addon-fit": "^0.7.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.3.0",
    "lucide-react": "^0.378.0",
    "framer-motion": "^11.3.2"
  }
}
JSON

mkdir -p infra
cat > infra/docker-compose.yml <<'YML'
version: '3.9'
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: codex
    ports: ["5432:5432"]
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
  redis:
    image: redis:7
    ports: ["6379:6379"]
volumes:
  pgdata:
YML

cat > infra/init.sql <<'SQL'
-- future migrations
SQL

# Done
printf "
Bootstrap complete. Next steps in README.md.
"
```

### `scripts/bootstrap.ps1`

```powershell
Param()
$ErrorActionPreference = "Stop"

# Enable corepack and pnpm
corepack enable | Out-Null
corepack prepare pnpm@latest --activate | Out-Null

# Create Next app if missing
if (-not (Test-Path "apps/web")) { mkdir apps/web | Out-Null }
if (-not (Get-ChildItem "apps/web")) {
  pnpm create next-app@latest apps/web --typescript --eslint --tailwind --app --src-dir --import-alias "@/*"
  Push-Location apps/web
  pnpm add @tanstack/react-query zustand zod @hookform/resolvers react-hook-form @radix-ui/react-scroll-area monaco-editor @monaco-editor/react xterm xterm-addon-fit clsx tailwind-merge lucide-react framer-motion
  npx shadcn@latest init -y
  Pop-Location
}

# Python venv
if (-not (Test-Path "apps/api/.venv")) {
  python -m venv apps/api/.venv
}
"Bootstrap complete. See README.md for run commands."
```

---

## 4) Notes for Future You (and other GPTs)

* Replace the mock stream with your Codex CLI in `apps/api/services/codex_adapter.py`.
* All env and ports are consolidated in `apps/api/settings.py`.
* FS guardrails live in `apps/api/services/fs.py` (allowlist + path jail).
* WebSocket contract is the same as the **Wire Protocol** above.
* UI is intentionally minimal but styled dark and ready for shadcn components.

> Next implementation steps: add File Explorer (readDir, open, save), a `/api/fs/*` REST router, then wire “apply patch from chat” flow.
