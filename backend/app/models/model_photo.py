"""模特形象模型（uuid 主键 + 外键存商户 uuid）"""
from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDMixin, TimestampMixin


class ModelPhoto(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "model_photos"

    merchant_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("merchants.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(128), default="")
    image_url: Mapped[str] = mapped_column(String(512), default="")
    image_key: Mapped[str] = mapped_column(String(64), default="")  # FileRecord.uuid
    description: Mapped[str] = mapped_column(Text, default="")
