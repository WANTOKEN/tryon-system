# AI 虚拟试衣系统 - Django 后端 Dockerfile
# 仅包含后端服务，前端单独部署

# ================================
# Stage 1: Python 基础镜像
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
# Stage 2: 安装依赖
# ================================
FROM base AS builder

# 复制依赖文件
COPY requirements.txt ./

# 安装 Python 依赖
RUN pip install --no-cache-dir -r requirements.txt

# ================================
# Stage 3: 生产镜像
# ================================
FROM base AS production

# 复制 Python 依赖
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# 复制项目代码
COPY config/ ./config/
COPY apps/ ./apps/
COPY manage.py ./
COPY entrypoint.sh ./

# 创建必要目录
RUN mkdir -p logs staticfiles media

# 收集静态文件
RUN python manage.py collectstatic --noinput

# 设置 entrypoint 权限
RUN chmod +x entrypoint.sh

# 创建非 root 用户
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

# 暴露端口
EXPOSE 8888

# 入口脚本：等待依赖服务就绪
ENTRYPOINT ["./entrypoint.sh"]

# 启动命令（作为参数传给 entrypoint.sh）
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8888", "--workers", "4", "--timeout", "120"]
