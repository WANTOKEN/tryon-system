"""
文件上传服务（数据库 + 存储后端 的桥接）

职责：调用存储后端、写入 FileRecord。不做去重，每次上传均为独立记录。
返回 (FileRecord, access_url)。
"""
import uuid as _uuid

from typing import Tuple

from fastapi import HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.file_record import FileRecord
from app.storage import storage

settings = get_settings()

_EXT_MAP = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


def _is_image(content: bytes) -> bool:
    """按魔数判断是否为常见图片格式（PNG/JPEG/GIF/WebP），避免信任客户端 content_type。"""
    if not content:
        return False
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return True
    if content.startswith(b"\xff\xd8\xff"):
        return True
    if content.startswith(b"GIF87a") or content.startswith(b"GIF89a"):
        return True
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return True
    return False


async def read_upload_file(
    file: UploadFile,
    max_size_mb: int | None = None,
    require_image: bool = False,
) -> bytes:
    """分块读取上传文件；超过大小上限抛 413，require_image 时校验图片魔数抛 415。"""
    limit_mb = max_size_mb if max_size_mb is not None else settings.upload_max_size_mb
    limit = limit_mb * 1024 * 1024
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > limit:
            raise HTTPException(status_code=413, detail=f"文件过大，上限 {limit_mb}MB")
        chunks.append(chunk)
    content = b"".join(chunks)
    if require_image and not _is_image(content):
        raise HTTPException(status_code=415, detail="仅支持 PNG/JPEG/WebP/GIF 图片")
    return content


async def upload_file(
    db: AsyncSession,
    content: bytes,
    *,
    folder: str,
    tenant_id: str,
    content_type: str,
    file_category: str,
) -> Tuple[FileRecord, str]:
    """上传文件并落库，返回 (记录, 可访问URL)"""
    ext = _EXT_MAP.get(content_type, ".bin")
    storage_key = f"{folder}/{_uuid.uuid4().hex}{ext}"
    url = await storage.upload(content, storage_key, content_type)

    record = FileRecord(
        storage_key=storage_key,
        access_url=url,
        file_size=len(content),
        content_type=content_type,
        file_ext=ext,
        file_category=file_category,
        folder=folder,
        tenant_id=tenant_id,
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return record, url


def get_access_url(storage_key: str, expires: int = 3600) -> str:
    return storage.get_access_url(storage_key, expires)
