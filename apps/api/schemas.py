from pydantic import BaseModel, ConfigDict
from typing import Any, Dict


class Out(BaseModel):
    type: str
    sessionId: str
    messageId: str
    payload: Dict[str, Any]

    model_config = ConfigDict(extra="forbid")


class In(BaseModel):
    type: str
    messageId: str
    payload: Dict[str, Any]

    model_config = ConfigDict(extra="forbid")
