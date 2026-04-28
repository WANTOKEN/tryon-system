#!/bin/bash
# AI 虚拟试衣系统 - 生产环境部署脚本
# 使用方式: ./deploy.sh

set -e

echo "=========================================="
echo "AI 虚拟试衣系统 - 生产环境部署 v2.0"
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

# 加载环境变量
source docker/.env.prod

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}错误: Docker 未安装${NC}"
    exit 1
fi

echo ""
echo "步骤 1/8: 启动基础服务 (MySQL + Redis)..."
docker compose -f docker/docker-compose.yml up -d

# 等待 MySQL 就绪
echo "等待数据库就绪..."
for i in {1..30}; do
    if docker exec tryon-mysql mysqladmin ping -h localhost -u root -p${MYSQL_ROOT_PASSWORD} --silent 2>/dev/null; then
        echo "MySQL 就绪!"
        break
    fi
    echo "等待 MySQL... ($i/30)"
    sleep 2
done

echo ""
echo "步骤 2/8: 初始化数据库..."
docker exec -i tryon-mysql mysql -u root -p${MYSQL_ROOT_PASSWORD} tryon_system < docker/schema.sql 2>/dev/null || echo "表已存在，跳过初始化"

echo ""
echo "步骤 3/8: 构建后端镜像..."
docker build -t tryon-backend:latest .

echo ""
echo "步骤 4/8: 启动后端服务..."
docker compose -f docker/docker-compose.prod.yml up -d backend

# 等待后端就绪
echo "等待后端服务就绪..."
for i in {1..30}; do
    if curl -sf http://localhost:8888/api/v1/health/ > /dev/null 2>&1; then
        echo "后端服务就绪!"
        break
    fi
    echo "等待后端... ($i/30)"
    sleep 2
done

echo ""
echo "步骤 5/8: 构建用户端前端..."
cd frontend-react
if [ ! -d "node_modules" ]; then
    echo "安装前端依赖..."
    npm install
fi
echo "构建前端产物..."
npm run build
cd $PROJECT_DIR

echo ""
echo "步骤 6/8: 构建管理后台前端..."
cd frontend-admin
if [ ! -d "node_modules" ]; then
    echo "安装管理后台依赖..."
    npm install
fi
echo "构建管理后台产物..."
npm run build
cd $PROJECT_DIR

echo ""
echo "步骤 7/8: 生成 RSA 密钥对..."
if [ ! -f "keys/private_key.pem" ]; then
    echo "生成 RSA 密钥对..."
    mkdir -p keys
    cd keys
    openssl genrsa -out private_key.pem 2048 2>/dev/null
    openssl rsa -in private_key.pem -pubout -out public_key.pem 2>/dev/null
    chmod 600 private_key.pem
    chmod 644 public_key.pem
    cd $PROJECT_DIR
    echo "RSA 密钥对生成完成!"
else
    echo "RSA 密钥对已存在，跳过生成"
fi

echo ""
echo "步骤 8/8: 启动 Nginx..."
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
    -v $PROJECT_DIR/frontend-admin/dist:/var/www/admin:ro \
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
echo "访问地址:"
echo "  用户端:     https://your-domain.com/"
echo "  管理后台:   https://your-domain.com/admin/"
echo "  API:        https://your-domain.com/api/v1/"
echo "  管理API:    https://your-domain.com/api/admin/"
echo ""
echo "后续步骤:"
echo "  1. 修改 Nginx 配置中的域名 (docker/nginx/conf.d/default.conf)"
echo "  2. 配置 SSL 证书 (参考 doc/03-生产部署指南.md)"
echo "  3. 创建超级管理员: make create-admin"
echo "  4. 设置权限组: make setup-permissions"
echo ""
echo "常用命令:"
echo "  查看日志:       docker logs -f tryon-backend"
echo "  更新后端:       make deploy-backend"
echo "  更新用户端前端: make deploy-frontend"
echo "  更新管理后台:   make deploy-admin"
echo "  查看状态:       docker ps"
echo ""
