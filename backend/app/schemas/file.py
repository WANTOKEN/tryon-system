"""
File schemas
"""
from pydantic import BaseModel, ConfigDict
from datetime import datetime


class FileRecordResponse(BaseModel):
    id: str
    uuid: str
    md5_hash: str
    storage_key: str
    access_url: str
    original_name: str
    file_size: int
    content_type: str
    file_category: str
    folder: str
    tenant_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FileUploadResponse(BaseModel):
    image_key: str
    image_url: str
