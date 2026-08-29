"""文件记录模型（uuid 主键，tenant_id 存商户 uuid）"""
import uuid as _uuid

from sqlalchemy import String, Integer, Boolean, Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDMixin, TimestampMixin


class FileRecord(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "file_records"

    # 业务唯一标识（对外暴露用，区别于主键 id）
    uuid: Mapped[str] = mapped_column(String(32), unique=True, index=True, default=lambda: _uuid.uuid4().hex)

    # 归属（商户 uuid）
    tenant_id: Mapped[str] = mapped_column(String(32), index=True, default="")

    storage_key: Mapped[str] = mapped_column(String(255), index=True)
    access_url: Mapped[str] = mapped_column(String(512), default="")
    original_name: Mapped[str] = mapped_column(String(255), default="")
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    content_type: Mapped[str] = mapped_column(String(64), default="")
    file_ext: Mapped[str] = mapped_column(String(16), default="")
    file_category: Mapped[str] = mapped_column(String(32), default="image")
    folder: Mapped[str] = mapped_column(String(32), default="")

    # 保留字段（不再用于去重，生成唯一默认值避免约束冲突）
    md5_hash: Mapped[str] = mapped_column(
        String(32), unique=True, index=True, default=lambda: _uuid.uuid4().hex
    )

    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    deleted_at: Mapped[DateTime | None] = mapped_column(DateTime, nullable=True)
