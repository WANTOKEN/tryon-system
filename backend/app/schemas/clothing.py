"""
Clothing schemas
"""
from pydantic import BaseModel, ConfigDict
from typing import List
from datetime import datetime


class ClothingResponse(BaseModel):
    id: str
    merchant_id: str = ""
    name: str = "未命名服装"
    category: str = "top"
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
