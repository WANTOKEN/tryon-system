"""系统配置模型（uuid 主键）"""
from sqlalchemy import String, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDMixin, TimestampMixin


class SystemConfig(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "system_configs"

    key: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    value: Mapped[str] = mapped_column(Text, default="")
    value_type: Mapped[str] = mapped_column(String(16), default="string")
    description: Mapped[str] = mapped_column(String(255), default="")
    is_editable: Mapped[bool] = mapped_column(Boolean, default=True)
