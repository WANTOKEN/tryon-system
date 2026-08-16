"""配额变更历史模型（uuid 主键 + 商户 uuid 外键）"""
from sqlalchemy import String, Integer, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDMixin, TimestampMixin


class QuotaHistory(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "quota_histories"

    merchant_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("merchants.id", ondelete="CASCADE"), index=True
    )
    action: Mapped[str] = mapped_column(String(32), default="adjust", index=True)

    old_total: Mapped[int] = mapped_column(Integer, default=0)
    new_total: Mapped[int] = mapped_column(Integer, default=0)
    old_used: Mapped[int] = mapped_column(Integer, default=0)
    new_used: Mapped[int] = mapped_column(Integer, default=0)

    operator_id: Mapped[str] = mapped_column(String(32), default="")
    note: Mapped[str] = mapped_column(Text, default="")
