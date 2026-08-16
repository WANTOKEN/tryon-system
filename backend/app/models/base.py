"""统一 ORM 基类：uuid 字符串主键 + 时间戳字段"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, DeclarativeBase


def _uuid() -> str:
    return uuid.uuid4().hex


class Base(DeclarativeBase):
    """所有模型共用基类，提供 uuid 主键与 created/updated 时间戳"""


class UUIDMixin:
    """uuid 主键混入（hex 字符串，无横线，对外友好且索引紧凑）"""
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid, unique=True, index=True)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
