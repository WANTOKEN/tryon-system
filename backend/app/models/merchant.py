"""
Merchant model - 商家账户
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Integer, Boolean, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db import Base


class Merchant(Base):
    """商家账户模型"""

    __tablename__ = "merchants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    uuid: Mapped[str] = mapped_column(String(36), unique=True, default=lambda: str(uuid.uuid4()))
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(128))
    store_name: Mapped[str] = mapped_column(String(128), default="")
    store_address: Mapped[str] = mapped_column(String(256), default="")
    avatar_url: Mapped[str] = mapped_column(String(512), default="")
    email: Mapped[str] = mapped_column(String(128), default="")
    name: Mapped[str] = mapped_column(String(64), default="")

    # Role & RBAC
    role: Mapped[str] = mapped_column(String(32), default="merchant")  # merchant | super_admin
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False)
    permissions: Mapped[list[str]] = mapped_column(JSON, default=list)

    # Quota
    quota_total: Mapped[int] = mapped_column(Integer, default=100)
    quota_used: Mapped[int] = mapped_column(Integer, default=0)
    quota_remaining: Mapped[int] = mapped_column(Integer, default=100)
    quota_reset_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    # Status
    status: Mapped[int] = mapped_column(Integer, default=1)  # 0:禁用 1:正常 2:过期
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Login info
    last_login_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    last_login_ip: Mapped[str] = mapped_column(String(64), default="")

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    clothing: Mapped[list["Clothing"]] = relationship("Clothing", back_populates="merchant")
    tryon_records: Mapped[list["TryOnRecord"]] = relationship("TryOnRecord", back_populates="merchant")

    def __repr__(self):
        return f"<Merchant {self.username}>"
