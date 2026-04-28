# AI 虚拟试衣系统

基于 Django 5.x + React 的 AI 虚拟试衣系统，支持商家上传服装图片，顾客进行虚拟试穿体验。

## 功能特性

### 用户端功能
- **商家认证**：支持账号密码登录、手机验证码登录
- **衣橱管理**：服装分类管理、批量上传、预设模板
- **虚拟试穿**：AI 智能换装、实时预览、历史记录
- **试穿配额**：配额管理、使用统计
- **多语言支持**：中文、英文、繁体中文
- **移动端适配**：响应式设计，完美支持移动设备

### 管理后台功能 (新增)
- **统一管理后台**：独立的 Admin 管理系统
- **权限系统**：超级管理员、商家管理员多角色权限控制
- **商家管理**：商家账号创建、配额调整、状态管理
- **数据统计**：全局数据概览、试穿统计、配额使用分析
- **操作日志**：管理员操作审计追踪
- **系统监控**：服务状态监控、资源使用统计
- **RSA 加密登录**：管理后台支持 RSA 非对称加密登录

## 技术栈

### 后端
- **框架**：Django 5.x + Django REST Framework
- **认证**：SimpleJWT (JWT Token) + RSA 加密
- **数据库**：MySQL 8+
- **缓存/消息队列**：Redis + Celery
- **文件存储**：本地 / MinIO / 阿里云 OSS

### 前端
- **用户端**：React 18 + Vite + Tailwind CSS
- **管理后台**：React 18 + Vite + Ant Design 5 + TypeScript
- **状态管理**：React Hooks / Zustand
- **HTTP 客户端**：Fetch API / Axios
- **国际化**：自定义 i18n Hook

## 项目结构

```
my_project/
├── config/                    # Django 配置
│   ├── settings/              # 环境配置 (dev/production)
│   ├── urls.py               # 根路由
│   └── celery.py             # Celery 配置
├── apps/
│   ├── accounts/             # 商家认证模块
│   ├── wardrobe/             # 衣橱管理模块
│   ├── tryon/                # 虚拟试穿模块
│   ├── admin_api/            # 管理后台 API (新增)
│   └── common/               # 公共工具
│       ├── crypto.py         # 数据加解密工具
│       ├── services/         # OSS/存储服务
│       └── exceptions.py     # 自定义异常
├── frontend-react/           # 用户端前端
│   ├── src/
│   │   ├── components/       # UI 组件
│   │   ├── config/           # API 配置
│   │   ├── hooks/            # 自定义 Hooks
│   │   ├── utils/            # 工具函数
│   │   └── App.jsx           # 主应用
│   └── vite.config.js        # Vite 配置
├── frontend-admin/           # 管理后台前端 (新增)
│   ├── src/
│   │   ├── components/       # 公共组件
│   │   ├── pages/            # 页面组件
│   │   ├── layouts/          # 布局组件
│   │   ├── hooks/            # 自定义 Hooks
│   │   ├── stores/           # Zustand 状态
│   │   └── App.tsx           # 主应用
│   └── vite.config.ts        # Vite 配置
├── docker/                   # Docker 部署配置
│   ├── nginx/                # Nginx 配置
│   ├── schema.sql            # 数据库初始化脚本
│   ├── docker-compose.yml    # 基础服务编排
│   └── docker-compose.prod.yml # 生产环境编排
├── doc/                      # 项目文档
├── keys/                     # RSA 密钥对 (管理后台加密)
├── media/                    # 媒体文件目录
├── start-dev.ps1             # Windows 开发启动脚本
├── start-dev.sh              # macOS 开发启动脚本
└── manage.py
```

## 文档

| 文档 | 说明 |
|------|------|
| [开发环境准备](./doc/04-开发环境准备.md) | 从零开始搭建开发环境（Windows/macOS） |
| [版本一致性说明](./doc/05-版本一致性说明.md) | 开发与生产环境版本对照表 |
| [前后端联调说明](./doc/06-前后端联调说明.md) | 图片 URL 处理与预签名机制 |
| [本地开发指南](./doc/02-本地开发指南.md) | 本地开发流程和常用命令 |
| [系统说明](./doc/01-系统说明.md) | 系统架构和 API 接口说明 |
| [生产部署指南](./doc/03-生产部署指南.md) | 生产环境部署步骤 |
| [权限系统部署指南](./doc/权限系统部署指南.md) | 权限系统配置和测试 |

## 快速开始

### 方式一：使用启动脚本（推荐）

**Windows:**
```powershell
.\start-dev.ps1
```

**macOS:**
```bash
chmod +x start-dev.sh
./start-dev.sh
```

### 方式二：手动启动

#### 1. 克隆项目

```bash
git clone <repository-url>
cd my_project
```

#### 2. 后端配置

```bash
# 创建虚拟环境
python -m venv .venv

# 激活虚拟环境
# Windows:
.\.venv\Scripts\Activate.ps1
# macOS:
source .venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件配置数据库、Redis 等信息

# 运行迁移
python manage.py migrate

# 创建超级管理员
python manage.py createsuperuser

# 启动后端服务
python manage.py runserver 0.0.0.0:8888
```

#### 3. 前端配置

**用户端前端:**
```bash
cd frontend-react
npm install
npm run dev
```

**管理后台前端:**
```bash
cd frontend-admin
npm install
npm run dev
```

#### 4. 访问应用

| 服务 | 地址 |
|------|------|
| 用户端前端 | http://localhost:5173 |
| 管理后台 | http://localhost:5174 |
| API 地址 | http://localhost:8888/api/v1/ |
| 管理后台 API | http://localhost:8888/api/admin/ |
| Django Admin | http://localhost:8888/admin/ |

## API 接口

### 用户端 API (`/api/v1/`)

#### 认证模块 (`/api/v1/auth/`)

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/login/` | 账号密码登录 | 否 |
| POST | `/sms-login/` | 短信验证码登录 | 否 |
| POST | `/send-sms/` | 发送验证码 | 否 |
| POST | `/refresh/` | 刷新 Token | 否 |
| POST | `/logout/` | 退出登录 | 是 |
| GET | `/me/` | 获取当前商家信息和配额 | 是 |

#### 衣橱模块 (`/api/v1/wardrobe/`)

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/clothing/` | 获取服装列表 | 是 |
| POST | `/clothing/upload/` | 上传服装 | 是 |
| DELETE | `/clothing/<uuid>/` | 删除服装 | 是 |
| GET | `/categories/` | 获取分类配置 | 是 |
| GET | `/presets/` | 获取预设模板 | 是 |

#### 试穿模块 (`/api/v1/tryon/`)

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/generate/` | 提交试穿任务（支持 key 复用） | 是 |
| GET | `/records/` | 获取试穿记录列表 | 是 |
| GET | `/records/<uuid>/status/` | 查询试穿状态 | 是 |
| POST | `/records/<uuid>/save/` | 收藏/取消收藏 | 是 |
| DELETE | `/records/<uuid>/` | 删除试穿记录 | 是 |
| POST | `/records/clear/` | 清空试穿记录 | 是 |

**试穿接口参数说明**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `avatar` | File | 二选一 | 头像图片文件 |
| `avatar_key` | String | 二选一 | 已上传头像的 key（复用） |
| `clothing_uuids` | String | 否 | 衣橱服装 UUID，逗号分隔 |
| `custom_clothes` | JSON | 否 | 自定义服装 |
| `session_id` | String | 是 | 会话 ID |
| `ai_engine` | String | 否 | AI 引擎，默认 `seeddance` |

### 管理后台 API (`/api/admin/`)

#### 认证模块 (`/api/admin/auth/`)

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/public-key/` | 获取 RSA 公钥 | 否 |
| POST | `/login/` | 管理员登录 (RSA 加密) | 否 |
| POST | `/refresh/` | 刷新 Token | 否 |

#### 系统管理 (`/api/admin/`)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/system/info/` | 系统信息 | 超管 |
| GET | `/system/stats/` | 系统统计 | 超管 |
| GET | `/merchants/` | 商家列表 | 超管 |
| POST | `/merchants/` | 创建商家 | 超管 |
| PATCH | `/merchants/<id>/` | 更新商家 | 超管 |
| POST | `/merchants/<id>/adjust-quota/` | 调整配额 | 超管 |
| GET | `/operation-logs/` | 操作日志 | 超管 |
| GET | `/clothing/` | 服装管理 | 商家管理员 |
| GET | `/tryon-records/` | 试穿记录 | 商家管理员 |

## 权限系统

### 角色定义

| 角色 | 说明 | 权限范围 |
|------|------|----------|
| `super_admin` | 超级管理员 | 全部权限，管理所有商家 |
| `merchant_admin` | 商家管理员 | 仅管理自己的数据和配额 |

### 权限列表

| 权限代码 | 说明 |
|----------|------|
| `super_admin` | 超级管理员权限 |
| `merchant_view` | 查看商家列表 |
| `merchant_manage` | 创建/编辑商家 |
| `tryon_view` | 查看试穿记录 |
| `clothing_view` | 查看服装列表 |
| `clothing_manage` | 管理服装 |
| `file_view` | 查看文件列表 |
| `operation_log_view` | 查看操作日志 |

## 环境变量

### 后端 (.env)

```env
# 环境
DJANGO_ENV=development
DEBUG=True

# 数据库
DB_NAME=tryon_system
DB_USER=root
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=3306

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET_KEY=your_secret_key
JWT_ACCESS_TTL=3600
JWT_REFRESH_TTL=86400

# 阿里云 OSS
OSS_ACCESS_KEY_ID=
OSS_ACCESS_KEY_SECRET=
OSS_BUCKET_NAME=
OSS_ENDPOINT=oss-cn-shanghai.aliyuncs.com

# 火山引擎 ARK (AI 引擎)
ARK_API_KEY=

# 数据加密开关
DATA_ENCRYPTION_ENABLED=false
```

### 前端 (.env)

**用户端:**
```env
VITE_API_BASE_URL=/api/v1
```

**管理后台:**
```env
VITE_API_BASE_URL=/api/admin
```

## 数据加密

系统支持请求/响应数据加密（XOR + Base64），前后端通过配置开关控制：

- 后端：`DATA_ENCRYPTION_ENABLED=true`
- 前端：`request.js` 中 `setEncryptionEnabled(true)`

默认关闭，生产环境建议开启。

### 管理后台 RSA 加密

管理后台登录支持 RSA 非对称加密：
- 公钥接口：`GET /api/admin/auth/public-key/`
- 前端使用 JSEncrypt 加密密码
- 后端使用私钥解密验证

## 国际化

支持语言：
- 简体中文 (zh-CN) - 默认
- 繁体中文 (zh-TW)
- English (en)

通过右上角语言切换按钮切换。

## 开发指南

### 代码规范

- **后端**：PEP 8、Black、isort
- **前端**：ESLint、Prettier

### 测试

```bash
# 后端测试
python manage.py test

# 前端测试
cd frontend-react && npm test
cd frontend-admin && npm test
```

## 部署

### Docker 部署 (推荐)

```bash
# 1. 配置环境变量
cp docker/.env.prod.example docker/.env.prod
vim docker/.env.prod

# 2. 一键部署
cd docker && ./deploy.sh
```

### 手动部署

```bash
# 后端
export DJANGO_ENV=production
gunicorn config.wsgi:application -b 0.0.0.0:8888

# 用户端前端
cd frontend-react
npm run build
# 将 dist 目录部署到 Nginx

# 管理后台前端
cd frontend-admin
npm run build
# 将 dist 目录部署到 Nginx
```

### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 用户端前端
    location / {
        root /path/to/frontend-react/dist;
        try_files $uri $uri/ /index.html;
    }

    # 管理后台
    location /admin/ {
        alias /path/to/frontend-admin/dist/;
        try_files $uri $uri/ /admin/index.html;
    }

    # API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:8888;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 媒体文件
    location /media/ {
        alias /path/to/my_project/media/;
    }
}
```

### Docker Compose 部署

```bash
# 启动基础服务 (MySQL + Redis)
docker compose -f docker/docker-compose.yml up -d

# 启动生产环境服务
docker compose -f docker/docker-compose.prod.yml up -d
```

## 常用命令

```bash
# 查看服务状态
make status

# 更新后端 (不影响前端)
make deploy-backend

# 更新前端 (不影响后端)
make deploy-frontend

# 数据库备份
make db-backup

# 查看日志
docker logs -f tryon-backend
```

## 许可证

MIT
