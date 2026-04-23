#!/bin/bash
# AI 虚拟试衣系统 - 生产环境部署脚本
# 使用方式: ./deploy.sh

set -e

echo "=========================================="
echo "AI 虚拟试衣系统 - 生产环境部署"
echo "=========================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 项目目录
PROJECT_DIR="/opt/tryon"
cd $PROJECT_DIR

# 检查环境变量文件
if [ ! -f "docker/.env.prod" ]; then
    echo -e "${RED}错误: docker/.env.prod 文件不存在${NC}"
    echo "请复制 docker/.env.prod.example 为 docker/.env.prod 并填入实际值"
    exit 1
fi

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}错误: Docker 未安装${NC}"
    exit 1
fi

echo ""
echo "步骤 1/6: 启动基础服务 (MySQL + Redis)..."
docker compose -f docker/docker-compose.yml up -d

# 等待 MySQL 就绪
echo "等待数据库就绪..."
for i in {1..30}; do
    if docker exec tryon-mysql mysqladmin ping -h localhost -u root -pRoot@AiTryon2026 --silent 2>/dev/null; then
        echo "MySQL 就绪!"
        break
    fi
    echo "等待 MySQL... ($i/30)"
    sleep 2
done

echo ""
echo "步骤 2/6: 初始化数据库..."
docker exec -i tryon-mysql mysql -u root -pRoot@AiTryon2026 tryon_system < docker/schema.sql 2>/dev/null || echo "表已存在，跳过初始化"

echo ""
echo "步骤 3/6: 构建后端镜像..."
docker build -t tryon-backend:latest .

echo ""
echo "步骤 4/6: 启动后端服务..."
docker compose -f docker/docker-compose.prod.yml up -d backend

echo ""
echo "步骤 5/6: 构建前端..."
cd frontend-react
if [ ! -d "node_modules" ]; then
    echo "安装前端依赖..."
    npm install
fi
echo "构建前端产物..."
npm run build
cd $PROJECT_DIR

echo ""
echo "步骤 6/6: 启动 Nginx..."
docker network create tryon-network 2>/dev/null || true
docker rm -f tryon-nginx 2>/dev/null || true

docker run -d \
    --name tryon-nginx \
    --restart always \
    -p 80:80 \
    -p 443:443 \
    -v $PROJECT_DIR/docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro \
    -v $PROJECT_DIR/docker/nginx/conf.d:/etc/nginx/conf.d:ro \
    -v $PROJECT_DIR/docker/nginx/ssl:/etc/nginx/ssl:ro \
    -v $PROJECT_DIR/frontend-react/dist:/var/www/html:ro \
    -v $PROJECT_DIR/staticfiles:/var/www/static:ro \
    --network tryon-network \
    nginx:alpine

docker exec tryon-nginx nginx -t

echo ""
echo -e "${GREEN}=========================================="
echo "部署完成!"
echo "==========================================${NC}"
echo ""
echo "服务状态:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "访问地址: https://your-domain.com"
echo ""
echo "常用命令:"
echo "  查看日志:     docker logs -f tryon-backend"
echo "  更新后端:     make deploy-backend"
echo "  更新前端:     make deploy-frontend"
echo "  查看状态:     docker ps"
echo ""
