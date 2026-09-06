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
│   ├── scripts/             # 一次性脚本（seed_test_data.py 测试数据种子）
│   ├── tests/test_smoke.py  # 端到端冒烟测试
│   ├── .env                 # 后端实际读取的环境配置（DATABASE_URL 等）
│   ├── Dockerfile
│   └── requirements.txt
├── frontend-react/          # 用户端（React 18 + Vite + Tailwind，端口 5173）
├── frontend-admin/          # 管理后台（React 18 + Vite + Antd + TS，端口 5174）
├── nginx/                   # 统一网关：构建并托管两个前端静态资源 + 反向代理后端 API
└── docker-compose.yml       # 编排（默认仅 db；backend/nginx 已注释，需时手动开启）
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

## 运行操作（本地开发）

本项目统一使用**仓库根目录的 `.venv`**（不要在 `backend/` 下另建虚拟环境）。后端实际读取的是 `backend/.env`，不是根目录 `.env`。

### 0. 首次准备（只需执行一次）

```bash
# 1) 创建虚拟环境（仓库根目录）
cd /Users/apple/my_project
python3 -m venv .venv

# 2) 安装后端依赖
.venv/bin/pip install -r backend/requirements.txt

# 3) 安装前端依赖
cd frontend-react && npm install && cd ..
cd frontend-admin && npm install && cd ..
```

### 1. 启动数据库（MySQL 8，Docker）

```bash
cd /Users/apple/my_project
docker compose up -d db        # 仅拉起 MySQL，监听 3306，库名 tryon
docker compose ps              # 确认状态为 healthy
```

> 首次启动会自动执行 `db/init/01-init.sql` 建库与 `tryon` 账户（`mysql_native_password`，兼容 aiomysql）。
> 若此前用旧数据卷初始化过、出现 `Access denied`，需重建卷（**会清空数据**）：
> `docker compose down -v && docker compose up -d db`

### 2. 启动后端（FastAPI，端口 8000）

```bash
cd /Users/apple/my_project/backend
../.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

看到 `Application startup complete.` 即启动成功，此时会自动建表并创建超级管理员 **admin / admin123**。

验证：浏览器打开 <http://localhost:8000/docs> 查看接口文档；或 `curl http://localhost:8000/health`。

> `--host 0.0.0.0` 是必需的：手机扫码上传需通过局域网 IP 访问后端，仅 `127.0.0.1` 时手机连不上。

### 3. 启动前端

```bash
# 用户端（端口 5173）
cd /Users/apple/my_project/frontend-react && npm run dev

# 管理后台（端口 5174）
cd /Users/apple/my_project/frontend-admin && npm run dev
```

两个前端均已配置 Vite 代理，将 `/api`、`/static/uploads`、`/file` 转发到 `http://127.0.0.1:8000`，无需额外配置 `VITE_API_BASE_URL`。

### 4. 访问地址

| 服务 | 地址 |
|---|---|
| 用户端 | <http://localhost:5173> |
| 管理后台 | <http://localhost:5174> |
| 后端接口文档 | <http://localhost:8000/docs> |
| 健康检查 | <http://localhost:8000/health> |

### 5. 停止服务

```bash
# 前端 / 后端：在各自终端按 Ctrl + C
# 数据库：
cd /Users/apple/my_project && docker compose stop db      # 停止（保留数据）
docker compose down                                        # 停止并移除容器（保留卷数据）
```

### 6. 常见问题

| 现象 | 原因与处理 |
|---|---|
| `Access denied for user 'tryon'` | MySQL 数据卷是旧数据，`init.sql` 未重跑。执行 `docker compose down -v && docker compose up -d db` 重建卷 |
| 后端启动报 `can not connect to localhost:3306` | 数据库未启动，先执行 `docker compose up -d db` 并等 healthy |
| 后端连的是默认库而非 `backend/.env` 配置 | 必须从 `backend/` 目录启动 uvicorn，`backend/.env` 才会被加载 |
| 上传的图片无法显示 | 图片存于 `backend/storage/`，经 `/static/uploads` 暴露；确认后端已启动且前端代理生效 |
| 手机扫码打不开上传页 | 后端未用 `--host 0.0.0.0`；手机需与电脑在同一局域网，且访问的是本机局域网 IP 而非 localhost |

### 7. 准备测试数据（可选，用于功能测试）

项目提供一个一次性种子脚本，会创建商家账号并从网络下载公开服装图写入服装数据：

```bash
cd /Users/apple/my_project/backend
../.venv/bin/python scripts/seed_test_data.py
```

脚本执行后：

- 商家账号：`test_merchant` / 密码 `test123456`（手机 `13900000001`，店名「测试服装店」，配额 100）
- 服装数据：12 条，覆盖 `top / coat / pants / dress / skirt / shoes` 等类目，图片下载后落到 `backend/storage/clothes/`，经 `/static/uploads/...` 可访问

脚本带去重（同名同商家自动跳过），可重复运行。功能测试完成后可删除该脚本。

### 8. 存储清理脚本（部署成本控制）

`backend/scripts/cleanup_storage.py` 清理两类冷数据，避免本地存储无限增长：

- 软删除标记的孤儿文件（FileRecord.is_deleted=True）
- `results/` 中超过指定天数且未被任何 TryOnRecord 引用的老结果图

```bash
# 仅预览，不真删
cd /Users/apple/my_project/backend
../.venv/bin/python scripts/cleanup_storage.py --dry-run --results-older-than-days 30

# 真删：仅删孤儿（不按时间）
../.venv/bin/python scripts/cleanup_storage.py --orphan-files-only

# 部署到服务器后建议每天凌晨跑一次（crontab）：
# 0 3 * * * cd /opt/tryon && docker exec tryon-backend python scripts/cleanup_storage.py --results-older-than-days 30
```

## 部署与成本

`docker-compose.yml` 已重写：所有敏感配置（密钥、密码、域名）改为读环境变量，并默认只拉起 MySQL（开发模式直接本地跑后端，详见上文运行步骤）：

```bash
# 1) 拷贝并修改部署模板（生产环境必填 JWT_SECRET_KEY、ADMIN_PASSWORD、LAS_API_KEY 等）
cp .env.example .env

# 2) 仅拉数据库
docker compose up -d db
```

需要整组编排（后端 + Nginx 网关容器化）时，将 `docker-compose.yml` 中 `backend:` 与 `nginx:` 两段取消注释，再执行：

```bash
docker compose --env-file .env up --build -d
# 用户端:   http://<host>:8080
# 管理后台: http://<host>:8081
# 后端 API: http://<host>:8000/docs
```

### 真实引擎成本（豆包 Seedream 4.5）

| 项 | 现状（默认） | 优化 |
|---|---|---|
| 生成尺寸 | `2048×2048` | `1024×1024`（约省 50% token） |
| 生成张数 `n` | 未指定，可能默认多张 | 显式 `n=1`（防按倍数计费） |
| 参考图上限 | 14 | 10（适配 Seedream 5.0 Pro 上限，避免超限报错） |
| 超限处理 | 抛错 | 自动截断多余服装图（保留前 N 张） |

**示例：3 店 × 30 次/天 = 2700 次/月**
- 单价 ¥0.25/张（Seedream 4.5 1024×1024）
- AI 成本 = 2700 × ¥0.25 = **¥675/月**
- 加 Cloudflare R2 存结果（零出口费）+ Hetzner CX32（€7.59/月）+ 域名 ≈ **总成本约 ¥760/月**

如使用 mock 引擎，月成本仅约 ¥35-60（仅 VPS + 域名）。

> Nginx 网关在镜像内构建并托管两个前端静态资源，同时将 `/api/`、`/static/uploads/`、`/file/` 反向代理到 `backend`，浏览器全程同源访问，无需额外配置 CORS。
> `backend` 提供 `/health` 健康检查，`nginx` 通过 `depends_on: service_healthy` 在其就绪后启动；共享反向代理片段位于 `nginx/proxy.conf`。

数据持久化：`mysql-data` 卷存数据库，`backend-data` 卷存上传文件。

> 数据库初始化脚本位于 `db/init/01-init.sql`，会在 MySQL 容器首次启动时自动执行：创建 `tryon` 库（utf8mb4）与应用账户 `tryon`（使用 `mysql_native_password`，规避 MySQL 8 默认 `caching_sha2_password` 与 aiomysql 的兼容问题）。

> 本地无 Docker 时，可安装 MySQL 8 并建库后设置环境变量：
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
| `AI_ENGINE` | `mock` | `mock` / `real`（接真实 API 需 `LAS_API_KEY`） |
| `LAS_API_KEY` | 空 | 豆包 Seedream（LAS）访问凭证；配置后启用 `AI_ENGINE=real` |
| `LAS_BASE_URL` | `https://operator.las.cn-beijing.volces.com` | LAS 服务地址 |
| `ENGINE_MODEL` | `doubao-seedream-4.5` | 多图融合模型名 |
| `ENGINE_TIMEOUT` | `60` | 引擎单次请求超时（秒） |
| `TASK_OVERALL_TIMEOUT` | `180` | 试穿任务总耗时上限（秒） |
| `UPLOAD_MAX_SIZE_MB` | `20` | 结果图下载字节上限（SSRF 防护） |
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
