from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from schemas import Out
from settings import settings
from services.codex_adapter import invoke_codex
from routers.fs import router as fs_router
import json, uuid

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=[settings.cors_origin], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.get("/health")
def health():
    return {"ok": True}

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
