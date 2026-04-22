# AI 虚拟试衣系统 - 生产环境 Dockerfile
# 多阶段构建，优化镜像大小

# ================================
# Stage 1: 前端构建
# ================================
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend-react

# 复制前端依赖文件
COPY frontend-react/package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制前端源码
COPY frontend-react/ ./

# 构建生产版本
RUN npm run build

# ================================
# Stage 2: Python 基础镜像
# ================================
FROM python:3.11-slim AS base

# 设置环境变量
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# 安装系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    default-libmysqlclient-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ================================
# Stage 3: 后端依赖
# ================================
FROM base AS backend-builder

# 复制依赖文件
COPY requirements.txt ./

# 安装 Python 依赖
RUN pip install --no-cache-dir -r requirements.txt

# ================================
# Stage 4: 生产镜像
# ================================
FROM base AS production

# 复制 Python 依赖
COPY --from=backend-builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=backend-builder /usr/local/bin /usr/local/bin

# 复制后端代码
COPY config/ ./config/
COPY apps/ ./apps/
COPY manage.py ./
COPY Makefile ./

# 复制前端构建产物
COPY --from=frontend-builder /app/frontend-react/dist ./frontend-react/dist

# 创建必要目录
RUN mkdir -p logs staticfiles media

# 收集静态文件
RUN python manage.py collectstatic --noinput

# 创建非 root 用户
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "4", "--timeout", "120"]
