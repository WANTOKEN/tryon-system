"""
TryOn routes - 虚拟试穿接口（对齐前端契约）

前端核心流程：上传人像(/tryon/upload/avatar/) -> 选择服装 -> 提交(/tryon/generate/)
-> 轮询(/tryon/records/{uuid}/status/) -> 展示结果(result_url)
"""
import json
from typing import Optional, Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.merchant import Merchant
from app.models.tryon_record import TryOnRecord
from app.models.file_record import FileRecord
from app.api.deps import get_current_user
from app.services import tryon_service
from app.storage.service import read_upload_file, upload_file
from app.core.config import get_settings

settings = get_settings()
router = APIRouter()


async def _serialize_record(db, record) -> dict:
    """序列化的试穿记录（补齐前端历史映射所需字段）"""
    avatar_key = None
    if record.avatar_file_id:
        rec = (
            await db.execute(
                select(FileRecord).where(FileRecord.id == record.avatar_file_id)
            )
        ).scalar_one_or_none()
        if rec:
            avatar_key = rec.uuid
    return {
        "id": record.id,
        "session_id": record.session_id,
        "avatar_url": record.avatar_url,
        "avatar_source": record.avatar_source,
        "avatar_key": avatar_key,
        "result_url": record.result_url,
        "result_thumb_url": record.result_thumb_url,
        "status": record.status,
        "status_text": record.status_text,
        "engine": record.engine,
        "is_saved": record.is_saved,
        "clothing": record.selected_clothing or [],
        "error_message": record.error_message,
        "processing_time": record.duration_ms,
        "created_at": record.created_at.isoformat() if record.created_at else None,
    }


@router.post("/upload/avatar/")
async def upload_avatar(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: Merchant = Depends(get_current_user),
):
    """上传人像，返回 image_key（供 generate 复用）"""
    content = await read_upload_file(file, require_image=True)
    rec, url = await upload_file(
        db,
        content,
        folder="avatars",
        tenant_id=str(current_user.id),
        content_type=file.content_type or "image/png",
        file_category="avatar",
    )
    return {"image_key": rec.uuid, "image_url": url}


@router.post("/upload/clothing/")
async def upload_clothing_image(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: Merchant = Depends(get_current_user),
):
    """上传服装图（顾客自定义），返回 image_key"""
    content = await read_upload_file(file, require_image=True)
    rec, url = await upload_file(
        db,
        content,
        folder="clothing",
        tenant_id=str(current_user.id),
        content_type=file.content_type or "image/png",
        file_category="clothing",
    )
    return {"image_key": rec.uuid, "image_url": url}


class TryOnGenerateForm(BaseModel):
    """generate 表单模型（显式声明避免 model_key 撞 Pydantic 受保护命名空间）。"""

    model_config = ConfigDict(protected_namespaces=())

    session_id: str = Form(..., max_length=64)
    avatar_source: str = Form("user")
    avatar_key: Optional[str] = Form(None)
    model_key: Optional[str] = Form(None)
    clothing_ids: str = Form("")
    clothing_info: str = Form("[]")
    prompt: Optional[str] = Form(None)
    file: Optional[UploadFile] = File(None)


@router.post("/generate/")
async def generate_tryon(
    form: Annotated[TryOnGenerateForm, Form()],
    db: AsyncSession = Depends(get_db),
    current_user: Merchant = Depends(get_current_user),
):
    """提交试穿任务"""
    if current_user.quota_remaining <= 0:
        raise HTTPException(status_code=403, detail="Quota exhausted")

    avatar_data = (
        await read_upload_file(form.file, require_image=True) if form.file else None
    )

    # 后端以 uuid 解析服装；兼容前端传入 csv
    clothing_uuids = [c for c in (form.clothing_ids or "").split(",") if c]
    try:
        json.loads(form.clothing_info or "[]")
    except json.JSONDecodeError:
        pass

    record = await tryon_service.generate(
        db=db,
        merchant_id=current_user.id,
        session_id=form.session_id,
        avatar_data=avatar_data,
        avatar_key=form.avatar_key or form.model_key,
        avatar_source=form.avatar_source,
        clothing_uuids=clothing_uuids,
        ai_engine=settings.ai_engine,
        prompt=form.prompt,
    )

    # 扣减配额
    current_user.quota_used += 1
    current_user.quota_remaining = max(0, current_user.quota_total - current_user.quota_used)
    await db.commit()

    return {
        "record_uuid": record.id,
        "status": record.status,
        "status_text": record.status_text,
        "estimated_time": settings.mock_tryon_seconds,
        "avatar_key": form.avatar_key or form.model_key,
        "avatar_url": record.avatar_url,
    }


@router.get("/records/{uuid}/status/")
async def get_record_status(
    uuid: str,
    db: AsyncSession = Depends(get_db),
    current_user: Merchant = Depends(get_current_user),
):
    """查询试穿状态"""
    record = await tryon_service.get_status(db, uuid)
    if not record or record.merchant_id != current_user.id:
        raise HTTPException(status_code=404, detail="Record not found")
    data = await _serialize_record(db, record)
    data["progress"] = 0
    return data


@router.get("/records/")
async def list_records(
    db: AsyncSession = Depends(get_db),
    current_user: Merchant = Depends(get_current_user),
    page: int = 1,
    page_size: int = 20,
):
    """试穿记录列表"""
    items, total = await tryon_service.list_records(db, current_user.id, page, page_size)
    return {
        "items": [await _serialize_record(db, r) for r in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/records/{uuid}/save/")
async def save_record(
    uuid: str,
    save: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: Merchant = Depends(get_current_user),
):
    record = (
        await db.execute(select(TryOnRecord).where(TryOnRecord.id == uuid, TryOnRecord.merchant_id == current_user.id))
    ).scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    record.is_saved = save
    await db.commit()
    return {"success": True, "is_saved": save}


@router.delete("/records/{uuid}/")
async def delete_record(
    uuid: str,
    db: AsyncSession = Depends(get_db),
    current_user: Merchant = Depends(get_current_user),
):
    record = (
        await db.execute(select(TryOnRecord).where(TryOnRecord.id == uuid, TryOnRecord.merchant_id == current_user.id))
    ).scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    await db.delete(record)
    await db.commit()
    return {"success": True}


@router.post("/records/clear/")
async def clear_records(
    db: AsyncSession = Depends(get_db),
    current_user: Merchant = Depends(get_current_user),
):
    stmt = select(TryOnRecord).where(TryOnRecord.merchant_id == current_user.id, TryOnRecord.is_saved == False)  # noqa: E712
    records = (await db.execute(stmt)).scalars().all()
    for r in records:
        await db.delete(r)
    await db.commit()
    return {"success": True, "deleted_count": len(records)}
