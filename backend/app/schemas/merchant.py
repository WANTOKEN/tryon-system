"""
Merchant schemas
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime


class MerchantBase(BaseModel):
    username: Optional[str] = None
    phone: Optional[str] = None
    store_name: Optional[str] = None
    avatar_url: Optional[str] = None


class MerchantCreate(MerchantBase):
    username: str = Field(..., min_length=3, max_length=64)
    phone: str = Field(..., pattern=r"^1[3-9]\d{9}$")
    password: str = Field(..., min_length=6)


class MerchantUpdate(MerchantBase):
    pass


class MerchantResponse(MerchantBase):
    id: str
    role: str = "merchant"
    is_superuser: bool = False
    quota_total: int
    quota_used: int
    quota_remaining: int
    quota_reset_at: Optional[datetime]
    status: int
    is_active: bool
    last_login_at: Optional[datetime]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class QuotaAdjustRequest(BaseModel):
    quota_total: int = Field(..., ge=0)
    reason: Optional[str] = None


class QuotaResponse(BaseModel):
    quota_total: int
    quota_used: int
    quota_remaining: int
