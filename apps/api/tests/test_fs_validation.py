import sys
import types
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient


def test_write_rejects_unknown_fields(tmp_path):
    sys.path.append(str(Path(__file__).resolve().parents[1]))

    settings_module = types.ModuleType("settings")
    settings_module.settings = types.SimpleNamespace(project_root=str(tmp_path))
    sys.modules["settings"] = settings_module

    from routers.fs import router

    app = FastAPI()
    app.include_router(router, prefix="/api")
    client = TestClient(app)

    resp = client.post(
        "/api/fs/write",
        json={"path": "a.txt", "content": "hi", "extra": "nope"},
    )
    assert resp.status_code == 422
