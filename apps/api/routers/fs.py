from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List
from pathlib import Path

from settings import settings
from services.fs import safe_join

router = APIRouter()

class FsItem(BaseModel):
    name: str
    path: str  # path relative to project root
    dir: bool

class WriteBody(BaseModel):
    path: str
    content: str

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

@router.get("/fs/read")
def read_file(path: str = Query(..., description="Relative file path")):
    p = _abs_from_rel(path)
    if not p.exists() or not p.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    try:
        content = p.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=415, detail="Not a text file")
    return {"path": path, "content": content}

@router.post("/fs/write")
def write_file(body: WriteBody):
    p = _abs_from_rel(body.path)
    if p.exists() and p.is_dir():
        raise HTTPException(status_code=400, detail="Cannot write a directory")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(body.content, encoding="utf-8")
    return {"ok": True}
