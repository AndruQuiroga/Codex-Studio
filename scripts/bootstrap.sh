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
import os, subprocess
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
import asyncio, os
from typing import AsyncIterator

async def mock_stream(prompt: str) -> AsyncIterator[str]:
    for chunk in ["Thinking ", "about ", "your ", "request...\n", "Done!\n"]:
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
import json, uuid

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

printf "\nBootstrap complete. Next steps in README.md.\n"
