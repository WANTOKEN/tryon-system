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
    id: str
    merchant_id: str
    name: str = "未命名服装"
    category: str
    color: str
    size: str
    brand: str
    season: str
    style: str
    material: str
    price: float
    description: str
    is_active: bool
    image_url: str
    image_key: str
    thumb_url: str
    source: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CategoryInfo(BaseModel):
    id: str
    name: str
    subcategories: List[dict]


class CategoriesResponse(BaseModel):
    categories: List[CategoryInfo]
