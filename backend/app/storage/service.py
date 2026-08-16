"""
文件上传服务（数据库 + 存储后端 的桥接）

职责：调用存储后端、写入 FileRecord。不做去重，每次上传均为独立记录。
返回 (FileRecord, access_url)。
"""
import uuid as _uuid

from typing import Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.file_record import FileRecord
from app.storage import storage

_EXT_MAP = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


async def upload_file(
    db: AsyncSession,
    content: bytes,
    *,
    folder: str,
    tenant_id: str,
    content_type: str,
    file_category: str,
    is_public: bool = False,
) -> Tuple[FileRecord, str]:
    """上传文件并落库，返回 (记录, 可访问URL)"""
    ext = _EXT_MAP.get(content_type, ".bin")
    storage_key = f"{folder}/{_uuid.uuid4().hex}{ext}"
    url = await storage.upload(content, storage_key, content_type, is_public)

    record = FileRecord(
        storage_key=storage_key,
        access_url=url,
        file_size=len(content),
        content_type=content_type,
        file_ext=ext,
        file_category=file_category,
        folder=folder,
        tenant_id=tenant_id,
        is_public=is_public,
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return record, url


def get_access_url(storage_key: str, is_public: bool = False, expires: int = 3600) -> str:
    return storage.get_access_url(storage_key, is_public, expires)
