"""操作日志模型（uuid 主键 + 操作人存 uuid）"""
from sqlalchemy import String, Integer, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDMixin, TimestampMixin


class OperationLog(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "operation_logs"

    # 操作人只存 id；用户名在 /admin/operation-logs/ 出参时 join Merchant 派生，
    # 不建冗余列（PM 裁决：日志审计类字段不补冗余列）
    operator_id: Mapped[str] = mapped_column(String(32), default="", index=True)
    action: Mapped[str] = mapped_column(String(64), default="", index=True)
    target_type: Mapped[str] = mapped_column(String(32), default="", index=True)
    target_id: Mapped[str] = mapped_column(String(32), default="", index=True)
    target_name: Mapped[str] = mapped_column(String(128), default="")
    detail: Mapped[str] = mapped_column(Text, default="")
    ip: Mapped[str] = mapped_column(String(64), default="")
