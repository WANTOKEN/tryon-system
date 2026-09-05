"""
TryOn schemas
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime


class TryOnGenerateRequest(BaseModel):
    session_id: str = Field(..., max_length=64)
    avatar_key: Optional[str] = None  # 使用已上传的头像
    ai_engine: Optional[str] = "seeddance"
    clothing_uuids: Optional[List[str]] = []
    custom_clothes: Optional[List[dict]] = []


class TryOnStatusResponse(BaseModel):
    id: str
    status: str
    status_text: str
    result_url: Optional[str]
    error_message: Optional[str]
    duration_ms: Optional[int]


class TryOnRecordResponse(BaseModel):
    id: str
    session_id: str
    avatar_url: str
    result_url: str
    # TryOnRecord.status 是 int（0待处理/1处理中/2完成/3失败）；
    # 声明为 str 会让 pydantic v2 拒绝 int 输入（v2 不再做 int->str 强转）导致 500
    status: int
    status_text: str
    engine: str
    is_saved: bool
    duration_ms: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TryOnSaveRequest(BaseModel):
    save: bool = True
