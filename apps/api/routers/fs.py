from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, field_validator
from typing import List, Optional
from pathlib import Path

from settings import settings
from services.fs import safe_join

router = APIRouter()


def _validate_relative_path(cls, v: str) -> str:
    """Validate that ``v`` is a safe project-relative path.

    The filesystem API only accepts paths that are relative to the project
    root. Absolute paths or any use of ``..`` to traverse parent directories
    are rejected.
    """
    p = Path(v)
    if p.is_absolute() or any(part == ".." for part in p.parts):
        raise ValueError("Path must be relative and must not contain '..'")
    return v

class FsItem(BaseModel):
    name: str
    path: str  # path relative to project root
    dir: bool

class WriteBody(BaseModel):
    path: str  # relative path from project root
    content: str

    _validate_path = field_validator("path")(_validate_relative_path)

MAX_TEXT_BYTES = 1_000_000  # 1MB safeguard


class PathBody(BaseModel):
    path: str  # relative path from project root

    _validate_path = field_validator("path")(_validate_relative_path)


class MkdirBody(BaseModel):
    path: str  # relative path from project root
    parents: bool = True

    _validate_path = field_validator("path")(_validate_relative_path)


class CreateBody(BaseModel):
    path: str  # relative path from project root
    content: Optional[str] = ""

    _validate_path = field_validator("path")(_validate_relative_path)


class MoveBody(BaseModel):
    src: str  # relative source path
    dst: str  # relative destination path

    _validate_paths = field_validator("src", "dst")(_validate_relative_path)

def _abs_from_rel(rel: str) -> Path:
    root = settings.project_root
    return Path(safe_join(root, rel or "."))

def _rel_from_abs(abs_path: Path) -> str:
    root = Path(settings.project_root).resolve()
    return str(abs_path.resolve().relative_to(root))

@router.get("/fs/list", response_model=List[FsItem])
def list_dir(path: str = Query(default="", description="Relative path from PROJECT_ROOT")):
    target = _abs_from_rel(path)
    if not target.exists():
        raise HTTPException(status_code=404, detail="Path not found")
    if target.is_file():
        target = target.parent
    items: List[FsItem] = []
    for child in sorted(target.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
        items.append(FsItem(name=child.name, path=_rel_from_abs(child), dir=child.is_dir()))
    return items


@router.get("/fs/tree", response_model=List[str])
def tree(path: str = ""):
    start = _abs_from_rel(path)
    if not Path(start).exists():
        raise HTTPException(status_code=404, detail="Path not found")
    results: List[str] = []
    cap = 5000
    for p in Path(start).rglob("*"):
        try:
            if p.is_file():
                results.append(_rel_from_abs(p))
                if len(results) >= cap:
                    break
        except Exception:
            continue
    return results

@router.get("/fs/read")
def read_file(path: str = Query(..., description="Relative file path")):
    p = _abs_from_rel(path)
    if not p.exists() or not p.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    # Size guard
    size = p.stat().st_size
    if size > MAX_TEXT_BYTES:
        raise HTTPException(status_code=413, detail=f"File too large (> {MAX_TEXT_BYTES} bytes)")
    # Basic binary detection
    head = p.read_bytes()[:2048]
    if b"\x00" in head:
        raise HTTPException(status_code=415, detail="Binary files not supported")
    try:
        content = p.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=415, detail="Not a UTF-8 text file")
    return {"path": path, "content": content}

@router.post("/fs/write")
def write_file(body: WriteBody):
    p = _abs_from_rel(body.path)
    if p.exists() and p.is_dir():
        raise HTTPException(status_code=400, detail="Cannot write a directory")
    # Size guard
    try:
        payload_bytes = body.content.encode("utf-8")
    except Exception:
        raise HTTPException(status_code=400, detail="Content must be UTF-8 encodable")
    if len(payload_bytes) > MAX_TEXT_BYTES:
        raise HTTPException(status_code=413, detail=f"Content too large (> {MAX_TEXT_BYTES} bytes)")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(body.content, encoding="utf-8")
    return {"ok": True}


@router.post("/fs/mkdir")
def mkdir(body: MkdirBody):
    p = _abs_from_rel(body.path)
    if Path(settings.project_root).resolve() == Path(p).resolve():
        raise HTTPException(status_code=400, detail="Refusing to create the project root")
    Path(p).mkdir(parents=body.parents, exist_ok=True)
    return {"ok": True}


@router.post("/fs/create")
def create_file(body: CreateBody):
    p = _abs_from_rel(body.path)
    pp = Path(p)
    if pp.exists() and pp.is_dir():
        raise HTTPException(status_code=400, detail="Path is a directory")
    pp.parent.mkdir(parents=True, exist_ok=True)
    content = (body.content or "").encode("utf-8")
    if len(content) > MAX_TEXT_BYTES:
        raise HTTPException(status_code=413, detail=f"Content too large (> {MAX_TEXT_BYTES} bytes)")
    pp.write_bytes(content)
    return {"ok": True}


@router.post("/fs/delete")
def delete_path(body: PathBody):
    p = Path(_abs_from_rel(body.path))
    root = Path(settings.project_root).resolve()
    if p.resolve() == root:
        raise HTTPException(status_code=400, detail="Refusing to delete project root")
    if not p.exists():
        return {"ok": True}
    if p.is_dir():
        # Conservative: only delete empty dirs to avoid accidents
        try:
            p.rmdir()
        except OSError:
            raise HTTPException(status_code=400, detail="Directory not empty")
    else:
        p.unlink()
    return {"ok": True}


@router.post("/fs/move")
def move_path(body: MoveBody):
    src = Path(_abs_from_rel(body.src))
    dst = Path(_abs_from_rel(body.dst))
    if not src.exists():
        raise HTTPException(status_code=404, detail="Source not found")
    dst.parent.mkdir(parents=True, exist_ok=True)
    src.replace(dst)
    return {"ok": True}
