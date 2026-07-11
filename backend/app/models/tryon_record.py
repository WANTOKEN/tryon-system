"""
TryOnRecord model - 试穿记录
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db import Base


class TryOnRecord(Base):
    """试穿记录模型"""

    __tablename__ = "tryon_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    uuid: Mapped[str] = mapped_column(String(36), unique=True, default=lambda: str(uuid.uuid4()), index=True)

    merchant_id: Mapped[int] = mapped_column(Integer, ForeignKey("merchants.id"), index=True)

    session_id: Mapped[str] = mapped_column(String(64), index=True)

    # Avatar
    avatar_file_id: Mapped[int] = mapped_column(Integer, ForeignKey("file_records.id"), nullable=True)
    avatar_url: Mapped[str] = mapped_column(String(512), default="")
    avatar_source: Mapped[str] = mapped_column(String(16), default="user")  # system, user, history

    # Result
    result_file_id: Mapped[int] = mapped_column(Integer, ForeignKey("file_records.id"), nullable=True)
    result_url: Mapped[str] = mapped_column(String(512), default="")

    # Status
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, processing, completed, failed
    status_text: Mapped[str] = mapped_column(String(32), default="处理中")
    error_message: Mapped[str] = mapped_column(Text, nullable=True)
    processing_time: Mapped[int] = mapped_column(Integer, nullable=True)

    # AI Engine
    ai_engine: Mapped[str] = mapped_column(String(32), default="seeddance")
    task_id: Mapped[str] = mapped_column(String(64), nullable=True)

    # Save status
    is_saved: Mapped[bool] = mapped_column(Boolean, default=False)

    # Selected clothing
    selected_clothing: Mapped[list[str]] = mapped_column(JSON, default=list)  # List of clothing UUIDs

    # Request info
    ip_address: Mapped[str] = mapped_column(String(64), default="")
    device_info: Mapped[str] = mapped_column(String(256), default="")

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
    merchant: Mapped["Merchant"] = relationship("Merchant", back_populates="tryon_records")
    avatar_file: Mapped["FileRecord"] = relationship("FileRecord", foreign_keys=[avatar_file_id])
    result_file: Mapped["FileRecord"] = relationship("FileRecord", foreign_keys=[result_file_id])

    def __repr__(self):
        return f"<TryOnRecord {self.uuid} status={self.status}>"
