"""
FileRecord model - 文件记录
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Integer, Boolean, DateTime, BigInteger
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base


class FileRecord(Base):
    """文件记录模型 - 存储元数据（本地磁盘）"""

    __tablename__ = "file_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    uuid: Mapped[str] = mapped_column(String(36), unique=True, default=lambda: str(uuid.uuid4()), index=True)

    # Content hash (for deduplication)
    md5_hash: Mapped[str] = mapped_column(String(32), unique=True, index=True)

    # 存储键（本地模式为相对 storage 根的路径）
    storage_key: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    access_url: Mapped[str] = mapped_column(String(512))

    # File info
    file_size: Mapped[int] = mapped_column(BigInteger, default=0)
    content_type: Mapped[str] = mapped_column(String(64), default="image/png")
    file_ext: Mapped[str] = mapped_column(String(16), default=".png")

    # Dimensions
    width: Mapped[int] = mapped_column(Integer, default=0)
    height: Mapped[int] = mapped_column(Integer, default=0)

    # Category & folder
    file_category: Mapped[str] = mapped_column(String(32), index=True, default="other")  # avatar, clothing, result
    folder: Mapped[str] = mapped_column(String(64), index=True, default="uploads")

    # Tenant isolation
    tenant_id: Mapped[str] = mapped_column(String(64), index=True)

    # Access control
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)

    # Soft delete
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    deleted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self):
        return f"<FileRecord {self.uuid}>"
