"""
Admin routes - 管理后台接口

权限：所有接口要求 is_superuser（首次启动自动创建的 admin 账号即超管）。
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Request
from pydantic import BaseModel
from sqlalchemy import select, func, cast, Date
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta, timezone
from typing import List, Optional
import json

from app.db import get_db
from app.models.merchant import Merchant
from app.models.clothing import Clothing
from app.models.tryon_record import TryOnRecord
from app.models.file_record import FileRecord
from app.models.model_photo import ModelPhoto
from app.models.operation_log import OperationLog
from app.api.deps import get_current_user
from app.services import hash_password
from app.storage.service import upload_file
from app.schemas.merchant import QuotaAdjustRequest, MerchantCreate, MerchantUpdate, MerchantResponse
from app.schemas.clothing import ClothingResponse, ClothingUpdate, ClothingCreate
from app.schemas.tryon import TryOnRecordResponse
from app.schemas.file import FileRecordResponse

router = APIRouter()


def require_superadmin(current_user: Merchant = Depends(get_current_user)) -> Merchant:
    """要求超级管理员权限"""
    if not current_user.is_superuser:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="需要管理员权限")
    return current_user


async def log_operation(
    db: AsyncSession,
    admin: Merchant,
    action: str,
    target_type: str = "",
    target_id: str = "",
    target_name: str = "",
    detail: str = "",
    ip: str = "",
):
    """记录后台操作日志"""
    log = OperationLog(
        admin_id=admin.id,
        admin_username=admin.username,
        action=action,
        target_type=target_type,
        target_id=str(target_id),
        target_name=target_name,
        detail=detail,
        ip=ip,
    )
    db.add(log)
    await db.commit()


# 操作日志中文映射（前端 valueEnum 未覆盖的 action 也提供可读文本）
ACTION_TEXT_MAP = {
    "create_merchant": "创建商家",
    "update_merchant": "更新商家",
    "delete_merchant": "删除商家",
    "quota_adjust": "配额调整",
    "quota_reset": "配额重置",
    "batch_files": "文件批量操作",
    "cleanup_files": "清理文件",
    "delete_clothing": "删除服装",
    "update_clothing": "更新服装",
    "create_clothing": "创建服装",
    "upload_clothing": "上传服装",
    "delete_record": "删除试穿记录",
    "create_model": "上传模特",
    "update_model": "更新模特",
    "delete_model": "删除模特",
    "create_admin": "创建管理员",
    "update_admin": "更新管理员",
    "delete_admin": "删除管理员",
}


# ===== 后台管理员账号（复用 Merchant，is_superuser=True） =====
class AdminUserCreate(BaseModel):
    username: str
    phone: str
    password: str
    store_name: str = ""
    is_superuser: bool = True


class AdminUserUpdate(BaseModel):
    phone: Optional[str] = None
    store_name: Optional[str] = None
    is_superuser: Optional[bool] = None
    password: Optional[str] = None


@router.get("/merchants/")
async def list_merchants(
    db: AsyncSession = Depends(get_db),
    _: Merchant = Depends(require_superadmin),
    page: int = 1,
    page_size: int = 20,
    search: str = None,
    status_filter: int = None,
):
    stmt = select(Merchant)
    if search:
        stmt = stmt.where(Merchant.username.contains(search) | Merchant.store_name.contains(search))
    if status_filter is not None:
        stmt = stmt.where(Merchant.status == status_filter)

    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar()
    stmt = stmt.order_by(Merchant.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    items = (await db.execute(stmt)).scalars().all()
    return {
        "items": [MerchantResponse.model_validate(m).model_dump() for m in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/merchants/")
async def create_merchant(
    merchant_in: MerchantCreate,
    db: AsyncSession = Depends(get_db),
    admin: Merchant = Depends(require_superadmin),
):
    existing = (
        await db.execute(select(Merchant).where(Merchant.username == merchant_in.username))
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="用户名已存在")

    merchant = Merchant(
        username=merchant_in.username,
        phone=merchant_in.phone,
        password_hash=hash_password(merchant_in.password),
        store_name=merchant_in.store_name or "",
        role="merchant",
        is_superuser=False,
    )
    db.add(merchant)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="用户名或手机号已存在",
        )
    await db.refresh(merchant)
    await log_operation(db, admin, "create_merchant", "merchant", str(merchant.id), merchant.username)
    return {"id": merchant.id, "uuid": merchant.uuid}


@router.patch("/merchants/{merchant_id}/")
async def update_merchant(
    merchant_id: int,
    merchant_in: MerchantUpdate,
    db: AsyncSession = Depends(get_db),
    admin: Merchant = Depends(require_superadmin),
):
    merchant = (await db.execute(select(Merchant).where(Merchant.id == merchant_id))).scalar_one_or_none()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    for key, value in merchant_in.model_dump(exclude_unset=True).items():
        setattr(merchant, key, value)
    await db.commit()
    await log_operation(db, admin, "update_merchant", "merchant", str(merchant.id), merchant.username)
    return {"success": True}


@router.patch("/merchants/{merchant_id}/quota/")
async def adjust_quota(
    merchant_id: int,
    quota_data: QuotaAdjustRequest,
    db: AsyncSession = Depends(get_db),
    admin: Merchant = Depends(require_superadmin),
):
    merchant = (await db.execute(select(Merchant).where(Merchant.id == merchant_id))).scalar_one_or_none()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    merchant.quota_total = quota_data.quota_total
    merchant.quota_remaining = max(0, quota_data.quota_total - merchant.quota_used)
    await db.commit()
    await log_operation(db, admin, "quota_adjust", "merchant", str(merchant.id), merchant.username)
    return {
        "quota_total": merchant.quota_total,
        "quota_used": merchant.quota_used,
        "quota_remaining": merchant.quota_remaining,
    }


@router.get("/system/stats/")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _: Merchant = Depends(require_superadmin),
):
    total_merchants = (await db.execute(select(func.count()).select_from(Merchant))).scalar()
    active_merchants = (
        await db.execute(select(func.count()).select_from(Merchant).where(Merchant.status == 1))
    ).scalar()
    total_tryon = (await db.execute(select(func.count()).select_from(TryOnRecord))).scalar()
    total_clothing = (await db.execute(select(func.count()).select_from(Clothing))).scalar()

    # 近 7 天试穿趋势
    trend = []
    for i in range(6, -1, -1):
        day = datetime.now(timezone.utc).date() - timedelta(days=i)
        cnt = (
            await db.execute(
                select(func.count()).select_from(TryOnRecord).where(
                    cast(TryOnRecord.created_at, Date) == day
                )
            )
        ).scalar()
        trend.append({"date": day.isoformat(), "count": cnt or 0, "success_count": cnt or 0})

    return {
        "today_tryon_count": trend[-1]["count"],
        "today_success_rate": 1.0,
        "today_avg_processing_time": 0,
        "total_merchants": total_merchants,
        "active_merchants": active_merchants,
        "total_tryon_records": total_tryon,
        "total_clothing": total_clothing,
        "total_storage_bytes": 0,
        "total_files": 0,
        "quota_total": 0,
        "quota_used": 0,
        "quota_remaining": 0,
        "tryon_trend": trend,
        "engine_stats": [],
    }


@router.get("/files/")
async def list_files(
    db: AsyncSession = Depends(get_db),
    _: Merchant = Depends(require_superadmin),
    page: int = 1,
    page_size: int = 20,
    file_category: str = None,
):
    from app.models.file_record import FileRecord

    stmt = select(FileRecord).where(FileRecord.is_deleted == False)  # noqa: E712
    if file_category:
        stmt = stmt.where(FileRecord.file_category == file_category)
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar()
    stmt = stmt.order_by(FileRecord.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    items = (await db.execute(stmt)).scalars().all()
    return {
        "items": [FileRecordResponse.model_validate(i).model_dump() for i in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/clothing/")
async def admin_list_clothing(
    db: AsyncSession = Depends(get_db),
    _: Merchant = Depends(require_superadmin),
    page: int = 1,
    page_size: int = 20,
    name: str = None,
    category: str = None,
):
    stmt = select(Clothing).where(Clothing.is_active == True)  # noqa: E712
    if name:
        stmt = stmt.where(Clothing.name.contains(name))
    if category:
        stmt = stmt.where(Clothing.category == category)
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar()
    stmt = stmt.order_by(Clothing.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    items = (await db.execute(stmt)).scalars().all()
    return {
        "items": [ClothingResponse.model_validate(c).model_dump() for c in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.delete("/clothing/{clothing_id}/")
async def admin_delete_clothing(
    clothing_id: str,
    db: AsyncSession = Depends(get_db),
    admin: Merchant = Depends(require_superadmin),
):
    clothing = (await db.execute(select(Clothing).where(Clothing.uuid == clothing_id))).scalar_one_or_none()
    if not clothing:
        raise HTTPException(status_code=404, detail="Clothing not found")
    clothing.is_active = False
    await db.commit()
    await log_operation(db, admin, "delete_clothing", "clothing", clothing.uuid)
    return {"success": True}


@router.patch("/clothing/{clothing_id}/")
async def admin_update_clothing(
    clothing_id: str,
    clothing_in: ClothingUpdate,
    db: AsyncSession = Depends(get_db),
    admin: Merchant = Depends(require_superadmin),
):
    clothing = (await db.execute(select(Clothing).where(Clothing.uuid == clothing_id))).scalar_one_or_none()
    if not clothing:
        raise HTTPException(status_code=404, detail="Clothing not found")
    for key, value in clothing_in.model_dump(exclude_unset=True).items():
        setattr(clothing, key, value)
    await db.commit()
    await log_operation(db, admin, "update_clothing", "clothing", clothing.uuid)
    return {"success": True}


@router.post("/clothing/")
async def admin_create_clothing(
    data: ClothingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Merchant = Depends(get_current_user),
):
    """管理后台创建服装记录（无图）"""
    clothing = Clothing(
        merchant_id=current_user.id,
        name=data.name,
        category=data.category,
        subcategory=data.subcategory,
        color=data.color,
        price=data.price,
        sizes=data.sizes,
        image_url="",
        image_thumb_url="",
        source="admin_upload",
    )
    db.add(clothing)
    await db.commit()
    await db.refresh(clothing)
    await log_operation(db, current_user, "create_clothing", "clothing", clothing.uuid)
    return ClothingResponse.model_validate(clothing).model_dump()


@router.post("/clothing/upload/")
async def admin_upload_clothing(
    name: str = Form("未命名服装"),
    category: str = Form("upper"),
    subcategory: str = Form("t-shirt"),
    color: str = Form("#000000"),
    price: int = Form(0),
    sizes: str = Form("[]"),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: Merchant = Depends(get_current_user),
):
    """管理后台上传服装图片（真实落库）"""
    content = await file.read()
    rec, url, is_dup = await upload_file(
        db,
        content,
        folder="clothing",
        tenant_id=str(current_user.id),
        content_type=file.content_type or "image/png",
        file_category="clothing",
    )
    clothing = Clothing(
        merchant_id=current_user.id,
        name=name,
        category=category,
        subcategory=subcategory,
        color=color,
        price=price,
        sizes=json.loads(sizes) if isinstance(sizes, str) else sizes,
        image_url=url,
        image_thumb_url=url,
        file_id=rec.id,
        source="admin_upload",
    )
    db.add(clothing)
    await db.commit()
    await db.refresh(clothing)
    await log_operation(db, current_user, "upload_clothing", "clothing", clothing.uuid)
    return {
        "uuid": clothing.uuid,
        "name": clothing.name,
        "category": clothing.category,
        "subcategory": clothing.subcategory,
        "color": clothing.color,
        "price": clothing.price,
        "image_url": url,
        "image_thumb_url": url,
        "image_key": rec.uuid,
        "is_duplicate": is_dup,
    }


@router.get("/tryon-records/")
async def admin_list_records(
    db: AsyncSession = Depends(get_db),
    _: Merchant = Depends(require_superadmin),
    page: int = 1,
    page_size: int = 20,
    merchant_id: int = None,
    status: str = None,
):
    stmt = select(TryOnRecord)
    if merchant_id:
        stmt = stmt.where(TryOnRecord.merchant_id == merchant_id)
    if status:
        stmt = stmt.where(TryOnRecord.status == status)
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar()
    stmt = stmt.order_by(TryOnRecord.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    items = (await db.execute(stmt)).scalars().all()
    return {
        "items": [TryOnRecordResponse.model_validate(r).model_dump() for r in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# ===== 商家删除 / 配额重置 =====
@router.delete("/merchants/{merchant_id}/")
async def delete_merchant(
    merchant_id: int,
    db: AsyncSession = Depends(get_db),
    admin: Merchant = Depends(require_superadmin),
):
    merchant = (
        await db.execute(select(Merchant).where(Merchant.id == merchant_id))
    ).scalar_one_or_none()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    merchant.is_active = False
    merchant.status = 0
    await db.commit()
    await log_operation(db, admin, "delete_merchant", "merchant", str(merchant.id), merchant.username)
    return {"success": True}


@router.post("/merchants/{merchant_id}/quota/reset/")
async def reset_quota(
    merchant_id: int,
    db: AsyncSession = Depends(get_db),
    admin: Merchant = Depends(require_superadmin),
):
    merchant = (
        await db.execute(select(Merchant).where(Merchant.id == merchant_id))
    ).scalar_one_or_none()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    merchant.quota_used = 0
    merchant.quota_remaining = merchant.quota_total
    await db.commit()
    await log_operation(db, admin, "quota_reset", "merchant", str(merchant.id), merchant.username)
    return {
        "quota_total": merchant.quota_total,
        "quota_used": merchant.quota_used,
        "quota_remaining": merchant.quota_remaining,
    }


# ===== 文件统计 / 批量操作 / 清理 =====
@router.get("/files/stats/")
async def files_stats(
    db: AsyncSession = Depends(get_db),
    _: Merchant = Depends(require_superadmin),
):
    total = (
        await db.execute(
            select(func.count()).select_from(FileRecord).where(FileRecord.is_deleted == False)  # noqa: E712
        )
    ).scalar()
    total_bytes = (
        await db.execute(
            select(func.coalesce(func.sum(FileRecord.file_size), 0))
            .select_from(FileRecord)
            .where(FileRecord.is_deleted == False)  # noqa: E712
        )
    ).scalar()
    return {
        "total_files": total or 0,
        "total_storage_bytes": int(total_bytes or 0),
        "quota_total": 0,
        "quota_used": 0,
        "quota_remaining": 0,
    }


class FileBatchRequest(BaseModel):
    ids: List[int]
    action: str  # soft_delete | restore | hard_delete


@router.post("/files/batch/")
async def files_batch(
    payload: FileBatchRequest,
    db: AsyncSession = Depends(get_db),
    admin: Merchant = Depends(require_superadmin),
):
    records = (
        await db.execute(select(FileRecord).where(FileRecord.id.in_(payload.ids)))
    ).scalars().all()
    if payload.action == "soft_delete":
        for r in records:
            r.is_deleted = True
    elif payload.action == "restore":
        for r in records:
            r.is_deleted = False
    elif payload.action == "hard_delete":
        for r in records:
            await db.delete(r)
    else:
        raise HTTPException(status_code=400, detail="未知操作")
    await db.commit()
    await log_operation(
        db, admin, "batch_files", "file", "",
        f"action={payload.action}, count={len(records)}",
    )
    return {"success": True, "affected": len(records)}


class FileCleanupRequest(BaseModel):
    days: int = 30


@router.post("/files/cleanup/")
async def files_cleanup(
    payload: FileCleanupRequest,
    db: AsyncSession = Depends(get_db),
    admin: Merchant = Depends(require_superadmin),
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=payload.days)
    old = (
        await db.execute(
            select(FileRecord).where(
                FileRecord.is_deleted == True,  # noqa: E712
                FileRecord.updated_at < cutoff,
            )
        )
    ).scalars().all()
    for r in old:
        await db.delete(r)
    await db.commit()
    await log_operation(db, admin, "cleanup_files", "file", "", f"deleted={len(old)}")
    return {"success": True, "deleted": len(old)}


# ===== 试穿记录删除（管理后台） =====
@router.delete("/tryon-records/{record_id}/")
async def admin_delete_record(
    record_id: int,
    db: AsyncSession = Depends(get_db),
    admin: Merchant = Depends(require_superadmin),
):
    rec = (
        await db.execute(select(TryOnRecord).where(TryOnRecord.id == record_id))
    ).scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Record not found")
    await db.delete(rec)
    await db.commit()
    await log_operation(db, admin, "delete_record", "tryon_record", str(record_id))
    return {"success": True}


# ===== 模特库管理 =====
@router.post("/model-photos/")
async def admin_create_model_photo(
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: Merchant = Depends(require_superadmin),
):
    content_type = request.headers.get("content-type", "")
    image_bytes = None
    image_content_type = None
    fields: dict = {}
    if "multipart/form-data" in content_type:
        form = await request.form()
        for k, v in form.items():
            if k == "image" and hasattr(v, "read"):
                image_bytes = await v.read()
                image_content_type = v.content_type
            else:
                fields[k] = v
    else:
        fields = await request.json()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="请上传模特照片")
    rec, url, _ = await upload_file(
        db,
        image_bytes,
        folder="model",
        tenant_id=str(admin.id),
        content_type=image_content_type or "image/png",
        file_category="model",
    )
    photo = ModelPhoto(
        image_url=url,
        image_thumb_url=url,
        file_id=rec.id,
        sort_order=int(fields.get("sort_order") or 0),
        is_active=str(fields.get("is_active", "true")).lower() in ("true", "1", "yes"),
    )
    db.add(photo)
    await db.commit()
    await db.refresh(photo)
    await log_operation(db, admin, "create_model", "model_photo", str(photo.id))
    return {
        "id": photo.id,
        "uuid": photo.uuid,
        "image_url": photo.image_url,
        "image_thumb_url": photo.image_thumb_url,
        "sort_order": photo.sort_order,
        "is_active": photo.is_active,
        "created_at": photo.created_at.isoformat() if photo.created_at else "",
    }


@router.patch("/model-photos/{photo_id}/")
async def admin_update_model_photo(
    photo_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: Merchant = Depends(require_superadmin),
):
    photo = (
        await db.execute(select(ModelPhoto).where(ModelPhoto.id == photo_id))
    ).scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="ModelPhoto not found")
    content_type = request.headers.get("content-type", "")
    image_bytes = None
    image_content_type = None
    fields: dict = {}
    if "multipart/form-data" in content_type:
        form = await request.form()
        for k, v in form.items():
            if k == "image" and hasattr(v, "read"):
                image_bytes = await v.read()
                image_content_type = v.content_type
            else:
                fields[k] = v
    else:
        fields = await request.json()
    if "is_active" in fields:
        photo.is_active = str(fields["is_active"]).lower() in ("true", "1", "yes")
    if "sort_order" in fields:
        try:
            photo.sort_order = int(fields["sort_order"])
        except (ValueError, TypeError):
            pass
    if image_bytes:
        rec, url, _ = await upload_file(
            db,
            image_bytes,
            folder="model",
            tenant_id=str(admin.id),
            content_type=image_content_type or "image/png",
            file_category="model",
        )
        photo.image_url = url
        photo.image_thumb_url = url
        photo.file_id = rec.id
    await db.commit()
    await log_operation(db, admin, "update_model", "model_photo", str(photo.id))
    return {
        "id": photo.id,
        "uuid": photo.uuid,
        "image_url": photo.image_url,
        "image_thumb_url": photo.image_thumb_url,
        "sort_order": photo.sort_order,
        "is_active": photo.is_active,
        "created_at": photo.created_at.isoformat() if photo.created_at else "",
    }


@router.delete("/model-photos/{photo_id}/")
async def admin_delete_model_photo(
    photo_id: int,
    db: AsyncSession = Depends(get_db),
    admin: Merchant = Depends(require_superadmin),
):
    photo = (
        await db.execute(select(ModelPhoto).where(ModelPhoto.id == photo_id))
    ).scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="ModelPhoto not found")
    await db.delete(photo)
    await db.commit()
    await log_operation(db, admin, "delete_model", "model_photo", str(photo.id))
    return {"success": True}


# ===== 后台管理员账号（复用 Merchant，is_superuser=True） =====
@router.get("/admin-users/")
async def list_admin_users(
    db: AsyncSession = Depends(get_db),
    _: Merchant = Depends(require_superadmin),
    page: int = 1,
    page_size: int = 20,
    search: str = None,
):
    stmt = select(Merchant).where(Merchant.is_superuser == True)  # noqa: E712
    if search:
        stmt = stmt.where(Merchant.username.contains(search))
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar()
    stmt = stmt.order_by(Merchant.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    items = (await db.execute(stmt)).scalars().all()
    return {
        "items": [MerchantResponse.model_validate(m).model_dump() for m in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/admin-users/")
async def create_admin_user(
    data: AdminUserCreate,
    db: AsyncSession = Depends(get_db),
    admin: Merchant = Depends(require_superadmin),
):
    existing = (
        await db.execute(
            select(Merchant).where(
                (Merchant.username == data.username) | (Merchant.phone == data.phone)
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="用户名或手机号已存在")
    user = Merchant(
        username=data.username,
        phone=data.phone,
        password_hash=hash_password(data.password),
        store_name=data.store_name or "",
        role="merchant",
        is_superuser=data.is_superuser,
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="用户名或手机号已存在")
    await db.refresh(user)
    await log_operation(db, admin, "create_admin", "admin_user", str(user.id), user.username)
    return MerchantResponse.model_validate(user).model_dump()


@router.patch("/admin-users/{user_id}/")
async def update_admin_user(
    user_id: int,
    data: AdminUserUpdate,
    db: AsyncSession = Depends(get_db),
    admin: Merchant = Depends(require_superadmin),
):
    user = (
        await db.execute(
            select(Merchant).where(Merchant.id == user_id, Merchant.is_superuser == True)  # noqa: E712
        )
    ).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Admin user not found")
    if data.phone is not None:
        user.phone = data.phone
    if data.store_name is not None:
        user.store_name = data.store_name
    if data.is_superuser is not None:
        user.is_superuser = data.is_superuser
    if data.password:
        user.password_hash = hash_password(data.password)
    await db.commit()
    await log_operation(db, admin, "update_admin", "admin_user", str(user.id), user.username)
    return MerchantResponse.model_validate(user).model_dump()


@router.delete("/admin-users/{user_id}/")
async def delete_admin_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: Merchant = Depends(require_superadmin),
):
    user = (
        await db.execute(
            select(Merchant).where(Merchant.id == user_id, Merchant.is_superuser == True)  # noqa: E712
        )
    ).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Admin user not found")
    user.is_active = False
    user.status = 0
    await db.commit()
    await log_operation(db, admin, "delete_admin", "admin_user", str(user.id), user.username)
    return {"success": True}


# ===== 操作日志 =====
@router.get("/operation-logs/")
async def list_operation_logs(
    db: AsyncSession = Depends(get_db),
    _: Merchant = Depends(require_superadmin),
    page: int = 1,
    page_size: int = 20,
    action: str = None,
    days: int = None,
):
    stmt = select(OperationLog)
    if action:
        stmt = stmt.where(OperationLog.action == action)
    if days:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        stmt = stmt.where(OperationLog.created_at >= cutoff)
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar()
    stmt = stmt.order_by(OperationLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(stmt)).scalars().all()

    def _safe_detail(d):
        if not d:
            return {}
        try:
            return json.loads(d)
        except (ValueError, TypeError):
            return {"raw": d}

    items = [
        {
            "id": r.id,
            "admin_username": r.admin_username,
            "action": r.action,
            "action_text": ACTION_TEXT_MAP.get(r.action, r.action),
            "target_type": r.target_type,
            "target_id": r.target_id,
            "target_name": r.target_name,
            "detail": _safe_detail(r.detail),
            "ip_address": r.ip,
            "created_at": r.created_at.isoformat() if r.created_at else "",
        }
        for r in rows
    ]
    return {"items": items, "total": total, "page": page, "page_size": page_size}
