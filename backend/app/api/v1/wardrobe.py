"""
Wardrobe routes - 衣橱管理接口（走统一存储服务，图片真实落库可访问）
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.merchant import Merchant
from app.models.clothing import Clothing
from app.api.deps import get_current_user
from app.schemas.clothing import ClothingResponse
from app.storage.service import upload_file
from app.constants import (
    CLOTHING_CATEGORIES,
    COLOR_NAME_SET,
    CATEGORY_ID_SET,
)

router = APIRouter()

_SOURCE_TEXT = {"merchant_upload": "商家上传", "admin_upload": "后台上传"}


async def _serialize(clothing: Clothing, db: AsyncSession) -> dict:
    data = ClothingResponse.model_validate(clothing).model_dump()
    data["image_key"] = clothing.image_key or ""
    data["source_text"] = _SOURCE_TEXT.get(clothing.source, clothing.source)
    return data


@router.get("/clothing/")
async def list_clothing(
    db: AsyncSession = Depends(get_db),
    current_user: Merchant = Depends(get_current_user),
    category: str = None,
    source: str = None,
    page: int = 1,
    page_size: int = 20,
):
    """获取服装列表"""
    stmt = select(Clothing).where(Clothing.merchant_id == current_user.id, Clothing.is_active == True)  # noqa: E712
    if category:
        stmt = stmt.where(Clothing.category == category)
    if source:
        stmt = stmt.where(Clothing.source == source)

    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar()
    stmt = stmt.order_by(Clothing.created_at.desc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    items = (await db.execute(stmt)).scalars().all()

    return {
        "items": [await _serialize(i, db) for i in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/clothing/upload/")
async def upload_clothing(
    name: str = Form("未命名服装"),
    category: str = Form("tops"),
    color: str = Form(...),
    price: float = Form(0.0),
    size: str = Form("M"),
    brand: str = Form(""),
    season: str = Form("四季"),
    style: str = Form("休闲"),
    material: str = Form(""),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: Merchant = Depends(get_current_user),
):
    """上传服装图片（落本地存储 + 写 FileRecord）"""
    # 校验分类与颜色标签，保证数据规范
    if category not in CATEGORY_ID_SET:
        raise HTTPException(status_code=400, detail=f"无效的分类：{category}")
    if color not in COLOR_NAME_SET:
        raise HTTPException(status_code=400, detail=f"颜色必须是系统颜色标签之一，收到：{color}")

    content = await file.read()
    rec, url = await upload_file(
        db,
        content,
        folder="clothes",
        tenant_id=str(current_user.id),
        content_type=file.content_type or "image/png",
        file_category="image",
    )

    clothing = Clothing(
        merchant_id=current_user.id,
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
        source="merchant_upload",
    )
    db.add(clothing)
    await db.commit()
    await db.refresh(clothing)

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


@router.get("/clothing/{uuid}/")
async def get_clothing_detail(
    uuid: str,
    db: AsyncSession = Depends(get_db),
    current_user: Merchant = Depends(get_current_user),
):
    stmt = select(Clothing).where(
        Clothing.id == uuid,
        Clothing.merchant_id == current_user.id,
        Clothing.is_active == True,  # noqa: E712 软删除后详情不可再读，与列表保持一致
    )
    clothing = (await db.execute(stmt)).scalar_one_or_none()
    if not clothing:
        raise HTTPException(status_code=404, detail="Clothing not found")
    return await _serialize(clothing, db)


@router.delete("/clothing/{uuid}/")
async def delete_clothing(
    uuid: str,
    db: AsyncSession = Depends(get_db),
    current_user: Merchant = Depends(get_current_user),
):
    stmt = select(Clothing).where(Clothing.id == uuid, Clothing.merchant_id == current_user.id)
    clothing = (await db.execute(stmt)).scalar_one_or_none()
    if not clothing:
        raise HTTPException(status_code=404, detail="Clothing not found")
    clothing.is_active = False
    await db.commit()
    return {"success": True}


@router.get("/categories/")
async def get_categories():
    """获取分类配置（与前端默认分类保持一致）"""
    return CLOTHING_CATEGORIES
