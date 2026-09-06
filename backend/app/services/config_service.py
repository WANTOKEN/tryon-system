"""
System config service - 系统配置种子与读写

- ensure_system_configs: 首次启动写入默认配置项（对齐前端 SettingsPage 分组与 key）
- update_configs: 批量更新配置值
"""
import json
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.system_config import SystemConfig
from app.core.config import get_settings

settings = get_settings()

# 默认配置种子：[config_group, key, value, value_type, description]
DEFAULT_CONFIGS: List[tuple] = [
    ("basic", "site_name", "AI虚拟试衣", "string", "站点名称"),
    ("basic", "site_description", "AI 驱动的虚拟试穿平台", "string", "站点描述"),
    ("ai", "ai_engine", "seeddance", "string", "AI 引擎"),
    ("ai", "ai_timeout", "120", "integer", "超时时间(秒)"),
    ("ai", "ai_retry_count", "3", "integer", "重试次数"),
    ("ai", "ai_api_key", "", "string", "API 密钥"),
    ("ai", "ai_model", settings.engine_model, "string", "模型名称"),
    ("storage", "storage_max_size_mb", "1024", "integer", "最大存储空间(MB)"),
    ("storage", "storage_cleanup_days", "30", "integer", "自动清理天数"),
    ("quota", "default_quota", "100", "integer", "默认配额"),
    ("quota", "quota_reset_day", "1", "integer", "配额重置日(每月)"),
    ("contact", "admin_contact_name", "", "string", "管理员名称"),
    ("contact", "admin_contact_phone", "", "string", "联系电话"),
    ("contact", "admin_contact_wechat", "", "string", "微信号"),
    ("contact", "admin_contact_email", "", "string", "邮箱"),
]

VALUE_TYPE_TEXT = {
    "string": "字符串",
    "integer": "整数",
    "float": "浮点数",
    "boolean": "布尔",
    "json": "JSON",
}


async def ensure_system_configs(db: AsyncSession) -> None:
    """首次启动写入默认配置（已存在则跳过）"""
    existing = (await db.execute(select(SystemConfig.key))).scalars().all()
    existing_set = set(existing)
    for group, key, value, vtype, desc in DEFAULT_CONFIGS:
        if key in existing_set:
            continue
        db.add(
            SystemConfig(
                key=key,
                value=str(value),
                value_type=vtype,
                description=desc,
            )
        )
    await db.commit()


def _parse_value(value: str, value_type: str):
    """按 value_type 解析配置值（SystemConfig 模型无 parse_value 方法，这里本地实现）"""
    try:
        if value_type == "integer":
            return int(value)
        if value_type == "float":
            return float(value)
        if value_type == "boolean":
            return str(value).lower() in ("true", "1", "yes")
        if value_type == "json":
            return json.loads(value) if value else {}
    except (ValueError, TypeError, json.JSONDecodeError):
        return value
    return value


def _serialize(cfg: SystemConfig) -> dict:
    return {
        "id": cfg.id,
        "key": cfg.key,
        "value": cfg.value,
        "value_type": cfg.value_type,
        "value_type_text": VALUE_TYPE_TEXT.get(cfg.value_type, cfg.value_type),
        "parsed_value": _parse_value(cfg.value, cfg.value_type),
        "description": cfg.description,
        "created_at": cfg.created_at.isoformat() if cfg.created_at else "",
        "updated_at": cfg.updated_at.isoformat() if cfg.updated_at else "",
    }


async def get_grouped_configs(db: AsyncSession) -> dict:
    """按 config_group 分组返回配置（对齐前端 GroupedConfig）"""
    group_of = {key: group for group, key, _, _, _ in DEFAULT_CONFIGS}
    rows = (await db.execute(select(SystemConfig).order_by(SystemConfig.id))).scalars().all()
    grouped = {
        "basic": [],
        "ai": [],
        "storage": [],
        "quota": [],
        "contact": [],
        "other": [],
    }
    for cfg in rows:
        grouped.setdefault(group_of.get(cfg.key, "other"), []).append(_serialize(cfg))
    return grouped


async def resolve_engine_config(db: AsyncSession) -> dict:
    """解析试穿引擎运行配置：优先取 DB SystemConfig，缺失回退环境变量。

    供 tryon_engine 在每次请求时动态生效（无需重启服务），使「系统设置」
    中的 AI 引擎 / 模型名称 / API 密钥 即时生效。
    """
    rows = (await db.execute(select(SystemConfig))).scalars().all()
    cfg = {c.key: c.value for c in rows}
    return {
        "ai_engine": cfg.get("ai_engine") or settings.ai_engine,
        "ai_model": cfg.get("ai_model") or settings.engine_model,
        "ai_api_key": cfg.get("ai_api_key") or settings.las_api_key,
    }


async def update_configs(
    db: AsyncSession,
    values: dict,
    value_types: Optional[dict] = None,
) -> int:
    """批量更新配置值，返回受影响条数。values: {key: value}"""
    value_types = value_types or {}
    updated = 0
    for key, raw_value in values.items():
        cfg = (
            await db.execute(select(SystemConfig).where(SystemConfig.key == key))
        ).scalar_one_or_none()
        if not cfg:
            continue
        cfg.value = str(raw_value)
        if key in value_types and value_types[key] in VALUE_TYPE_TEXT:
            cfg.value_type = value_types[key]
        updated += 1
    if updated:
        await db.commit()
    return updated
