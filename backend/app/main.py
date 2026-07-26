"""
FastAPI application entry point（唯一入口：容器与测试均使用本文件）
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
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
