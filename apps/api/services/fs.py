import subprocess
from pathlib import Path
from typing import List


SAFE_COMMANDS = {"ls", "dir", "git", "npm", "pnpm", "pip", "pytest", "python", "node"}


def safe_join(root: str, *paths: str) -> str:
    p = Path(root).joinpath(*paths).resolve()
    rootp = Path(root).resolve()
    if rootp not in p.parents and p != rootp:
        raise ValueError("Path escape detected")
    return str(p)


def run_command(cmd: List[str], cwd: str):
    if not cmd:
        raise ValueError("Empty command")
    if cmd[0] not in SAFE_COMMANDS:
        raise ValueError("Command not allowed")
    proc = subprocess.Popen(
        cmd,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    for line in proc.stdout or []:
        yield line
    proc.wait()

