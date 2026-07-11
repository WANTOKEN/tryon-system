"""
Clothing model - 服装
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db import Base


class Clothing(Base):
    """服装模型"""

    __tablename__ = "clothing"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    uuid: Mapped[str] = mapped_column(String(36), unique=True, default=lambda: str(uuid.uuid4()), index=True)

    merchant_id: Mapped[int] = mapped_column(Integer, ForeignKey("merchants.id"), index=True)

    # Basic info
    name: Mapped[str] = mapped_column(String(128), default="未命名服装")
    category: Mapped[str] = mapped_column(String(32), default="upper")  # upper, lower, dress, accessory
    subcategory: Mapped[str] = mapped_column(String(32), default="t-shirt")
    color: Mapped[str] = mapped_column(String(16), default="#000000")
    price: Mapped[int] = mapped_column(Integer, default=0)
    sizes: Mapped[list[str]] = mapped_column(JSON, default=list)  # ["S", "M", "L", "XL"]

    # Image
    file_id: Mapped[int] = mapped_column(Integer, ForeignKey("file_records.id"), nullable=True)
    image_url: Mapped[str] = mapped_column(String(512), default="")
    image_thumb_url: Mapped[str] = mapped_column(String(512), default="")

    # Sorting
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    source: Mapped[str] = mapped_column(String(32), default="merchant_upload")  # merchant_upload, preset

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
    merchant: Mapped["Merchant"] = relationship("Merchant", back_populates="clothing")
    file: Mapped["FileRecord"] = relationship("FileRecord", foreign_keys=[file_id])

    def __repr__(self):
        return f"<Clothing {self.name}>"
