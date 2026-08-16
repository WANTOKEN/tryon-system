"""试穿记录模型（uuid 主键 + 外键存 uuid）"""
from sqlalchemy import String, Integer, Text, ForeignKey, Float, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDMixin, TimestampMixin


class TryOnRecord(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "tryon_records"

    merchant_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("merchants.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(String(32), default="", index=True)

    avatar_file_id: Mapped[str] = mapped_column(String(32), default="", index=True)
    avatar_url: Mapped[str] = mapped_column(String(512), default="")
    selected_clothing: Mapped[str] = mapped_column(Text, default="")  # 服装 uuid 列表 JSON

    engine: Mapped[str] = mapped_column(String(64), default="mock")
    engine_task_id: Mapped[str] = mapped_column(String(128), default="")

    session_id: Mapped[str] = mapped_column(String(64), default="", index=True)
    avatar_source: Mapped[str] = mapped_column(String(32), default="user")
    is_saved: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    status: Mapped[int] = mapped_column(Integer, default=0, index=True)
    status_text: Mapped[str] = mapped_column(String(64), default="pending")
    result_file_id: Mapped[str] = mapped_column(String(32), default="", index=True)
    result_url: Mapped[str] = mapped_column(String(512), default="")
    result_thumb_url: Mapped[str] = mapped_column(String(512), default="")

    error_message: Mapped[str] = mapped_column(Text, default="")
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    cost: Mapped[float] = mapped_column(Float, default=0.0)
