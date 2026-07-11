"""
File routes - 统一文件访问接口

前端通过 /file/{uuid}/ 或 /file/by-key/{key}/ 获取图片（作为 <img src> 直接重定向到真实地址）。
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import List
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.file_record import FileRecord
from app.schemas.file import FileRecordResponse

router = APIRouter()


@router.get("/list/")
async def list_files(
    db: AsyncSession = Depends(get_db),
    page: int = 1,
    page_size: int = 20,
    file_category: str = None,
):
    """文件列表（管理后台）"""
    stmt = select(FileRecord).where(FileRecord.is_deleted == False)  # noqa: E712
    if file_category:
        stmt = stmt.where(FileRecord.file_category == file_category)

    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar()
    stmt = stmt.order_by(FileRecord.created_at.desc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    items = (await db.execute(stmt)).scalars().all()

    return {
        "items": [FileRecordResponse.model_validate(i).model_dump() for i in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{file_id}/")
async def get_file(file_id: str, db: AsyncSession = Depends(get_db)):
    """按 uuid 或 id 返回文件（重定向到可访问 URL，供 <img> 直接使用）"""
    rec = (
        await db.execute(
            select(FileRecord).where(
                (FileRecord.uuid == file_id) | (FileRecord.id == _to_int(file_id)),
                FileRecord.is_deleted == False,  # noqa: E712
            )
        )
    ).scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="File not found")
    return RedirectResponse(rec.access_url)


@router.get("/by-key/{storage_key:path}/")
async def get_file_by_key(storage_key: str, db: AsyncSession = Depends(get_db)):
    """按 storage_key 返回文件"""
    rec = (
        await db.execute(
            select(FileRecord).where(
                FileRecord.storage_key == storage_key, FileRecord.is_deleted == False  # noqa: E712
            )
        )
    ).scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="File not found")
    return RedirectResponse(rec.access_url)


@router.get("/{file_id}/info/")
async def get_file_info(file_id: str, db: AsyncSession = Depends(get_db)):
    """文件元信息"""
    rec = (
        await db.execute(
            select(FileRecord).where(
                (FileRecord.uuid == file_id) | (FileRecord.id == _to_int(file_id)),
                FileRecord.is_deleted == False,  # noqa: E712
            )
        )
    ).scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="File not found")
    return FileRecordResponse.model_validate(rec)


class SecureUrlRequest(BaseModel):
    key: str


class BulkSecureUrlRequest(BaseModel):
    keys: List[str]


@router.post("/secure-url/")
async def secure_url(payload: SecureUrlRequest, db: AsyncSession = Depends(get_db)):
    """单个文件签名 URL"""
    rec = (
        await db.execute(
            select(FileRecord).where(
                (FileRecord.uuid == payload.key) | (FileRecord.storage_key == payload.key),
                FileRecord.is_deleted == False,  # noqa: E712
            )
        )
    ).scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="File not found")
    return {"url": rec.access_url}


@router.post("/bulk-secure-url/")
async def bulk_secure_url(payload: BulkSecureUrlRequest, db: AsyncSession = Depends(get_db)):
    """批量签名 URL，返回 {key: url}"""
    result = {}
    for key in payload.keys:
        rec = (
            await db.execute(
                select(FileRecord).where(
                    (FileRecord.uuid == key) | (FileRecord.storage_key == key),
                    FileRecord.is_deleted == False,  # noqa: E712
                )
            )
        ).scalar_one_or_none()
        if rec:
            result[key] = rec.access_url
    return {"urls": result}


def _to_int(value: str) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return -1
