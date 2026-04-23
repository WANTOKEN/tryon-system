#!/bin/bash
set -e

echo "=========================================="
echo "AI 虚拟试衣系统 - 后端服务启动"
echo "=========================================="

# 等待数据库就绪
wait_for_db() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 等待数据库连接..."

    local max_attempts=30
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if python -c "
import os
import MySQLdb
try:
    conn = MySQLdb.connect(
        host=os.environ.get('DB_HOST', 'mysql'),
        port=int(os.environ.get('DB_PORT', 3306)),
        user=os.environ.get('DB_USER', 'root'),
        password=os.environ.get('DB_PASSWORD', ''),
        database=os.environ.get('DB_NAME', 'tryon')
    )
    conn.close()
    exit(0)
except:
    exit(1)
" 2>/dev/null; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] 数据库连接成功!"
            return 0
        fi

        attempt=$((attempt + 1))
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 等待数据库... ($attempt/$max_attempts)"
        sleep 2
    done

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 数据库连接超时!"
    return 1
}

# 等待 Redis 就绪
wait_for_redis() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 等待 Redis 连接..."

    local max_attempts=15
    local attempt=0
    local redis_host="${REDIS_HOST:-redis}"
    local redis_port="${REDIS_PORT:-6379}"

    while [ $attempt -lt $max_attempts ]; do
        if python -c "
import redis
try:
    r = redis.Redis(host='$redis_host', port=$redis_port, socket_timeout=2)
    r.ping()
    exit(0)
except:
    exit(1)
" 2>/dev/null; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Redis 连接成功!"
            return 0
        fi

        attempt=$((attempt + 1))
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 等待 Redis... ($attempt/$max_attempts)"
        sleep 1
    done

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Redis 连接超时，继续启动..."
    return 0  # Redis 可选，不阻塞启动
}

# 执行数据库迁移检查（可选，手动迁移模式下跳过）
check_migrations() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 检查数据库迁移状态..."
    python manage.py showmigrations --verbosity=0 2>/dev/null || true
}

# 主流程
main() {
    # 等待依赖服务
    wait_for_db
    wait_for_redis

    # 检查迁移状态（不自动执行，仅显示）
    check_migrations

    echo "=========================================="
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 启动应用服务..."
    echo "=========================================="

    # 执行传入的命令（CMD）
    exec "$@"
}

main "$@"
