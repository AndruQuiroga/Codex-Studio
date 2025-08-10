from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from schemas import Out
from settings import settings
from services.codex_adapter import invoke_codex
from routers.fs import router as fs_router
import json, uuid, asyncio, os, sys, contextlib
from pathlib import Path

# Optional PTY deps for POSIX
try:  # pragma: no cover - platform specific
    import pty  # type: ignore
    import fcntl  # type: ignore
    import struct  # type: ignore
    POSIX = os.name != "nt"
except Exception:  # pragma: no cover
    pty = None  # type: ignore
    fcntl = None  # type: ignore
    struct = None  # type: ignore
    POSIX = False

app = FastAPI()
# Support comma-separated origins
origins = [o.strip() for o in (settings.cors_origin or "").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins or [settings.cors_origin], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.get("/health")
def health():
    root_ok = Path(settings.project_root).exists()
    codex_ok = bool(os.getenv("CODEX_COMMAND", "").strip())
    return {"ok": True, "projectRoot": root_ok, "codexConfigured": codex_ok}


@app.on_event("startup")
async def on_startup():
    root = Path(settings.project_root)
    if not root.exists() or not root.is_dir():
        # Fail fast with a descriptive message
        msg = f"Invalid PROJECT_ROOT: {root}. Set PROJECT_ROOT to your workspace path."
        # Printing to stderr helps when running under uvicorn
        print(msg, file=sys.stderr)
        raise RuntimeError(msg)

# REST routers
app.include_router(fs_router, prefix="/api")

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


@app.websocket("/ws/terminal")
async def terminal_ws(ws: WebSocket):
    """Spawn a shell and proxy data over WebSocket.

    Client messages:
      {"type":"input","data":"..."}
      {"type":"resize","cols":80,"rows":24}

    Server messages:
      {"type":"output","data":"..."}
    """
    await ws.accept()

    if POSIX and pty is not None:
        # PTY-backed shell on POSIX
        shell = os.environ.get("SHELL") or ("/bin/bash" if os.path.exists("/bin/bash") else "/bin/sh")

        # Fork a child connected to a pty
        pid, master_fd = pty.fork()  # type: ignore[attr-defined]
        if pid == 0:  # Child
            # Optional: chdir to project root
            try:
                os.chdir(settings.project_root)
            except Exception:
                pass
            os.execvp(shell, [shell])
            os._exit(1)

        # Parent: interact with master_fd
        loop = asyncio.get_running_loop()
        stop = asyncio.Event()

        async def pump_master():
            try:
                while not stop.is_set():
                    # Use to_thread to avoid blocking loop
                    data = await asyncio.to_thread(os.read, master_fd, 1024)
                    if not data:
                        break
                    try:
                        await ws.send_text(json.dumps({"type": "output", "data": data.decode(errors="ignore")}))
                    except RuntimeError:
                        break
            except Exception:
                pass

        reader_task = asyncio.create_task(pump_master())

        try:
            while True:
                msg = await ws.receive_text()
                try:
                    ev = json.loads(msg)
                except json.JSONDecodeError:
                    ev = {"type": "input", "data": msg}

                if ev.get("type") == "input":
                    data = ev.get("data", "")
                    if data:
                        try:
                            await asyncio.to_thread(os.write, master_fd, data.encode())
                        except Exception:
                            break
                elif ev.get("type") == "resize" and fcntl is not None and struct is not None:
                    try:
                        cols = int(ev.get("cols", 80))
                        rows = int(ev.get("rows", 24))
                        winsz = struct.pack("HHHH", rows, cols, 0, 0)
                        await asyncio.to_thread(fcntl.ioctl, master_fd, 0x5414, winsz)  # TIOCSWINSZ
                    except Exception:
                        # Ignore resize errors
                        pass
        except WebSocketDisconnect:
            pass
        finally:
            stop.set()
            reader_task.cancel()
            with contextlib.suppress(Exception):
                await reader_task
            with contextlib.suppress(Exception):
                os.close(master_fd)
            with contextlib.suppress(Exception):
                # Gracefully terminate child
                os.kill(pid, 15)
    else:
        # Windows or fallback: subprocess with pipes
        if os.name == "nt":
            cmd = ["powershell.exe", "-NoLogo"]
        else:
            cmd = ["/bin/bash"] if os.path.exists("/bin/bash") else ["/bin/sh"]

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )

        assert proc.stdin is not None and proc.stdout is not None

        async def pump_stdout():
            try:
                while True:
                    data = await proc.stdout.read(1024)
                    if not data:
                        break
                    try:
                        await ws.send_text(json.dumps({"type": "output", "data": data.decode(errors="ignore")}))
                    except RuntimeError:
                        break
            except Exception:
                pass

        reader_task = asyncio.create_task(pump_stdout())

        try:
            while True:
                msg = await ws.receive_text()
                try:
                    ev = json.loads(msg)
                except json.JSONDecodeError:
                    ev = {"type": "input", "data": msg}

                if ev.get("type") == "input":
                    data = ev.get("data", "")
                    if data and not proc.stdin.is_closing():
                        proc.stdin.write(data.encode())
                        with contextlib.suppress(Exception):
                            await proc.stdin.drain()
                elif ev.get("type") == "resize":
                    # No PTY configured on this path
                    pass
        except WebSocketDisconnect:
            pass
        finally:
            with contextlib.suppress(Exception):
                if proc.stdin and not proc.stdin.is_closing():
                    proc.stdin.write(b"exit\n")
                    await proc.stdin.drain()
            with contextlib.suppress(Exception):
                proc.terminate()  # type: ignore[attr-defined]
            with contextlib.suppress(Exception):
                await proc.wait()
            reader_task.cancel()
            with contextlib.suppress(Exception):
                await reader_task
