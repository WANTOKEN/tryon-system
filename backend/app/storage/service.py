"""
文件上传服务（数据库 + 存储后端 的桥接）

职责：计算 MD5、可选去重、调用存储后端、写入 FileRecord。
返回 (FileRecord, access_url, is_duplicate)。
"""
import hashlib
from typing import Tuple

from sqlalchemy import select
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
    dedup: bool = True,
) -> Tuple[FileRecord, str, bool]:
    """上传文件并落库，返回 (记录, 可访问URL, 是否命中去重)"""
    md5_hash = hashlib.md5(content).hexdigest()

    if dedup:
        existing = (
            await db.execute(
                select(FileRecord).where(
                    FileRecord.md5_hash == md5_hash, FileRecord.is_deleted == False  # noqa: E712
                )
            )
        ).scalar_one_or_none()
        if existing:
            return existing, existing.access_url, True

    ext = _EXT_MAP.get(content_type, ".bin")
    storage_key = f"{folder}/{md5_hash}{ext}"
    url = await storage.upload(content, storage_key, content_type, is_public)

    record = FileRecord(
        md5_hash=md5_hash,
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
    return record, url, False


def get_access_url(storage_key: str, is_public: bool = False, expires: int = 3600) -> str:
    return storage.get_access_url(storage_key, is_public, expires)
