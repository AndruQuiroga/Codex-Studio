from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from schemas import Out
from settings import settings
from services.codex_adapter import invoke_codex
import json
import uuid
import asyncio
import os
import contextlib


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cors_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
            prompt = ev.get("payload", {}).get("text", "")
            async for chunk in invoke_codex(prompt):
                await ws.send_text(
                    Out(
                        type="partial",
                        sessionId=session_id,
                        messageId=message_id,
                        payload={"text": chunk},
                    ).model_dump_json()
                )
            await ws.send_text(
                Out(
                    type="final",
                    sessionId=session_id,
                    messageId=message_id,
                    payload={"done": True},
                ).model_dump_json()
            )
    except WebSocketDisconnect:
        pass


@app.websocket("/ws/terminal")
async def terminal_ws(ws: WebSocket):
    await ws.accept()
    # Pick a shell based on platform; fall back sanely
    if os.name == "nt":
        shell_cmd = ["powershell.exe", "-NoLogo", "-NoProfile"]
    else:
        shell_cmd = ["/bin/bash", "-l"] if os.path.exists("/bin/bash") else ["/bin/sh"]

    proc = await asyncio.create_subprocess_exec(
        *shell_cmd,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    assert proc.stdin is not None and proc.stdout is not None

    async def pump_stdout():
        try:
            while True:
                chunk = await proc.stdout.read(1024)
                if not chunk:
                    break
                try:
                    await ws.send_text(json.dumps({"type": "output", "data": chunk.decode(errors="ignore")}))
                except Exception:
                    break
        finally:
            try:
                await ws.close()
            except Exception:
                pass

    reader_task = asyncio.create_task(pump_stdout())
    try:
        while True:
            msg = await ws.receive_text()
            try:
                ev = json.loads(msg)
            except Exception:
                ev = {"type": "input", "data": msg}
            data = ev.get("data", "")
            if ev.get("type") == "input" and data is not None:
                proc.stdin.write(data.encode())
                await proc.stdin.drain()
    except WebSocketDisconnect:
        pass
    finally:
        if not proc.stdin.is_closing():
            proc.stdin.close()
        try:
            await asyncio.wait_for(proc.wait(), timeout=1.0)
        except asyncio.TimeoutError:
            with contextlib.suppress(ProcessLookupError):
                proc.kill()
        reader_task.cancel()
