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
from app.constants import COLOR_TAGS, CLOTHING_CATEGORIES

router = APIRouter()


@router.get("/model-photos/")
async def get_model_photos(
    db: AsyncSession = Depends(get_db),
    current_user: Merchant | None = Depends(get_optional_user),
    page: int = 1,
    page_size: int = 50,
):
    """获取系统模特照片列表"""
    stmt = select(ModelPhoto)
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar()
    stmt = (
        stmt.order_by(ModelPhoto.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    photos = (await db.execute(stmt)).scalars().all()
    items = [
        {
            "id": p.id,
            "merchant_id": p.merchant_id,
            "name": p.name,
            "image_url": p.image_url,
            "image_key": p.image_key,
            "description": p.description,
            "created_at": p.created_at.isoformat() if p.created_at else "",
        }
        for p in photos
    ]
    return {"items": items, "total": total, "page": page, "page_size": page_size}


# ---------------------------------------------------------------------------
# 枚举类公共数据（前端严格按后端返回的标签渲染）
# ---------------------------------------------------------------------------

@router.get("/colors/")
async def get_colors():
    """获取系统颜色标签列表（name 为入库值，hex 用于前端色块展示）"""
    return {"items": COLOR_TAGS}


@router.get("/categories/")
async def get_categories():
    """获取服装分类配置（固定顺序：上装->下装->连衣裙->外套->鞋->配饰）"""
    return {"items": CLOTHING_CATEGORIES}


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