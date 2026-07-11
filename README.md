# AI 虚拟试衣系统（MVP）

基于 FastAPI + React 的 AI 虚拟试衣系统。商家上传服装、顾客上传人像即可生成虚拟试穿结果。
本项目已重构为 **MVP 可上线版本**：local 模式零云凭证即可一键跑通完整闭环（登录 → 衣橱 → 试穿 → 结果 → 历史 → 管理后台）。

## 架构概览

```
my_project/
├── backend/                 # FastAPI 后端（异步 SQLAlchemy 2.0）
│   ├── app/
│   │   ├── api/v1/          # 路由：auth / wardrobe / tryon / admin / file / common
│   │   ├── core/config.py   # 集中配置（存储=local、mock/real 可切换）
│   │   ├── db/              # 数据库引擎与会话
│   │   ├── models/          # ORM 模型
│   │   ├── schemas/         # Pydantic 请求/响应模型
│   │   ├── services/        # 业务服务（auth / tryon / tryon_engine / storage）
│   │   └── storage/         # 存储抽象层（Local，资源与 AI 结果存服务器）
│   ├── tests/test_smoke.py  # 端到端冒烟测试
│   ├── Dockerfile
│   └── requirements.txt
├── frontend-react/          # 用户端（React 18 + Vite + Tailwind）
├── frontend-admin/          # 管理后台（React 18 + Vite + Antd + TS）
├── nginx/                   # 统一网关：构建并托管两个前端静态资源 + 反向代理后端 API
└── docker-compose.yml       # 一键编排全部服务（含 Nginx 网关）
```

## 技术栈（已校正）

| 层 | 技术 |
|---|---|
| 后端 | FastAPI 0.115 + SQLAlchemy 2.0（异步）+ Pydantic 2 |
| 数据库 | 默认 MySQL 8（异步驱动 `aiomysql`，`utf8mb4`）；可经 `DATABASE_URL` 切 SQLite |
| 认证 | JWT（HS256）+ bcrypt |
| 存储 | 本地磁盘（local，零依赖，资源与 AI 结果均存服务器）|
| 试穿引擎 | Mock 引擎（local 直接闭环）/ 真实 API 预留（`AI_ENGINE=real`） |
| 前端 | React 18 + Vite；用户端 Tailwind，后台 Ant Design + TS |

> 说明：原 README 宣称的 Redis / Celery / Zustand / 多语言 等在当前 MVP 中**未启用**（已移除或改为注释依赖），避免误导。

## MVP 功能范围

- 商家密码登录 / 注册 / 刷新 Token；超级管理员首次启动自动创建
- 衣橱：上传服装图、列表、删除、分类配置（图片真实落库可访问）
- 虚拟试穿：上传人像 + 选择服装 → 异步生成 → 轮询状态 → 返回结果图
- 试穿历史：列表、查看、收藏、删除、清空
- 管理后台：商家列表/创建/配额调整、全局统计、服装管理、试穿记录查看
- 统一文件访问：`/file/{uuid}/`、`/file/by-key/`、`/file/secure-url/` 等

**未纳入 MVP（移除以聚焦核心）**：短信/邮件找回密码、多语言、系统模特库、WebP 优化、MD5 去重之外的存储增强、RBAC 子角色、操作日志、系统监控、配额重置调度。

## 快速开始（本地）

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env        # 可选，默认 local 模式即可运行
pytest tests/test_smoke.py -q     # 端到端闭环冒烟测试（应为绿色）

uvicorn main:app --reload --port 8000   # 启动后访问 http://localhost:8000/docs
```

启动后自动建表并创建超级管理员：**admin / admin123**

前端：

```bash
# 用户端
cd frontend-react && npm install && npm run dev      # http://localhost:5173
# 管理后台
cd frontend-admin && npm install && npm run dev      # http://localhost:5174
```

> 前端通过相对路径 `/api/v1/...` 调用后端；开发时请确保 Vite 已配置后端代理（如未配置，设置 `VITE_API_BASE_URL=http://localhost:8000`）。

## 快速开始（Docker 一键编排）

```bash
docker compose up --build
# 用户端:   http://localhost:8080   （由 Nginx 网关托管静态 + 反代 /api）
# 管理后台: http://localhost:8081   （由 Nginx 网关托管静态 + 反代 /api）
# 后端 API: http://localhost:8000/docs
```

> 统一 Nginx 网关（`nginx/` 服务）在镜像内构建并托管用户端/管理后台静态资源，
> 同时将 `/api/`、`/static/uploads/`、`/file/` 反向代理到 `backend` 服务，
> 浏览器全程同源访问，无需额外配置 CORS。
>
> 服务编排要点：`backend` 提供 `/health` 健康检查，`nginx` 通过 `depends_on: service_healthy`
> 在其就绪后才启动；`backend` 启用 `init: true`（tini）实现信号托管与优雅退出；
> 共享反向代理片段位于 `nginx/proxy.conf`。原 `frontend-react/`、`frontend-admin/` 下的
> 独立 Dockerfile/nginx.conf 已被网关取代并删除，避免重复构建。

数据（MySQL 8 + 本地存储）持久化：`mysql-data` 卷存数据库，`backend-data` 卷存上传文件。

> 数据库初始化脚本位于 `db/init/01-init.sql`，会在 MySQL 容器首次启动时自动执行：
> 创建 `tryon` 库（utf8mb4）与应用账户 `tryon`（使用 `mysql_native_password` 认证，规避 MySQL 8 默认 `caching_sha2_password` 与 Python 驱动的兼容问题）。

> 本地无 Docker 时，可安装 MySQL 8 并建库后设置环境变量运行后端：
> ```bash
> mysql -uroot -p -e "CREATE DATABASE tryon CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
> export DATABASE_URL=mysql+aiomysql://tryon:tryon@localhost:3306/tryon?charset=utf8mb4
> ```

## 关键配置（环境变量）

| 变量 | 默认 | 说明 |
|---|---|---|
| `DATABASE_URL` | `mysql+aiomysql://tryon:tryon@localhost:3306/tryon?charset=utf8mb4` | 数据库；可改为 `sqlite+aiosqlite:///./test.db` 仅用于测试 |
| `STORAGE_BACKEND` | `local` | 本地存储（资源与 AI 结果存服务器）|
| `STORAGE_LOCAL_DIR` | `backend/storage` | local 模式写入目录 |
| `AI_ENGINE` | `mock` | `mock` / `real`（接真实 API 需 `ARK_API_KEY`） |
| `MOCK_TRYON_SECONDS` | `4` | mock 引擎模拟处理耗时 |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `admin` / `admin123` | 初始超管 |
| `DEV_SMS_ENABLED` | `true` | 开发期短信验证码（内存，明文返回 `dev_code`） |
| `CORS_ORIGINS` | 见 `config.py` | 跨域白名单 |

## 核心 API 契约

| 接口 | 方法 | 说明 |
|---|---|---|
| `/api/v1/auth/login/` | POST | 登录，返回 `access_token`/`refresh_token` |
| `/api/v1/auth/refresh/` | POST | 刷新，返回 `access_token` |
| `/api/v1/auth/register/` | POST | 商家自注册 |
| `/api/v1/wardrobe/clothing/` | GET/POST | 服装列表 / 上传（字段 `file`） |
| `/api/v1/tryon/upload/avatar/` | POST | 上传人像，返回 `image_key` |
| `/api/v1/tryon/generate/` | POST | 提交试穿，返回 `record_uuid`/`estimated_time` |
| `/api/v1/tryon/records/{uuid}/status/` | GET | 轮询状态，返回 `status`/`result_url` |
| `/api/v1/file/{uuid}/` | GET | 重定向到图片真实地址（`<img src>` 直用） |

## 测试

`backend/tests/test_smoke.py` 覆盖「登录 → 上传服装 → 上传人像 → 提交试穿 → 轮询完成 → 取图」全闭环，
使用 FastAPI `TestClient` + SQLite（`tests/conftest.py` 强制覆盖 `DATABASE_URL`），无需任何外部依赖。

```bash
cd backend && pytest tests/test_smoke.py -q
```
