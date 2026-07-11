"""
Core configuration

集中管理所有可环境变量配置，并支持本地（无需云凭证）一键运行。
存储统一使用本地磁盘（local，资源与 AI 结果均存服务器）；AI 引擎可在 mock / real 间切换。
数据库默认使用 MySQL 8（异步驱动 aiomysql，utf8mb4），可通过 DATABASE_URL 覆盖。
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator, model_validator
from functools import lru_cache
from typing import Any, List
from pathlib import Path


class Settings(BaseSettings):
    """Application settings"""

    # Environment
    debug: bool = False
    env: str = "development"

    # Database（默认 MySQL 8；测试/本地无 MySQL 时可用 sqlite+aiosqlite:///./test.db 覆盖）
    database_url: str = "mysql+aiomysql://tryon:tryon@localhost:3306/tryon?charset=utf8mb4"
    db_echo: bool = False

    # Redis (预留，异步任务若启用 Celery 时配置)
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0

    # JWT
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60 * 24
    jwt_refresh_token_expire_days: int = 7

    # CORS（支持逗号分隔字符串、JSON 数组或列表；兼容 docker/.env 多种写法）
    cors_origins: Any = ["http://localhost:5173", "http://localhost:5174"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors_origins(cls, v: Any) -> List[str]:
        if isinstance(v, list):
            return [str(x) for x in v]
        if isinstance(v, str):
            s = v.strip()
            if not s:
                return ["http://localhost:5173", "http://localhost:5174"]
            if s.startswith("["):
                import json

                try:
                    parsed = json.loads(s)
                    if isinstance(parsed, list):
                        return [str(x) for x in parsed]
                except Exception:
                    pass
            return [item.strip() for item in s.split(",") if item.strip()]
        return ["http://localhost:5173", "http://localhost:5174"]

    @model_validator(mode="after")
    def _enforce_production_secrets(self) -> "Settings":
        if self.env != "development" and self.jwt_secret_key == "change-me-in-production":
            raise ValueError(
                "jwt_secret_key 必须由环境变量注入，禁止在生产环境使用默认弱密钥"
            )
        return self

    # ===== 存储后端（资源与 AI 结果均存服务器本地磁盘） =====
    # local: 直接写入本地磁盘并通过 /static/uploads 提供访问（无需云凭证）
    storage_backend: str = "local"
    storage_local_dir: str = str(Path(__file__).resolve().parent.parent.parent / "storage")
    storage_public_base: str = "/static/uploads"  # 本地可访问的基础路径（服务器地址）

    # ===== AI 试穿引擎 =====
    # mock: 演示模式，使用本地占位图（无需外部 API，保证闭环可运行）
    # real: 接入真实虚拟试穿 API（需配置下方密钥与回调/轮询）
    ai_engine: str = "mock"
    ark_api_key: str = ""
    ark_base_url: str = "https://ark.cn-beijing.volces.com/api/v3"

    # 真实引擎（火山引擎 Ark 图生图 / 多图融合）参数
    ark_model: str = "doubao-seedream-4.5"  # 默认模型，支持多图融合（4.5 最多 14 张参考图）
    ark_size: str = "2048x2048"             # 生成尺寸（需落在模型允许的总像素/宽高比区间）
    ark_response_format: str = "url"        # url | b64_json
    ark_watermark: bool = False             # 是否在图片右下角添加「AI 生成」水印
    ark_output_format: str = ""             # 仅 5.0 系列支持（png/jpeg）；留空则不传
    ark_max_ref_images: int = 14            # 参考图数量上限（5.0 Pro 为 10）
    ark_prompt: str = (
        "请将参考图中的服装自然地穿在人像模特身上，保持人物姿态、面部特征与原有背景，"
        "真实融合服装的纹理、版型与细节。"
    )
    ark_timeout: int = 120                  # 单次生成请求超时（秒）

    # 演示用：mock 引擎模拟处理耗时（秒）
    mock_tryon_seconds: int = 4

    # ===== 初始管理员（首次启动自动创建） =====
    admin_username: str = "admin"
    admin_password: str = "admin123"
    admin_phone: str = "13800000000"

    # 开发期短信验证码（无需真实短信网关，内存存储）
    dev_sms_enabled: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache()
def get_settings() -> Settings:
    return Settings()
