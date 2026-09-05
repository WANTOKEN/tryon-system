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
from app.models.quota_history import QuotaHistory
from app.api.deps import get_current_user
from app.services import hash_password
from app.services.config_service import get_grouped_configs, update_configs
from app.storage.service import upload_file
from app.schemas.merchant import QuotaAdjustRequest, MerchantCreate, MerchantUpdate, MerchantResponse
from app.schemas.clothing import (
    CLOTHING_EDITABLE_FIELDS,
    ClothingCreate,
    ClothingUpdate,
    ClothingResponse,
)
from app.schemas.tryon import TryOnRecordResponse
from app.schemas.file import FileRecordResponse
from app.core.config import get_settings
from app.constants import (
    CATEGORY_ID_SET,
    COLOR_NAME_SET,
    STATUS_TEXT_MAP,
    STATUS_LABEL_MAP,
    STATUS_COMPLETED,
)

settings = get_settings()

router = APIRouter()


def require_superadmin(current_user: Merchant = Depends(get_current_user)) -> Merchant:
    """要求超级管理员权限"""
    if not current_user.is_superuser:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="需要管理员权限")
    return current_user


async def _merchant_usernames(db: AsyncSession, operator_ids) -> dict:
    """把 operator_id 批量换成用户名（空 id 由调用方兜底为「系统」）"""
    ids = {str(i) for i in operator_ids if i}
    if not ids:
        return {}
    rows = await db.execute(
        select(Merchant.id, Merchant.username).where(Merchant.id.in_(ids))
    )
    return {str(row[0]): row[1] for row in rows}


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
        operator_id=admin.id,
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
    return {"id": merchant.id}


@router.patch("/merchants/{merchant_id}/")
async def update_merchant(
    merchant_id: str,
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
    merchant_id: str,
    quota_data: QuotaAdjustRequest,
    db: AsyncSession = Depends(get_db),
    admin: Merchant = Depends(require_superadmin),
):
    merchant = (await db.execute(select(Merchant).where(Merchant.id == merchant_id))).scalar_one_or_none()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    old_total = merchant.quota_total
    old_used = merchant.quota_used
    merchant.quota_total = quota_data.quota_total
    merchant.quota_remaining = max(0, quota_data.quota_total - merchant.quota_used)
    db.add(
        QuotaHistory(
            merchant_id=merchant.id,
            action="adjust",
            old_total=old_total,
            new_total=merchant.quota_total,
            old_used=old_used,
            new_used=merchant.quota_used,
            note=quota_data.reason or "",
            operator_id=admin.id,
        )
    )
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

    # 配额汇总（跨商家）
    quota_row = (
        await db.execute(
            select(
                func.coalesce(func.sum(Merchant.quota_total), 0),
                func.coalesce(func.sum(Merchant.quota_used), 0),
                func.coalesce(func.sum(Merchant.quota_remaining), 0),
            ).select_from(Merchant)
        )
    ).first()

    # 存储用量（非删除文件）
    total_files = (
        await db.execute(
            select(func.count()).select_from(FileRecord).where(FileRecord.is_deleted == False)  # noqa: E712
        )
    ).scalar()
    total_storage_bytes = (
        await db.execute(
            select(func.coalesce(func.sum(FileRecord.file_size), 0))
            .select_from(FileRecord)
            .where(FileRecord.is_deleted == False)  # noqa: E712
        )
    ).scalar()

    # 今日试穿统计
    today = datetime.now(timezone.utc).date()
    today_total = (
        await db.execute(
            select(func.count()).select_from(TryOnRecord).where(cast(TryOnRecord.created_at, Date) == today)
        )
    ).scalar() or 0
    today_completed = (
        await db.execute(
            select(func.count()).select_from(TryOnRecord).where(
                cast(TryOnRecord.created_at, Date) == today,
                TryOnRecord.status == STATUS_COMPLETED,
            )
        )
    ).scalar() or 0
    today_avg_time = (
        await db.execute(
            select(func.coalesce(func.avg(TryOnRecord.duration_ms), 0)).select_from(TryOnRecord).where(
                cast(TryOnRecord.created_at, Date) == today,
                TryOnRecord.status == STATUS_COMPLETED,
            )
        )
    ).scalar() or 0

    # 近 7 天试穿趋势（含成功数）
    trend = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        cnt = (
            await db.execute(
                select(func.count()).select_from(TryOnRecord).where(
                    cast(TryOnRecord.created_at, Date) == day
                )
            )
        ).scalar() or 0
        success = (
            await db.execute(
                select(func.count()).select_from(TryOnRecord).where(
                    cast(TryOnRecord.created_at, Date) == day,
                    TryOnRecord.status == STATUS_COMPLETED,
                )
            )
        ).scalar() or 0
        trend.append({"date": day.isoformat(), "count": cnt, "success_count": success})

    success_rate = round(today_completed / today_total, 4) if today_total else 0.0
    engine_stats = [
        {
            "engine": settings.ai_engine,
            "name": settings.ai_engine,
            "type": settings.ai_engine,
            "status": "running" if settings.ai_engine else "stopped",
            "count": today_total,
            "avg_time": int(today_avg_time or 0),
        }
    ]

    return {
        "today_tryon_count": today_total,
        "today_success_rate": success_rate,
        "today_avg_processing_time": int(today_avg_time or 0),
        "total_merchants": total_merchants,
        "active_merchants": active_merchants,
        "total_tryon_records": total_tryon,
        "total_clothing": total_clothing,
        "total_storage_bytes": int(total_storage_bytes or 0),
        "total_files": total_files or 0,
        "quota_total": int(quota_row[0]) if quota_row else 0,
        "quota_used": int(quota_row[1]) if quota_row else 0,
        "quota_remaining": int(quota_row[2]) if quota_row else 0,
        "tryon_trend": trend,
        "engine_stats": engine_stats,
    }


@router.get("/files/")
async def list_files(
    db: AsyncSession = Depends(get_db),
    _: Merchant = Depends(require_superadmin),
    page: int = 1,
    page_size: int = 20,
    file_category: str = None,
    search: str = None,
    is_deleted: bool = None,
):
    from app.models.file_record import FileRecord

    stmt = select(FileRecord)
    # 默认只看正常文件；传 is_deleted=true 时查看回收站（软删除文件需可恢复）
    if is_deleted is None:
        stmt = stmt.where(FileRecord.is_deleted == False)  # noqa: E712
    else:
        stmt = stmt.where(FileRecord.is_deleted == is_deleted)
    if file_category:
        stmt = stmt.where(FileRecord.file_category == file_category)
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            FileRecord.original_name.like(pattern)
            | FileRecord.storage_key.like(pattern)
            | FileRecord.tenant_id.like(pattern)
        )
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
    clothing = (await db.execute(select(Clothing).where(Clothing.id == clothing_id))).scalar_one_or_none()
    if not clothing:
        raise HTTPException(status_code=404, detail="Clothing not found")
    clothing.is_active = False
    await db.commit()
    await log_operation(db, admin, "delete_clothing", "clothing", clothing.id)
    return {"success": True}


@router.patch("/clothing/{clothing_id}/")
async def admin_update_clothing(
    clothing_id: str,
    clothing_in: ClothingUpdate,
    db: AsyncSession = Depends(get_db),
    admin: Merchant = Depends(require_superadmin),
):
    clothing = (await db.execute(select(Clothing).where(Clothing.id == clothing_id))).scalar_one_or_none()
    if not clothing:
        raise HTTPException(status_code=404, detail="Clothing not found")
    # 只写白名单内字段，杜绝客户端通过 body 覆盖 id / merchant_id / created_at
    for key, value in clothing_in.model_dump(exclude_unset=True).items():
        if key in CLOTHING_EDITABLE_FIELDS or key == "is_active":
            setattr(clothing, key, value)
    await db.commit()
    await log_operation(db, admin, "update_clothing", "clothing", clothing.id)
    return {"success": True}


@router.post("/clothing/")
async def admin_create_clothing(
    data: ClothingCreate,
    db: AsyncSession = Depends(get_db),
    admin: Merchant = Depends(require_superadmin),
):
    """管理后台创建服装记录（无图，仅超管）"""
    payload = data.model_dump(exclude_none=True)
    clothing = Clothing(
        merchant_id=admin.id,
        source="admin_upload",
        image_key="",
        thumb_url="",
        **{k: v for k, v in payload.items() if k in CLOTHING_EDITABLE_FIELDS},
    )
    clothing.name = clothing.name or "未命名服装"
    if clothing.category not in CATEGORY_ID_SET:
        clothing.category = "tops"
    if clothing.color and clothing.color not in COLOR_NAME_SET:
        raise HTTPException(
            status_code=400,
            detail=f"颜色必须是系统颜色标签之一，收到：{clothing.color}",
        )
    db.add(clothing)
    await db.commit()
    await db.refresh(clothing)
    await log_operation(db, admin, "create_clothing", "clothing", clothing.id)
    return ClothingResponse.model_validate(clothing).model_dump()


@router.post("/clothing/upload/")
async def admin_upload_clothing(
    name: str = Form("未命名服装"),
    # "top" 不在 CATEGORY_ID_SET 中，默认必须是 "tops"
    category: str = Form("tops"),
    color: str = Form(""),
    price: float = Form(0.0),
    size: str = Form("M"),
    brand: str = Form(""),
    season: str = Form("四季"),
    style: str = Form("休闲"),
    material: str = Form(""),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    admin: Merchant = Depends(require_superadmin),
):
    """管理后台上传服装图片（真实落库）"""
    # 校验分类与颜色标签，保证数据规范（与用户端 wardrobe 一致）
    if category not in CATEGORY_ID_SET:
        raise HTTPException(status_code=400, detail=f"无效的分类：{category}")
    if color and color not in COLOR_NAME_SET:
        raise HTTPException(
            status_code=400,
            detail=f"颜色必须是系统颜色标签之一，收到：{color}",
        )
    content = await file.read()
    rec, url = await upload_file(
        db,
        content,
        folder="clothes",
        tenant_id=str(admin.id),
        content_type=file.content_type or "image/png",
        file_category="image",
    )
    clothing = Clothing(
        merchant_id=admin.id,
        name=name,
        category=category,
        color=color,
        price=float(price) if isinstance(price, (int, float)) else 0.0,
        size=size,
        brand=brand,
        season=season,
        style=style,
        material=material,
        image_url=url,
        image_key=rec.uuid,
        thumb_url=url,
        source="admin_upload",
    )
    db.add(clothing)
    await db.commit()
    await db.refresh(clothing)
    await log_operation(db, admin, "upload_clothing", "clothing", clothing.id)
    return {
        "id": clothing.id,
        "name": clothing.name,
        "category": clothing.category,
        "color": clothing.color,
        "price": clothing.price,
        "size": clothing.size,
        "image_url": url,
        "thumb_url": url,
        "image_key": rec.uuid,
    }


@router.get("/tryon-records/")
async def admin_list_records(
    db: AsyncSession = Depends(get_db),
    _: Merchant = Depends(require_superadmin),
    page: int = 1,
    page_size: int = 20,
    merchant_id: str = None,
    status: str = None,
):
    stmt = select(TryOnRecord)
    if merchant_id:
        stmt = stmt.where(TryOnRecord.merchant_id == merchant_id)
    if status:
        # 前端传语义字符串（pending/processing/completed/failed），也兼容中文文案
        code = next(
            (k for k, v in STATUS_TEXT_MAP.items() if v == status),
            next((k for k, v in STATUS_LABEL_MAP.items() if v == status), None),
        )
        if code is None:
            stmt = stmt.where(TryOnRecord.status == -1)  # 未知状态：返回空列表而不是全量
        else:
            stmt = stmt.where(TryOnRecord.status == code)
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar()
    stmt = stmt.order_by(TryOnRecord.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    items = (await db.execute(stmt)).scalars().all()

    # 附带商户名称，避免前端只能渲染 merchant_id
    merchant_names = {}
    if items:
        ids = {r.merchant_id for r in items if r.merchant_id}
        rows = (await db.execute(select(Merchant.id, Merchant.store_name).where(Merchant.id.in_(ids)))).all()
        merchant_names = {str(row[0]): row[1] for row in rows}

    records = []
    for r in items:
        data = TryOnRecordResponse.model_validate(r).model_dump()
        data["status"] = STATUS_TEXT_MAP.get(r.status, "pending")
        data["status_text"] = STATUS_LABEL_MAP.get(r.status, r.status_text)
        data["merchant_name"] = merchant_names.get(str(r.merchant_id), "")
        records.append(data)

    return {
        "items": records,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# ===== 商家删除 / 配额重置 =====
@router.delete("/merchants/{merchant_id}/")
async def delete_merchant(
    merchant_id: str,
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
    merchant_id: str,
    db: AsyncSession = Depends(get_db),
    admin: Merchant = Depends(require_superadmin),
):
    merchant = (
        await db.execute(select(Merchant).where(Merchant.id == merchant_id))
    ).scalar_one_or_none()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    old_used = merchant.quota_used
    merchant.quota_used = 0
    merchant.quota_remaining = merchant.quota_total
    db.add(
        QuotaHistory(
            merchant_id=merchant.id,
            action="reset",
            old_total=merchant.quota_total,
            new_total=merchant.quota_total,
            old_used=old_used,
            new_used=0,
            note="",
            operator_id=admin.id,
        )
    )
    await db.commit()
    await log_operation(db, admin, "quota_reset", "merchant", str(merchant.id), merchant.username)
    return {
        "quota_total": merchant.quota_total,
        "quota_used": merchant.quota_used,
        "quota_remaining": merchant.quota_remaining,
    }


@router.get("/merchants/{merchant_id}/quota/history/")
async def get_merchant_quota_history(
    merchant_id: str,
    db: AsyncSession = Depends(get_db),
    _: Merchant = Depends(require_superadmin),
    days: int = 30,
):
    """查询商家配额调整/重置历史（管理后台「配额历史」抽屉）"""
    if days <= 0 or days > 365:
        days = 30
    since = datetime.now(timezone.utc) - timedelta(days=days)
    stmt = (
        select(QuotaHistory)
        .where(QuotaHistory.merchant_id == merchant_id)
        .where(QuotaHistory.created_at >= since)
        .order_by(QuotaHistory.created_at.desc())
    )
    rows = (await db.execute(stmt)).scalars().all()
    # operator_username 出参时 join Merchant 派生，不在表里冗余存用户名列
    operator_names = await _merchant_usernames(db, [h.operator_id for h in rows])
    return [
        {
            "id": h.id,
            "merchant_id": h.merchant_id,
            "action": h.action,
            "old_total": h.old_total,
            "new_total": h.new_total,
            "old_used": h.old_used,
            "new_used": h.new_used,
            "note": h.note,
            "operator_id": h.operator_id,
            "operator_username": operator_names.get(h.operator_id or "", "系统"),
            "created_at": h.created_at.isoformat() if h.created_at else "",
        }
        for h in rows
    ]


# ===== 系统配置（设置页面） =====
class ConfigBatchRequest(BaseModel):
    configs: dict = {}          # {key: value}
    value_types: dict = {}      # {key: value_type}


@router.get("/system/config/grouped/")
async def get_config_grouped(
    db: AsyncSession = Depends(get_db),
    _: Merchant = Depends(require_superadmin),
):
    """按分组返回系统配置（对齐前端 GroupedConfig）"""
    return await get_grouped_configs(db)


@router.post("/system/config/batch/")
async def batch_update_configs(
    payload: ConfigBatchRequest,
    db: AsyncSession = Depends(get_db),
    admin: Merchant = Depends(require_superadmin),
):
    """批量更新系统配置"""
    if not isinstance(payload.configs, dict) or not payload.configs:
        raise HTTPException(status_code=400, detail="configs 必须是非空对象")
    updated = await update_configs(db, payload.configs, payload.value_types)
    await log_operation(
        db, admin, "update_config", "system_config", "",
        f"updated={updated}",
    )
    return {"success": True, "updated": updated}


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
    deleted_files = (
        await db.execute(
            select(func.count()).select_from(FileRecord).where(FileRecord.is_deleted == True)  # noqa: E712
        )
    ).scalar()
    deleted_size = (
        await db.execute(
            select(func.coalesce(func.sum(FileRecord.file_size), 0))
            .select_from(FileRecord)
            .where(FileRecord.is_deleted == True)  # noqa: E712
        )
    ).scalar()
    # quota_* 恒为 0 且与文件统计无关（配额在 Merchant 上），已移除
    return {
        "total_files": total or 0,
        "total_storage_bytes": int(total_bytes or 0),
        "deleted_files": deleted_files or 0,
        "deleted_size": int(deleted_size or 0),
    }


class FileBatchRequest(BaseModel):
    # FileRecord.id 是 uuid hex 字符串，声明为 int 会导致批量操作永远匹配不到记录
    ids: List[str]
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
    record_id: str,
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
        try:
            fields = await request.json()
        except Exception:
            fields = {}
    if not image_bytes:
        raise HTTPException(status_code=400, detail="请上传模特照片")
    rec, url = await upload_file(
        db,
        image_bytes,
        folder="models",
        tenant_id=str(admin.id),
        content_type=image_content_type or "image/png",
        file_category="image",
    )
    photo = ModelPhoto(
        merchant_id=str(admin.id),
        name=fields.get("name", ""),
        image_url=url,
        image_key=rec.uuid,
        description=fields.get("description", ""),
    )
    db.add(photo)
    await db.commit()
    await db.refresh(photo)
    await log_operation(db, admin, "create_model", "model_photo", str(photo.id))
    return {
        "id": photo.id,
        "merchant_id": photo.merchant_id,
        "name": photo.name,
        "image_url": photo.image_url,
        "image_key": photo.image_key,
        "description": photo.description,
        "created_at": photo.created_at.isoformat() if photo.created_at else "",
    }


@router.patch("/model-photos/{photo_id}/")
async def admin_update_model_photo(
    photo_id: str,
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
        try:
            fields = await request.json()
        except Exception:
            fields = {}
    if "name" in fields:
        photo.name = fields["name"]
    if "description" in fields:
        photo.description = fields["description"]
    if image_bytes:
        rec, url = await upload_file(
            db,
            image_bytes,
            folder="models",
            tenant_id=str(admin.id),
            content_type=image_content_type or "image/png",
            file_category="image",
        )
        photo.image_url = url
        photo.image_key = rec.uuid
    await db.commit()
    await log_operation(db, admin, "update_model", "model_photo", str(photo.id))
    return {
        "id": photo.id,
        "merchant_id": photo.merchant_id,
        "name": photo.name,
        "image_url": photo.image_url,
        "image_key": photo.image_key,
        "description": photo.description,
        "created_at": photo.created_at.isoformat() if photo.created_at else "",
    }


@router.delete("/model-photos/{photo_id}/")
async def admin_delete_model_photo(
    photo_id: str,
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
    user_id: str,
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
    user_id: str,
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

    # 只查本页涉及的 operator_id，一次 join 出用户名，避免逐条回查
    operator_names = await _merchant_usernames(db, [r.operator_id for r in rows])

    items = [
        {
            "id": r.id,
            "operator_id": r.operator_id,
            "operator_username": operator_names.get(r.operator_id or "", "系统"),
            "action": r.action,
            "action_text": ACTION_TEXT_MAP.get(r.action, r.action),
            "target_type": r.target_type,
            "target_id": r.target_id,
            "target_name": r.target_name,
            "detail": _safe_detail(r.detail),
            "ip": r.ip,
            "created_at": r.created_at.isoformat() if r.created_at else "",
        }
        for r in rows
    ]
    return {"items": items, "total": total, "page": page, "page_size": page_size}
