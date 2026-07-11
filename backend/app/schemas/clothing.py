"""
Clothing schemas
"""
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime


class ClothingBase(BaseModel):
    name: Optional[str] = "未命名服装"
    category: Optional[str] = "upper"
    subcategory: Optional[str] = "t-shirt"
    color: Optional[str] = "#000000"
    price: Optional[int] = 0
    sizes: Optional[List[str]] = []


class ClothingCreate(ClothingBase):
    pass


class ClothingUpdate(ClothingBase):
    pass


class ClothingResponse(ClothingBase):
    id: int
    uuid: str
    merchant_id: int
    image_url: str
    image_thumb_url: str
    image_key: Optional[str] = None
    file_id: Optional[int]
    sort_order: int
    is_active: bool
    source: str
    source_text: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CategoryInfo(BaseModel):
    id: str
    name: str
    subcategories: List[dict]


class CategoriesResponse(BaseModel):
    categories: List[CategoryInfo]
