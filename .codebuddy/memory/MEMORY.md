# 长期记忆

## 项目开发约束（用户明确授权）
- 当前项目处于**开发阶段**，用户允许任何必要的代码更改与重构。
- 无需考虑向后兼容性、旧版本兼容、废弃逻辑保留或兼容性判断。
- 可放心采用最新语法特性、API 与最佳实践重构优化代码。
- 适用范围：整个项目（backend / frontend-react / frontend-admin / 运维配置等）。

## 存储策略（用户明确决定）
- **不使用对象存储（OSS）**，所有资源（上传图、服装图、AI 试穿结果图）一律存服务器本地磁盘，通过 `/static/uploads/...` 暴露。
- 已删除 `app/storage/oss.py` 及所有 OSS 配置；存储层仅保留 `LocalStorageBackend`。
- AI 调用（火山引擎 Ark）返回的图片先下载为字节流，再经 `upload_file` 存本地，result_url 为服务器地址（Ark 的 24h 临时 URL 不直接对外）。
- 根 `.env` 的 `STORAGE_TYPE=oss` 为未接线的遗留配置，已置为 `local` 并注释掉 OSS 凭证。

## 前端主题切换系统（2026-08-16 实现）
- 配色参考：`/Users/apple/ai-tryon/ai-tryon-project-intro/theme-palette/theme-palette.html`。
- 机制：`<html data-theme="luxury-gold|frost-blue|sakura-pink|forest-green">` + `<html class="dark">`，localStorage 持久化键 `aitryon-theme` / `aitryon-mode`。
- 4 套色系 × 明/暗，每套含 primary/primary-strong + 语义背景、文字、边框变量。
- react 端：`src/hooks/useTheme.js` + `index.css` 注入语义变量（复用既有 `--accent`/`--bg-*`/`--text-*`/`--border-*` 体系，组件无需改）；Header 加调色板按钮下拉切换色系 + 亮/暗。index.html 注入启动前同步脚本防闪烁。
- admin 端（antd）：`src/hooks/useTheme.ts`；`AdminLayout` 用 `ConfigProvider` 接管 `colorPrimary` 与 `theme.darkAlgorithm`；Header 加 `BgColorsOutlined` 配色下拉 + `BulbOutlined/MoonOutlined` 亮暗切换。index.html 同样注入防闪烁脚本。
- 两前端共享同名 localStorage 键，切换机制一致。
- BrandLogo 实现教训：项目 `public/logo.png` 是 **金棕色实色图标（带少量透明边），非单色透明图标**。曾误用 CSS `mask-image: url(/logo.png)` + 主题色 background 染色，结果把整张近不透明图染成色块、logo 不可辨。最终改为**直接 `<img src="/logo.png">` 渲染原图**，干净显示，不复用主题染色。
- 因此 logo 不跟随主题变色（用户接受，优先"干净显示真正的 logo"）。后续若想让 logo 变色，需提供单色透明版本 PNG 或 SVG。
- 细节修复（2026-08-16）：
  - react 端 tailwind `champagne` 改为映射到 `var(--color-primary)` 系列，原 fixed gold 不再硬编码；新增 `--header-*` 变量让 Header 渐变/品牌/头像跟随主题。
  - react/admin 的 `index.html` 初始化脚本与 `useTheme` 均同步 `color-scheme`（亮/暗），避免原生控件/滚动条不变色。
  - admin 端把 `#f0f0f0` 分隔线、`#333` 用户名等硬编码色改为 antd `colorBorderSecondary`/`colorText` token；Header logo 渐变用 `primaryColor`。
  - 两 hook 增加 `storage` 事件监听，实现跨标签页主题同步。

## 全量问题审查（2026-08-16 二次排查）
项目存在大量"模型重构遗留不一致"，分两类处理：

### 已修复（确定性 bug，无歧义）
- **后端建表 registry 错配**：`app/db/database.py` 原有个独立空 `Base(DeclarativeBase)`，而模型用 `app/models/base.Base`。`main.py` 的 `create_all` 建的是空 metadata → 全新库所有表缺失。已改为 `from app.models.base import Base` 复用模型基类。（已有库因 create_all 幂等曾不报错，掩盖了问题）
- **`config_service.py`**：`get_grouped_configs` 用已删除的 `cfg.config_group` 字段、`_serialize` 用不存在的 `cfg.parse_value()` → admin 配置接口崩。已改为从 DEFAULT_CONFIGS 推断 group、本地实现 `_parse_value`。并清理了 `oss_*` 死种子。
- **`auth.py`**：`user.last_login_ip = ...` 模型无此字段 → 登录崩，已删。
- **`deps.py`**：`int(payload.get("sub"))` 但 Merchant.id 是 uuid 字符串 → ValueError 致全部认证接口崩，已改为字符串。
- **前端 `tailwind.config.js`**：`champagne` 指向 `var(--color-primary)`（index.css 从未定义该变量，实际注入的是 `--accent` 系列）→ 全站主色失效。已改为 `var(--accent*)`。
- **前端 Header**：`var(--color-on-primary)` 未定义 → 改 `--header-on`。
- **前端 index.css**：`bg-texture`/`glass-card`/`gold-glow`/`text-accent` 四个类无定义（整页白底、弹窗无背景、logo 无光晕、主题勾选不着色）→ 已补定义。

### 待用户决策（涉及业务语义，未擅自改）
- 后端 admin/wardrobe/common 大量引用模型**已被删的字段**（`OperationLog.admin_id/admin_username`、`QuotaHistory.change_type/reason/operator_name`、`Clothing.subcategory/sizes/image_thumb_url/file_id`、`ModelPhoto.image_thumb_url/file_id/sort_order/is_active`、`ClothingResponse` 字段不匹配）。修复方向二选一：A) 模型加回这些字段；B) 路由删除相关引用。需用户定方向。
- 前端剩余 P2/P3：react 端 ~80 处硬编码色（`#1A1A1A` 渐变、bg-white 弹窗、charcoal/grayLight 固定色）在亮色主题下不跟随；admin 端 index.css 大量 `!important` 浅色规则压过 antd darkAlgorithm、`#1677ff` 硬编码蓝、登录页内嵌 style 脱离主题体系。

## 后端启动修复（2026-08-16 会话）
- `sqlalchemy==2.0.35` + `aiomysql==0.2.0` 下 **`pool_pre_ping=True` 会触发 aiomysql `ping(reconnect)` 签名不兼容 bug**（报 `AsyncAdapt_aiomysql_connection.ping() missing 1 required positional argument: 'reconnect'`，导致 Application startup failed）。已在 `backend/app/db/database.py` 关闭 mysql/默认分支的 `pool_pre_ping`，改用 `pool_recycle=3600` 回收失效连接。
- 模型重构（删 OSS、UUID 主键）后服务层有遗留不一致：`backend/app/services/config_service.py` 的 `ensure_system_configs` 仍向 `SystemConfig` 传入已删除的 `config_group` 字段，导致启动 `TypeError`。已去掉该传参（模型仅剩 key/value/value_type/description/is_editable）。
- 验证方式：`cd backend && .venv/bin/python -m uvicorn app.main:app` 应打印 `Application startup complete.`

## Python 虚拟环境约定（用户明确决定）
- **统一使用仓库根目录 `.venv`**（`/Users/apple/my_project/.venv`），不在 `backend/` 下另建 `.venv`（已删除 `backend/.venv`）。
- 后端启动/依赖安装均用根目录 venv；README 快速开始已改为在根目录 `python3 -m venv .venv`。
- 数据库异步驱动统一用 **aiomysql**（不用 asyncmy）：`asyncmy 0.2.14` 与 `sqlalchemy 2.0.35` 的 `pool_pre_ping=True` 不兼容（`do_ping` 报 `ping() missing 1 required positional argument: 'reconnect'`）。`backend/.env` 的 `DATABASE_URL` 已改为 `mysql+aiomysql://...`，`requirements.txt` 由 `asyncmy` 换为 `aiomysql==0.2.0`。
