"""服装模型（uuid 主键 + 外键存商户 uuid）"""
from sqlalchemy import String, Integer, Boolean, Text, ForeignKey, Float
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDMixin, TimestampMixin


class Clothing(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "clothes"

    merchant_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("merchants.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(128), default="")
    # 合法取值见 constants.CATEGORY_ID_SET（tops/bottoms/dresses/outerwear/shoes/accessories）
    category: Mapped[str] = mapped_column(String(64), default="tops", index=True)
    color: Mapped[str] = mapped_column(String(32), default="")
    size: Mapped[str] = mapped_column(String(16), default="")
    brand: Mapped[str] = mapped_column(String(64), default="")
    season: Mapped[str] = mapped_column(String(32), default="")
    style: Mapped[str] = mapped_column(String(32), default="")
    material: Mapped[str] = mapped_column(String(32), default="")
    price: Mapped[float] = mapped_column(Float, default=0.0)
    description: Mapped[str] = mapped_column(Text, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    image_url: Mapped[str] = mapped_column(String(512), default="")
    image_key: Mapped[str] = mapped_column(String(64), default="")  # FileRecord.uuid
    thumb_url: Mapped[str] = mapped_column(String(512), default="")

    source: Mapped[str] = mapped_column(String(32), default="merchant_upload", index=True)
