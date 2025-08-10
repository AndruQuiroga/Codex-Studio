import asyncio
import os
from typing import AsyncIterator


async def mock_stream(prompt: str) -> AsyncIterator[str]:
    for chunk in ["Thinking ", "about ", "your ", "request...\n", "Done!\n"]:
        await asyncio.sleep(0.15)
        yield chunk


async def invoke_codex(prompt: str) -> AsyncIterator[str]:
    cmd = os.getenv("CODEX_COMMAND", "").strip()
    if not cmd:
        # Fallback to mock when no CLI configured
        async for c in mock_stream(prompt):
            yield c
        return

    # Stream stdout line by line; adjust to your CLI protocol as needed
    proc = await asyncio.create_subprocess_exec(
        *cmd.split(),
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    assert proc.stdin is not None and proc.stdout is not None
    proc.stdin.write(prompt.encode())
    await proc.stdin.drain()
    proc.stdin.close()
    while True:
        line = await proc.stdout.readline()
        if not line:
            break
        yield line.decode(errors="ignore")
    await proc.wait()

