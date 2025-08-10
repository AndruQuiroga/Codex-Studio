import importlib
import sys
import types
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


@pytest.fixture()
def api_client(tmp_path):
    sys.path.append(str(Path(__file__).resolve().parents[1]))
    settings_module = types.ModuleType("settings")
    settings_module.settings = types.SimpleNamespace(project_root=str(tmp_path))
    sys.modules["settings"] = settings_module
    fs = importlib.reload(importlib.import_module("routers.fs"))
    app = FastAPI()
    app.include_router(fs.router, prefix="/api")
    client = TestClient(app)
    return client, fs


def test_list_dir(api_client, tmp_path):
    client, _ = api_client
    (tmp_path / "file.txt").write_text("hi")
    (tmp_path / "sub").mkdir()

    resp = client.get("/api/fs/list")
    assert resp.status_code == 200
    names = {item["name"] for item in resp.json()}
    assert {"file.txt", "sub"} <= names

    resp = client.get("/api/fs/list", params={"path": "missing"})
    assert resp.status_code == 404


def test_tree(api_client, tmp_path):
    client, _ = api_client
    (tmp_path / "dir").mkdir()
    (tmp_path / "dir" / "a.txt").write_text("a")

    resp = client.get("/api/fs/tree")
    assert resp.status_code == 200
    assert resp.json() == ["dir/a.txt"]

    resp = client.get("/api/fs/tree", params={"path": "missing"})
    assert resp.status_code == 404


def test_read_file(api_client, tmp_path):
    client, fs = api_client
    (tmp_path / "a.txt").write_text("hello")

    resp = client.get("/api/fs/read", params={"path": "a.txt"})
    assert resp.status_code == 200
    assert resp.json()["content"] == "hello"

    resp = client.get("/api/fs/read", params={"path": "missing.txt"})
    assert resp.status_code == 404

    (tmp_path / "bin.dat").write_bytes(b"\x00\x01")
    resp = client.get("/api/fs/read", params={"path": "bin.dat"})
    assert resp.status_code == 415

    # too large
    fs.MAX_TEXT_BYTES = 5
    (tmp_path / "big.txt").write_text("x" * 10)
    resp = client.get("/api/fs/read", params={"path": "big.txt"})
    assert resp.status_code == 413


def test_write_file(api_client, tmp_path):
    client, fs = api_client

    resp = client.post("/api/fs/write", json={"path": "note.txt", "content": "hi"})
    assert resp.status_code == 200
    assert (tmp_path / "note.txt").read_text() == "hi"

    (tmp_path / "d").mkdir()
    resp = client.post("/api/fs/write", json={"path": "d", "content": "x"})
    assert resp.status_code == 400

    fs.MAX_TEXT_BYTES = 5
    resp = client.post("/api/fs/write", json={"path": "big.txt", "content": "1" * 10})
    assert resp.status_code == 413


def test_mkdir(api_client, tmp_path):
    client, _ = api_client
    resp = client.post("/api/fs/mkdir", json={"path": "newdir"})
    assert resp.status_code == 200
    assert (tmp_path / "newdir").is_dir()

    resp = client.post("/api/fs/mkdir", json={"path": ""})
    assert resp.status_code == 400


def test_create_file(api_client, tmp_path):
    client, fs = api_client

    resp = client.post("/api/fs/create", json={"path": "created.txt", "content": "hi"})
    assert resp.status_code == 200
    assert (tmp_path / "created.txt").read_text() == "hi"

    (tmp_path / "adir").mkdir()
    resp = client.post("/api/fs/create", json={"path": "adir", "content": ""})
    assert resp.status_code == 400

    fs.MAX_TEXT_BYTES = 5
    resp = client.post("/api/fs/create", json={"path": "big.txt", "content": "1" * 10})
    assert resp.status_code == 413


def test_delete_path(api_client, tmp_path):
    client, _ = api_client

    f = tmp_path / "a.txt"
    f.write_text("hi")
    resp = client.post("/api/fs/delete", json={"path": "a.txt"})
    assert resp.status_code == 200
    assert not f.exists()

    resp = client.post("/api/fs/delete", json={"path": "missing"})
    assert resp.status_code == 200

    resp = client.post("/api/fs/delete", json={"path": ""})
    assert resp.status_code == 400

    (tmp_path / "d").mkdir()
    (tmp_path / "d" / "f.txt").write_text("x")
    resp = client.post("/api/fs/delete", json={"path": "d"})
    assert resp.status_code == 400


def test_move_path(api_client, tmp_path):
    client, _ = api_client
    (tmp_path / "a.txt").write_text("hi")

    resp = client.post("/api/fs/move", json={"src": "a.txt", "dst": "b.txt"})
    assert resp.status_code == 200
    assert (tmp_path / "b.txt").exists()
    assert not (tmp_path / "a.txt").exists()

    resp = client.post("/api/fs/move", json={"src": "missing", "dst": "c.txt"})
    assert resp.status_code == 404


def test_safe_join(tmp_path):
    from services import fs as fs_service

    joined = fs_service.safe_join(str(tmp_path), "sub")
    assert Path(joined).is_absolute()

    with pytest.raises(ValueError):
        fs_service.safe_join(str(tmp_path), "..", "etc")


def test_run_command(monkeypatch, tmp_path):
    from services import fs as fs_service

    class DummyProc:
        def __init__(self):
            self.stdout = iter(["ok"])

        def wait(self):
            pass

    monkeypatch.setattr(
        fs_service,
        "subprocess",
        types.SimpleNamespace(Popen=lambda *a, **k: DummyProc(), PIPE=1, STDOUT=2),
    )

    assert list(fs_service.run_command(["ls"], str(tmp_path))) == ["ok"]
    with pytest.raises(ValueError):
        list(fs_service.run_command([], str(tmp_path)))
    with pytest.raises(ValueError):
        list(fs_service.run_command(["rm"], str(tmp_path)))

