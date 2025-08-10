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

