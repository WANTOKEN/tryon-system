"""
File schemas
"""
from pydantic import BaseModel, ConfigDict
from datetime import datetime


class FileRecordResponse(BaseModel):
    id: int
    uuid: str
    md5_hash: str
    storage_key: str
    access_url: str
    file_size: int
    content_type: str
    file_category: str
    folder: str
    tenant_id: str
    is_public: bool
    width: int
    height: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FileUploadResponse(BaseModel):
    file_id: str
    content_key: str
    url: str
    is_duplicate: bool
