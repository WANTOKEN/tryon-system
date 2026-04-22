# AI 虚拟试衣系统 - 部署指南

> **版本**: v2.0  
> **更新日期**: 2026-04-21

---

## 目录

1. [环境要求](#1-环境要求)
2. [本地开发环境](#2-本地开发环境)
3. [生产环境部署](#3-生产环境部署)
4. [配置说明](#4-配置说明)
5. [常见问题](#5-常见问题)

---

## 1. 环境要求

### 1.1 基础环境

| 组件 | 版本要求 | 说明 |
|------|----------|------|
| Python | 3.10+ | 后端运行环境 |
| Node.js | 18+ | 前端构建 |
| MySQL | 8.0+ | 主数据库 |
| Redis | 7.x | 缓存/会话 |
| Nginx | 1.20+ | 反向代理 |

### 1.2 外部服务

| 服务 | 用途 | 配置项 |
|------|------|--------|
| 阿里云 OSS | 图片存储 | `OSS_ACCESS_KEY_ID` |
| 阿里云 AI | 试穿引擎 | `ALIYUN_API_KEY` |
| 短信服务 | 验证码发送 | `SMS_ACCESS_KEY` |

---

## 2. 本地开发环境

### 2.1 克隆项目

```bash
git clone <repository-url>
cd my_project
```
mac环境

```bash
# python 3.11
brew install python@3.11
brew link python@3.11 --force
python3 --version

# node18
brew install node@18
```

### 2.2 后端设置

```bash
# 创建虚拟环境
python -m venv .venv

# 激活虚拟环境 (Windows)
.venv\Scripts\activate

# 激活虚拟环境 (Linux/Mac)
source .venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 复制环境变量配置
cp .env.example .env

# 编辑 .env 填入配置
```

### 2.3 数据库初始化

```bash
# 创建数据库
mysql -u root -p
CREATE DATABASE tryon_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 执行迁移
python manage.py migrate

# 创建超级管理员
python manage.py createsuperuser

# 导入预设服装数据（可选）
python manage.py loaddata preset_clothing.json
```

### 2.4 前端设置

```bash
cd frontend-react

# 安装依赖
npm install

# 开发模式启动
npm run dev

# 或构建生产版本
npm run build
```

### 2.5 启动服务

```bash
# 启动后端 (终端1)
python manage.py runserver

# 启动前端 (终端2)
cd frontend-react && npm run dev

# 启动 Redis (终端3)
redis-server
```

访问 http://localhost:5173

---

## 3. 生产环境部署

### 3.1 服务器准备

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装依赖
sudo apt install -y python3-pip python3-venv nginx redis-server mysql-server

# 启动服务
sudo systemctl enable redis-server
sudo systemctl enable mysql
```

### 3.2 项目部署

```bash
# 创建部署目录
sudo mkdir -p /var/www/tryon
sudo chown $USER:$USER /var/www/tryon

# 克隆代码
cd /var/www/tryon
git clone <repository-url> .

# 后端设置
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
vim .env  # 填入生产配置

# 数据库迁移
python manage.py migrate
python manage.py collectstatic --noinput

# 前端构建
cd frontend-react
npm install
npm run build
```

### 3.3 Gunicorn 配置

创建 `/etc/systemd/system/tryon-api.service`:

```ini
[Unit]
Description=TryOn API Server
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/tryon
Environment="PATH=/var/www/tryon/.venv/bin"
ExecStart=/var/www/tryon/.venv/bin/gunicorn \
    --workers 4 \
    --bind 127.0.0.1:8000 \
    --timeout 120 \
    --access-logfile /var/www/tryon/logs/access.log \
    --error-logfile /var/www/tryon/logs/error.log \
    config.wsgi:application

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable tryon-api
sudo systemctl start tryon-api
```

### 3.4 Nginx 配置

创建 `/etc/nginx/sites-available/tryon`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 证书
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # 前端静态文件
    location / {
        root /var/www/tryon/frontend-react/dist;
        try_files $uri $uri/ /index.html;
        
        # 缓存静态资源
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }

    # API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    # Django Admin 静态文件
    location /static/ {
        alias /var/www/tryon/staticfiles/;
    }

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 1000;
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/tryon /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3.5 SSL 证书

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo systemctl enable certbot.timer
```

---

## 4. 配置说明

### 4.1 环境变量 (.env)

```bash
# Django 配置
DJANGO_SETTINGS_MODULE=config.settings.production
SECRET_KEY=your-secret-key-here
DEBUG=False
ALLOWED_HOSTS=your-domain.com,api.your-domain.com

# 数据库
DB_NAME=tryon_db
DB_USER=tryon_user
DB_PASSWORD=your-db-password
DB_HOST=localhost
DB_PORT=3306

# Redis
REDIS_URL=redis://localhost:6379/0

# JWT
JWT_ACCESS_TTL=3600      # 1小时
JWT_REFRESH_TTL=604800   # 7天

# 阿里云 OSS
OSS_ACCESS_KEY_ID=your-access-key
OSS_ACCESS_KEY_SECRET=your-secret-key
OSS_BUCKET_NAME=your-bucket
OSS_ENDPOINT=oss-cn-shenzhen.aliyuncs.com

# 阿里云 AI 试穿
ALIYUN_API_KEY=your-api-key
ALIYUN_API_URL=https://api.aliyun.com/virtual-tryon

# 短信服务
SMS_ACCESS_KEY=your-sms-key
SMS_ACCESS_SECRET=your-sms-secret
SMS_SIGN_NAME=您的签名
SMS_TEMPLATE_CODE=SMS_123456

# CORS
CORS_ALLOWED_ORIGINS=https://your-domain.com

# 数据加密
ENABLE_ENCRYPTION=True
ENCRYPTION_KEY=your-encryption-key
```

### 4.2 Django Settings 分层

```
config/settings/
├── base.py        # 基础配置（所有环境共享）
├── development.py # 开发环境（DEBUG=True）
├── production.py  # 生产环境（DEBUG=False）
└── testing.py     # 测试环境
```

### 4.3 日志配置

日志文件位于 `logs/` 目录：

| 文件 | 说明 |
|------|------|
| `app.log` | 应用日志 |
| `access.log` | HTTP 访问日志 |
| `error.log` | 错误日志 |

日志轮转配置（`/etc/logrotate.d/tryon`）：

```
/var/www/tryon/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        systemctl reload tryon-api > /dev/null 2>&1 || true
    endscript
}
```

---

## 5. 常见问题

### 5.1 数据库连接失败

```bash
# 检查 MySQL 服务
sudo systemctl status mysql

# 检查连接
mysql -u tryon_user -p tryon_db

# 检查权限
GRANT ALL PRIVILEGES ON tryon_db.* TO 'tryon_user'@'localhost';
FLUSH PRIVILEGES;
```

### 5.2 Redis 连接失败

```bash
# 检查 Redis 服务
sudo systemctl status redis-server

# 测试连接
redis-cli ping
```

### 5.3 静态文件 404

```bash
# 重新收集静态文件
python manage.py collectstatic --noinput

# 检查 Nginx 配置
sudo nginx -t
```

### 5.4 CORS 错误

检查 `.env` 中的 `CORS_ALLOWED_ORIGINS` 是否包含前端域名。

### 5.5 OSS 上传失败

```bash
# 检查 OSS 配置
python manage.py shell
>>> from apps.common.services.oss_service import oss_service
>>> oss_service.upload_file(...)
```

---

## 6. 运维命令

### 6.1 服务管理

```bash
# 重启 API 服务
sudo systemctl restart tryon-api

# 查看日志
sudo journalctl -u tryon-api -f

# 查看 Nginx 日志
sudo tail -f /var/log/nginx/error.log
```

### 6.2 数据库备份

```bash
# 备份
mysqldump -u tryon_user -p tryon_db > backup_$(date +%Y%m%d).sql

# 恢复
mysql -u tryon_user -p tryon_db < backup_20260421.sql
```

### 6.3 清理任务

```bash
# 清理过期会话
python manage.py clearsessions

# 清理过期验证码
python manage.py shell
>>> from apps.accounts.models import SmsLog
>>> SmsLog.objects.filter(expired_at__lt=timezone.now()).delete()
```

---

## 7. Docker 部署（可选）

### 7.1 docker-compose.yml

```yaml
version: '3.8'

services:
  db:
    image: mysql:8.0
    environment:
      MYSQL_DATABASE: tryon_db
      MYSQL_USER: tryon_user
      MYSQL_PASSWORD: ${DB_PASSWORD}
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  api:
    build: .
    command: gunicorn config.wsgi:application --bind 0.0.0.0:8000
    volumes:
      - .:/app
      - static_files:/app/staticfiles
    environment:
      - DJANGO_SETTINGS_MODULE=config.settings.production
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - static_files:/var/www/static
    depends_on:
      - api

volumes:
  mysql_data:
  redis_data:
  static_files:
```

### 7.2 启动

```bash
docker-compose up -d
```

---

## 8. 监控告警

### 8.1 健康检查端点

- `/api/health/` - API 健康检查
- `/api/health/db/` - 数据库连接检查
- `/api/health/redis/` - Redis 连接检查

### 8.2 推荐监控工具

- **Sentry**: 错误追踪
- **Prometheus + Grafana**: 性能监控
- **Uptime Kuma**: 可用性监控
