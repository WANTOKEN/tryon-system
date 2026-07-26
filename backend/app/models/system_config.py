"""
SystemConfig model - 管理后台系统配置（设置页面）

按 config_group 分组（basic/ai/oss/storage/quota/contact/other），
每项以唯一 key 标识，value 统一存为字符串，value_type 描述其语义类型。
"""
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class SystemConfig(Base):
    __tablename__ = "system_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    config_group: Mapped[str] = mapped_column(String(50), nullable=False, default="other", index=True)
    key: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    value: Mapped[str] = mapped_column(Text, nullable=False, default="")
    value_type: Mapped[str] = mapped_column(String(20), nullable=False, default="string")
    description: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def parse_value(self):
        """按 value_type 解析为 Python 原生值（供前端 parsed_value 使用）"""
        v = self.value
        try:
            if self.value_type == "integer":
                return int(v) if v not in ("", None) else 0
            if self.value_type == "float":
                return float(v) if v not in ("", None) else 0.0
            if self.value_type == "boolean":
                return str(v).lower() in ("true", "1", "yes", "on")
            if self.value_type == "json":
                import json

                return json.loads(v) if v else {}
        except (ValueError, TypeError, json.JSONDecodeError):
            return v
        return v
