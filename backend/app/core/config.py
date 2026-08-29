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

# backend/.env 的绝对路径：无论从项目根还是 backend 目录启动 uvicorn 都能正确加载，
# 避免「运行目录不在 backend 时读取不到 .env、回退到默认 MySQL 连接」导致的 Access denied。
_BACKEND_ENV = Path(__file__).resolve().parent.parent.parent / ".env"


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

    # 前端基础域名（用于生成「扫码上传」手机端落地页 URL）
    # 设为 "auto" 时自动探测本机局域网 IP（开发期手机扫码方便，避免 IP 变动需手动改配置）
    frontend_base_url: str = "auto"

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
        if self.env != "development" and self.admin_password == "admin123":
            raise ValueError(
                "admin_password 必须由环境变量注入，禁止在生产环境使用默认弱口令"
            )
        # 安全护栏：非开发环境下强制关闭开发期短信明文返回，避免生产泄漏验证码
        if self.env != "development":
            self.dev_sms_enabled = False
        return self

    @model_validator(mode="after")
    def _resolve_frontend_base_url(self) -> "Settings":
        """frontend_base_url 为 'auto' 时，自动探测本机局域网 IP，避免 IP 变动需手动改配置。

        开发期手机扫码访问落地页需要正确域名；生产环境应在 .env 显式配置真实域名。
        """
        if self.frontend_base_url.strip().lower() == "auto":
            lan_ip = get_lan_ip()
            self.frontend_base_url = f"http://{lan_ip}:5173" if lan_ip else "http://localhost:5173"
        return self

    # ===== 存储后端（资源与 AI 结果均存服务器本地磁盘） =====
    # local: 直接写入本地磁盘并通过 /static/uploads 提供访问（无需云凭证）
    storage_backend: str = "local"
    storage_local_dir: str = str(Path(__file__).resolve().parent.parent.parent / "storage")
    storage_public_base: str = "/static/uploads"  # 本地可访问的基础路径（服务器地址）

    # 上传/结果图大小上限（MB）；用于 SSRF 下载防护时的字节数上限
    upload_max_size_mb: int = 20

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

    # ===== 豆包 Seedream（LAS）多图融合引擎 =====
    # 真实引擎可切换为豆包 Seedream 接入（base64 传图），需配置 LAS_API_KEY 后启用。
    las_api_key: str = ""                                   # 豆包 Seedream 访问凭证
    las_base_url: str = "https://operator.las.cn-beijing.volces.com"  # LAS 服务地址
    engine_model: str = "doubao-seedream-4.5"               # LAS 多图融合模型名
    engine_timeout: int = 60                                # 引擎单次请求超时（秒）
    task_overall_timeout: int = 180                         # 试穿任务总耗时上限（秒）
    las_size: str = "2048x2048"                             # 生成尺寸
    las_response_format: str = "url"                        # url | b64_json
    las_watermark: bool = False                             # 是否添加「AI 生成」水印
    las_result_allowed_host: str = "operator.las.cn-beijing.volces.com"  # 结果 URL 允许的主机（含 .volces.com 后缀）
    las_result_download_timeout: int = 30                   # 结果图下载超时（秒）
    las_max_ref_images: int = 14                            # 参考图数量上限（人像 + 服装）

    # 演示用：mock 引擎模拟处理耗时（秒）
    mock_tryon_seconds: int = 4

    # ===== 初始管理员（首次启动自动创建） =====
    admin_username: str = "admin"
    admin_password: str = "admin123"
    admin_phone: str = "13800000000"

    # 开发期短信验证码（无需真实短信网关，内存存储）
    dev_sms_enabled: bool = True

    model_config = SettingsConfigDict(
        env_file=[".env", str(_BACKEND_ENV)],
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache()
def get_settings() -> Settings:
    return Settings()


def get_lan_ip() -> str:
    """探测本机在局域网中的 IP 地址（非 127.0.0.1 / 169.254 链路本地）。

    取第一个满足条件的 IPv4 网卡地址；探测失败返回空字符串（调用方回退 localhost）。
    """
    import socket

    # 优先用 UDP 连接外网地址的方式获取「出口」网卡 IP（不真正发包）
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        if ip and ip != "127.0.0.1":
            return ip
    except OSError:
        pass
    finally:
        s.close()

    # 兜底：枚举主机所有 IPv4 地址，跳过回环与链路本地
    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
            addr = info[4][0]
            if addr.startswith("127.") or addr.startswith("169.254."):
                continue
            return addr
    except OSError:
        pass
    return ""
