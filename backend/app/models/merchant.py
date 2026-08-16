"""商户 / 管理员账户模型（uuid 主键）"""
from datetime import datetime, timezone

from sqlalchemy import String, Boolean, Integer, Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDMixin, TimestampMixin


class Merchant(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "merchants"

    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    phone: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(128))
    store_name: Mapped[str] = mapped_column(String(128), default="")
    role: Mapped[str] = mapped_column(String(32), default="merchant")
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[int] = mapped_column(Integer, default=1)  # 1=正常 0=禁用
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # 配额（独立语义，保留在账户上便于单次查询）
    quota_total: Mapped[int] = mapped_column(Integer, default=0)
    quota_used: Mapped[int] = mapped_column(Integer, default=0)
    quota_remaining: Mapped[int] = mapped_column(Integer, default=0)
    quota_reset_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    avatar_url: Mapped[str] = mapped_column(String(512), default="")
    remark: Mapped[str] = mapped_column(Text, default="")
