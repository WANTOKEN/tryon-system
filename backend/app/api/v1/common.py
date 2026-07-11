"""
Common routes - 通用接口
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db import get_db
from app.models.merchant import Merchant
from app.models.model_photo import ModelPhoto
from app.api.deps import get_optional_user

router = APIRouter()


@router.get("/model-photos/")
async def get_model_photos(
    db: AsyncSession = Depends(get_db),
    current_user: Merchant | None = Depends(get_optional_user),
    is_active: bool = None,
    page: int = 1,
    page_size: int = 50,
):
    """获取系统模特照片列表"""
    stmt = select(ModelPhoto)
    if is_active is not None:
        stmt = stmt.where(ModelPhoto.is_active == is_active)
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar()
    stmt = (
        stmt.order_by(ModelPhoto.sort_order.asc(), ModelPhoto.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    photos = (await db.execute(stmt)).scalars().all()
    items = [
        {
            "id": p.id,
            "uuid": p.uuid,
            "image_url": p.image_url,
            "image_thumb_url": p.image_thumb_url,
            "sort_order": p.sort_order,
            "is_active": p.is_active,
            "created_at": p.created_at.isoformat() if p.created_at else "",
        }
        for p in photos
    ]
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/admin-contact/")
async def get_admin_contact(
    db: AsyncSession = Depends(get_db),
):
    """获取管理员联系信息（公开接口）"""
    # 返回默认的管理员联系信息
    # 可以从环境变量或数据库配置
    return {
        "success": True,
        "data": {
            "name": "客服支持",
            "phone": "400-xxx-xxxx",
            "wechat": "AI试衣助手",
            "email": "support@example.com",
        }
    }