"""
FastAPI application entry point（唯一入口：容器与测试均使用本文件）
"""
import logging
import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings, get_lan_ip
from app.api.v1 import router as api_v1_router
from app.db import engine, Base, AsyncSessionLocal
from app.services.auth_service import ensure_admin
from app.services.config_service import ensure_system_configs

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    # 建表
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # 播种超级管理员（首次启动）
    async with AsyncSessionLocal() as db:
        await ensure_admin(db)
        await ensure_system_configs(db)

    yield
    await engine.dispose()


# 创建 FastAPI app
app = FastAPI(
    title="AI 虚拟试衣系统 API",
    description="基于 FastAPI 的虚拟试穿服务后端",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
# 开发模式下自动把本机局域网 IP 的两个端口（前端 5173 / 后端 8000）加入允许来源，
# 免去 IP 变动时手动改 .env。生产环境请在 backend/.env 显式配置 CORS_ORIGINS。
_cors_origins = list(settings.cors_origins)
if settings.env == "development":
    _lan_ip = get_lan_ip()
    if _lan_ip:
        for _origin in (
            f"http://{_lan_ip}:5173",
            f"http://{_lan_ip}:8000",
            f"http://{_lan_ip}",
        ):
            if _origin not in _cors_origins:
                _cors_origins.append(_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 静态文件：本地存储，通过 /static/uploads 暴露图片（资源与 AI 结果均存服务器）
import os

os.makedirs(settings.storage_local_dir, exist_ok=True)
app.mount(
    settings.storage_public_base,
    StaticFiles(directory=settings.storage_local_dir),
    name="uploads",
)

# ===== 统一错误处理 =====
# 目的：任何后端异常都返回 JSON 且带可直接展示的业务文案，
# 避免前端拿到 "Internal Server Error" 这类无意义提示；同时把完整堆栈写进日志便于排查。
logger = logging.getLogger("aitryon")


def _is_debug() -> bool:
    env = str(getattr(settings, "app_env", "") or "").lower()
    return bool(getattr(settings, "debug", False)) or env in {"dev", "development", "local"}


def _error_body(message: str, code: str, extra: dict | None = None) -> dict:
    # detail 供 FastAPI 生态与前端 extractError 使用；message 为前端优先读取字段
    body = {"detail": message, "message": message, "error_code": code}
    if extra:
        body.update(extra)
    return body


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """参数校验失败：转成「字段名: 原因」的可读提示，前端可直接展示。"""
    errors = exc.errors()
    parts = []
    for err in errors[:5]:
        loc = err.get("loc", ())
        field = ".".join(str(x) for x in loc if x not in ("body", "query", "path"))
        msg = err.get("msg", "参数错误")
        parts.append(f"{field}: {msg}" if field else msg)
    message = "；".join(parts) or "请求参数不合法"
    logger.warning("参数校验失败 %s %s -> %s", request.method, request.url.path, errors)
    return JSONResponse(
        status_code=422,
        content=_error_body(message, "validation_error", {"errors": errors[:5]}),
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """HTTPException：统一响应结构，保证 detail/message 都是可展示文案。"""
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_body(str(exc.detail), "http_error"),
        headers=getattr(exc, "headers", None),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """兜底异常：记录完整堆栈，开发环境回传真实错误，生产环境返回通用文案。"""
    logger.error(
        "未处理异常 %s %s\n%s", request.method, request.url.path, traceback.format_exc()
    )
    message = f"服务器内部错误：{exc}" if _is_debug() else "服务器开小差了，请稍后重试"
    return JSONResponse(status_code=500, content=_error_body(message, "internal_error"))


# Include API routers
app.include_router(api_v1_router, prefix="/api/v1")


@app.get("/")
async def root():
    return {"message": "AI 虚拟试衣系统 API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
