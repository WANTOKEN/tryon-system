"""
Clothing schemas
"""
from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional
from datetime import datetime


# 客户端可写字段：id / merchant_id / created_at 等由服务端生成，一律不接受传入
CLOTHING_EDITABLE_FIELDS = {
    "name",
    "category",
    "color",
    "price",
    "size",
    "brand",
    "season",
    "style",
    "material",
    "description",
    "image_url",
}


class ClothingCreate(BaseModel):
    """服装创建入参：全部字段可选，未传的走服务端默认值"""

    name: Optional[str] = None
    # 默认值必须是合法分类 id（CATEGORY_ID_SET 中没有 "top"）
    category: Optional[str] = "tops"
    color: Optional[str] = None
    price: Optional[float] = Field(None, ge=0)
    size: Optional[str] = None
    brand: Optional[str] = None
    season: Optional[str] = None
    style: Optional[str] = None
    material: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None


class ClothingUpdate(BaseModel):
    """服装更新入参：全部字段可选，配合 exclude_unset 只写客户端显式传入的字段"""

    name: Optional[str] = None
    category: Optional[str] = None
    color: Optional[str] = None
    price: Optional[float] = Field(None, ge=0)
    size: Optional[str] = None
    brand: Optional[str] = None
    season: Optional[str] = None
    style: Optional[str] = None
    material: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    # 软删/恢复：DELETE 接口只做下架，这里保留上架能力
    is_active: Optional[bool] = None


class ClothingResponse(BaseModel):
    id: str
    merchant_id: str = ""
    name: str = "未命名服装"
    category: str = "tops"
    color: str = ""
    size: str = ""
    brand: str = ""
    season: str = ""
    style: str = ""
    material: str = ""
    price: float = 0.0
    description: str = ""
    is_active: bool = True
    image_url: str = ""
    image_key: str = ""
    thumb_url: str = ""
    source: str = "merchant_upload"
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CategoryInfo(BaseModel):
    id: str
    name: str
    subcategories: List[dict]


class CategoriesResponse(BaseModel):
    categories: List[CategoryInfo]
