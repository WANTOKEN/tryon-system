# AI 虚拟试衣系统 - 完整设计文档

> **版本**: v2.0  
> **技术栈**: Django 5.x + React 18 + Vite + MySQL 8 + REST API  
> **更新日期**: 2026-04-15

---

## 目录

1. [系统概述](#1-系统概述)
2. [系统架构](#2-系统架构)
3. [数据库设计](#3-数据库设计)
4. [Django 项目结构](#4-django-项目结构)
5. [API 接口设计](#5-api-接口设计)
6. [前端设计](#6-前端设计)
7. [认证与权限](#7-认证与权限)
8. [AI 试穿引擎集成](#8-ai-试穿引擎集成)
9. [文件存储方案](#9-文件存储方案)
10. [多语言方案](#10-多语言方案)
11. [部署方案](#11-部署方案)
12. [验收标准](#12-验收标准)

- [附录 A：服装分类体系](#附录-a服装分类体系)
- [附录 B：API 路由汇总](#附录-bapi-路由汇总)
- [附录 C：补充设计细节](#附录-c补充设计细节)（账号管理/配额/并发/清理/Redis Key 规范/CORS/前端/部署）
- [附录 D：性能优化方案](#附录-d性能优化方案)
- [附录 E：测试策略](#附录-e测试策略)
- [附录 F：监控与告警](#附录-f监控与告警)
- [附录 G：前端 React 架构](#附录-g前端-react-架构)
- [附录 H：数据加密](#附录-h数据加密)
- [附录 I：配额管理](#附录-i配额管理)
- [附录 J：国际化](#附录-j国际化)
- [附录 K：移动端适配](#附录-k移动端适配)

---

## 1. 系统概述

### 1.1 产品定位

AI 虚拟试衣系统是一款面向**线下服装门店**的 B2B2C 智能穿搭工具。商家（门店）登录后，顾客可在门店平板/手机上拍摄形象照片，选择门店衣橱中的服装，由
AI 引擎生成虚拟试穿效果图。

### 1.2 核心用户角色

| 角色               | 说明       | 使用场景                  |
|------------------|----------|-----------------------|
| **商家（Merchant）** | 门店管理员/店员 | 登录系统、管理衣橱、查看试穿统计      |
| **顾客（Customer）** | 到店顾客（匿名） | 拍摄形象、选择服装、查看试穿效果      |
| **管理员（Admin）**   | 平台运营人员   | Django Admin 后台管理所有数据 |

### 1.3 核心业务流程

```
商家登录 → 管理衣橱（上传服装） → 顾客到店
  → 顾客拍摄形象照片 → 选择服装（每类1件） → 点击试穿
  → AI 引擎生成效果图 → 查看/收藏/分享 → 试穿结束
```

### 1.4 功能模块总览

| 模块    | 前端      | 后端             | 说明            |
|-------|---------|----------------|---------------|
| 商家认证  | ✅ 登录弹窗  | ✅ JWT          | 账号密码 + 手机验证码  |
| 衣橱管理  | ✅ 上传/删除 | ✅ CRUD         | 门店级服装库        |
| 形象管理  | ✅ 拍照/上传 | ✅ 上传           | 顾客形象照片        |
| 服装选择  | ✅ 分类/勾选 | ✅ 列表接口         | 6大类 20+子类     |
| AI 试穿 | ✅ 触发/轮询 | ✅ 任务队列         | 多引擎支持         |
| 试穿记录  | ✅ 列表/收藏 | ✅ CRUD         | 基于顾客会话隔离      |
| 顾客会话  | ✅ 自动生成  | ✅ request_id   | 刷新保持/结束重置     |
| 多语言   | ✅ 三语切换  | ✅ i18n Hook    | 简中/繁中/English |
| 配额管理  | ✅ 进度展示  | ✅ 后端统计         | 真实使用数据        |
| 数据加密  | ✅ XOR+Base64 | ✅ XOR+Base64 | 可配置开关         |
| 设置    | ✅ 弹窗    | ✅ 个人信息         | 退出登录/门店信息     |
| 管理后台  | —       | ✅ Django Admin | 全量数据管理        |

---

## 2. 系统架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────┐
│                      客户端层                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  平板浏览器   │  │  手机浏览器   │  │  PC 浏览器   │   │
│  │  (主场景)     │  │  (辅助场景)   │  │  (管理场景)   │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         └────────────────┬┘────────────────┘            │
│                          │                               │
│              ┌───────────▼───────────┐                   │
│              │   docs/index.html     │                   │
│              │   (单页应用 SPA)       │                   │
│              │   Tailwind CSS CDN    │                   │
│              └───────────┬───────────┘                   │
└──────────────────────────┼──────────────────────────────┘
                           │ HTTPS / REST API
┌──────────────────────────┼──────────────────────────────┐
│                     网关/反向代理层                        │
│              ┌───────────▼───────────┐                   │
│              │    Nginx / Caddy      │                   │
│              │  SSL终止 + 静态资源    │                   │
│              └───────────┬───────────┘                   │
└──────────────────────────┼──────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────┐
│                     应用服务层                            │
│  ┌───────────────────────▼───────────────────────┐       │
│  │              Django 5.x                       │       │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────────────┐ │       │
│  │  │accounts │ │ wardrobe│ │    tryon        │ │       │
│  │  │(认证)   │ │(衣橱)   │ │  (试穿核心)     │ │       │
│  │  └─────────┘ └─────────┘ └─────────────────┘ │       │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────────────┐ │       │
│  │  │ merchant│ │  media  │ │  django-admin   │ │       │
│  │  │(商家)   │ │(文件)   │ │  (管理后台)     │ │       │
│  │  └─────────┘ └─────────┘ └─────────────────┘ │       │
│  └───────────────────────┬───────────────────────┘       │
│                          │                               │
│  ┌───────────┐  ┌────────▼───────┐  ┌──────────────┐    │
│  │  Redis    │  │   Celery       │  │  SSE         │    │
│  │  (缓存)   │  │  (异步任务)    │  │  (进度推送)   │    │
│  └───────────┘  └────────┬───────┘  └──────────────┘    │
└──────────────────────────┼──────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────┐
│                     数据/存储层                           │
│  ┌───────────┐  ┌────────▼───────┐  ┌────────���─────┐    │
│  │  MySQL 8  │  │  MinIO/OSS     │  │  CDN         │    │
│  │  (主库)   │  │  (图片存储)    │  │  (加速分发)   │    │
│  └───────────┘  └────────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────┐
│                     外部服务层                            │
│  ┌───────────┐  ┌────────▼───────┐  ┌──────────────┐    │
│  │ 阿里云    │  │  腾讯云        │  │  SeedDance   │    │
│  │ AI试穿    │  │  AI试穿        │  │  AI试穿      │    │
│  └───────────┘  └────────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### 2.2 技术选型

| 层级    | 技术                          | 版本    | 说明          |
|-------|-----------------------------|-------|-------------|
| Web框架 | Django                      | 5.x   | 主框架         |
| 管理后台  | Django Admin                | 内置    | 数据管理        |
| API   | Django REST Framework       | 3.15+ | RESTful API |
| 认证    | SimpleJWT                   | 5.x   | JWT Token   |
| 数据库   | MySQL                       | 8.0+  | 主存储         |
| 缓存    | Redis                       | 7.x   | 会话/限流/任务队列  |
| 异步任务  | Celery                      | 5.x   | AI试穿异步处理    |
| 文件存储  | django-storages + MinIO/OSS | —     | 图片存储        |
| 前端框架 | React                       | 18.x  | 组件化开发       |
| 构建工具 | Vite                        | 5.x   | 快速构建        |
| CSS框架 | Tailwind CSS                | 3.x   | 响应式布局       |
| 状态管理 | React Hooks                 | 内置    | useState/useCallback |
| HTTP客户端 | Fetch API               | 内置    | 封装拦截器       |
| 国际化   | 自定义 i18n Hook             | —     | 三语言支持       |
| 部署    | Docker + Nginx              | —     | 容器化部署       |

---

## 3. 数据库设计

### 3.1 ER 关系图

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   merchant   │       │   clothing   │       │  tryon_record│
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id (PK)      │──┐    │ id (PK)      │──┐    │ id (PK)      │
│ username     │  │    │ merchant_id  │  │    │ merchant_id  │
│ phone        │  │    │ category     │  │    │ session_id   │
│ password     │  │    │ subcategory  │  │    │ avatar_url   │
│ store_name   │  │    │ name         │  │    │ result_url   │
│ status       │  │    │ image_url    │  │    │ status       │
│ quota_total  │  │    │ color        │  │    │ ai_engine    │
│ quota_used   │  │    │ sort_order   │  │    │ task_id      │
│ ...          │  │    │ is_active    │  │    │ processing_s │
└──────────────┘  │    │ ...          │  │    │ error_msg    │
                 │    └──────────────┘  │    │ is_saved     │
                 │                      │    │ ...          │
                 │    ┌──────────────┐  │    └──────────────┘
                 │    │tryon_clothing│  │           │
                 │    │(关联表 M2M)  │  │           │
                 │    ├──────────────┤  │           │
                 │    │ record_id    │◄─┼───────────┘
                 │    │ clothing_id  │◄─┘
                 │    │ category     │
                 │    └──────────────┘
                 │
                 │    ┌──────────────┐
                 └───►│  sms_log     │
                      ├──────────────┤
                      │ id (PK)      │
                      │ merchant_id  │
                      │ phone        │
                      │ code         │
                      │ used         │
                      │ ...          │
                      └──────────────┘
```

### 3.2 表结构详细设计

#### 3.2.1 merchant（商家表）

> **设计原则**: 不使用外键约束，所有关联通过应用层（Django ORM）维护。关联字段通过索引保证查询性能。

#### UUID 命名规范

所有业务表的 `uuid` 字段采用 **`{前缀}{UUID v4}`** 格式，前缀用于在日志、Redis Key、存储路径、API 响应中快速识别业务类型。

| 业务表          | 前缀       | 长度 | 格式              | 示例                                           |
|--------------|----------|----|-----------------|----------------------------------------------|
| merchant     | `mcht_`  | 41 | `mcht_{uuid4}`  | `mcht_f47ac10b-58cc-4372-a567-0e02b2c3d479`  |
| clothing     | `cloth_` | 42 | `cloth_{uuid4}` | `cloth_6ba7b810-9dad-11d1-80b4-00c04fd430c8` |
| tryon_record | `tryon_` | 42 | `tryon_{uuid4}` | `tryon_550e8400-e29b-41d4-a716-446655440000` |
| AI 任务 ID     | `task_`  | 41 | `task_{uuid4}`  | `task_7c9e6679-7425-40de-944b-e07fc1f90ae7`  |

> **字段长度说明**: 前缀长度 + UUID v4 标准长度（36字符，含4个连字符）= 实际长度。DDL 中统一使用 `CHAR(42)` 预留余量，方便未来前缀扩展。

**生成规则**:

```python
import uuid


def generate_uuid(prefix: str) -> str:
    """生成带业务前缀的 UUID"""
    return f"{prefix}{uuid.uuid4()}"


# 使用示例
merchant.uuid = generate_uuid('mcht_')  # mcht_xxx
clothing.uuid = generate_uuid('cloth_')  # cloth_xxx
record.uuid = generate_uuid('tryon_')  # tryon_xxx
task_id = generate_uuid('task_')  # task_xxx
```

**应用场景**:

- **日志追踪**: `[2026-04-08 12:00:00] tryon_550e8400... processing started` — 一眼识别是试穿任务
- **Redis Key**: `tryon:task:task_7c9e6679...` — 按 `task_` 前缀可批量扫描
- **存储路径**: `results/mcht_f47ac10b.../tryon_550e8400....png` — 路径即归属
- **API 响应**: `{"uuid": "tryon_550e8400..."}` — 前端无需额外字段判断类型
- **错误排查**: 在日志中 grep `tryon_` 即可过滤所有试穿相关日志

```sql
CREATE TABLE merchant
(
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid            CHAR(42)     NOT NULL COMMENT '对外唯一标识（前缀mcht_ + UUID v4）',
    username        VARCHAR(50)  NOT NULL COMMENT '登录用户名',
    phone           VARCHAR(20)  NOT NULL COMMENT '手机号明文（仅用于发送短信服务调用，禁止用于业务查询/展示）',
    phone_encrypted VARCHAR(255) NOT NULL COMMENT '手机号AES加密（用于查询匹配和API脱敏展示）',
    password        VARCHAR(255) NOT NULL COMMENT '密码（PBKDF2哈希）',
    store_name      VARCHAR(100) NOT NULL DEFAULT '' COMMENT '门店名称',
    store_address   VARCHAR(255) NOT NULL DEFAULT '' COMMENT '门店地址',
    avatar_url      VARCHAR(500) NOT NULL DEFAULT '' COMMENT '商家头像URL',

    -- 配额管理
    quota_total     INT UNSIGNED NOT NULL DEFAULT 100 COMMENT '总配额（试穿次数）',
    quota_used      INT UNSIGNED NOT NULL DEFAULT 0   COMMENT '已用配额',
    quota_reset_at  DATE NULL     COMMENT '配额重置日期（每月1号）',

    -- 状态
    status          TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '状态: 0=禁用 1=正常 2=过期',
    last_login_at   DATETIME NULL     COMMENT '最后登录时间',
    last_login_ip   VARCHAR(45)  NOT NULL DEFAULT '' COMMENT '最后登录IP',

    -- 软删除
    is_deleted      TINYINT(1)   NOT NULL DEFAULT 0,
    deleted_at      DATETIME NULL,

    -- 时间戳
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_uuid (uuid),
    UNIQUE KEY uk_username (username),
    UNIQUE KEY uk_phone_encrypted (phone_encrypted),
    INDEX           idx_status (status),
    INDEX           idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商家表';
```

#### 3.2.2 clothing（服装表）

```sql
CREATE TABLE clothing
(
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid            CHAR(42)     NOT NULL COMMENT '对外唯一标识（前缀cloth_ + UUID v4）',
    merchant_id     BIGINT UNSIGNED NOT NULL COMMENT '所属商家ID（关联 merchant.id，无外键约束）',

    -- 分类
    category        VARCHAR(30)  NOT NULL COMMENT '大类: tops/bottoms/dresses/outerwear/shoes/accessories',
    subcategory     VARCHAR(30)  NOT NULL COMMENT '子类: t-shirt/shirt/jeans/...',

    -- 服装信息
    name            VARCHAR(100) NOT NULL COMMENT '服装名称',
    color           VARCHAR(30)  NOT NULL DEFAULT '#000000' COMMENT '主色调HEX',
    image_url       VARCHAR(500) NOT NULL DEFAULT '' COMMENT '服装图片URL',
    image_thumb_url VARCHAR(500) NOT NULL DEFAULT '' COMMENT '缩略��URL',

    -- 排序与状态
    sort_order      INT          NOT NULL DEFAULT 0 COMMENT '排序权重（越大越靠前）',
    is_active       TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '是否上架',
    source          VARCHAR(20)  NOT NULL DEFAULT 'preset' COMMENT '来源: preset=预设 custom=自定义 wardrobe=衣橱上传',
    file_hash       VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '文件SHA256哈希（用于去重检测）',

    -- 软删除
    is_deleted      TINYINT(1)   NOT NULL DEFAULT 0,
    deleted_at      DATETIME NULL,

    -- 时间戳
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_uuid (uuid),
    INDEX           idx_merchant_category (merchant_id, category, is_active),
    INDEX           idx_merchant_subcategory (merchant_id, category, subcategory, is_active),
    INDEX           idx_merchant_hash (merchant_id, file_hash),
    INDEX           idx_sort (merchant_id, sort_order DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='服装表';
```

#### 3.2.3 tryon_record（试穿记录表）

```sql
CREATE TABLE tryon_record
(
    id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid             CHAR(42)     NOT NULL COMMENT '对外唯一标识（前缀tryon_ + UUID v4）',
    merchant_id      BIGINT UNSIGNED NOT NULL COMMENT '所属商家ID（关联 merchant.id，无外键约束）',
    session_id       VARCHAR(100) NOT NULL COMMENT '会话ID（浏览器生成UUID）',

    -- 图片
    avatar_url       VARCHAR(500) NOT NULL COMMENT '顾客形象照片URL',
    result_url       VARCHAR(500) NOT NULL DEFAULT '' COMMENT 'AI生成效果图URL',
    result_thumb_url VARCHAR(500) NOT NULL DEFAULT '' COMMENT '效果图缩略图URL',

    -- 状态
    status           VARCHAR(20)  NOT NULL DEFAULT 'pending' COMMENT 'pending/processing/completed/failed',
    ai_engine        VARCHAR(20)  NOT NULL DEFAULT 'aliyun' COMMENT 'AI引擎: aliyun/tencent/seeddance',
    task_id          VARCHAR(100) NOT NULL DEFAULT '' COMMENT 'AI任务ID（用于轮询）',

    -- 处理信息
    error_message    TEXT NULL     COMMENT '错误信息（失败时填写）',
    processing_time  DECIMAL(8, 2) NULL     COMMENT '处理耗时（秒）',
    quota_deducted   TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '是否已扣配额',

    -- 收藏
    is_saved         TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '是否收藏',

    -- 设备信息
    ip_address       VARCHAR(45)  NOT NULL DEFAULT '' COMMENT '客户端IP',
    device_info      VARCHAR(200) NOT NULL DEFAULT '' COMMENT '设备信息',
    user_agent       VARCHAR(500) NOT NULL DEFAULT '' COMMENT '浏览器UA',

    -- 软删除
    is_deleted       TINYINT(1)   NOT NULL DEFAULT 0,
    deleted_at       DATETIME NULL,

    -- 时间戳
    created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_uuid (uuid),
    INDEX            idx_merchant_session (merchant_id, session_id, created_at DESC),
    INDEX            idx_merchant_status (merchant_id, status),
    INDEX            idx_merchant_saved (merchant_id, is_saved, created_at DESC),
    INDEX            idx_task_id (task_id),
    INDEX            idx_session (session_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='试穿记录表';
```

#### 3.2.4 tryon_clothing（试穿-服装关联表）

```sql
CREATE TABLE tryon_clothing
(
    id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    record_id      BIGINT UNSIGNED NOT NULL COMMENT '试穿记录ID（关联 tryon_record.id，无外键约束）',
    clothing_id    BIGINT UNSIGNED NOT NULL COMMENT '服装ID（关联 clothing.id，无外键约束）',
    category       VARCHAR(30)  NOT NULL COMMENT '服装大类（冗余，方便查询）',
    subcategory    VARCHAR(30)  NOT NULL COMMENT '服装子类（冗余）',
    clothing_name  VARCHAR(100) NOT NULL COMMENT '服装名称（冗余）',
    clothing_color VARCHAR(30)  NOT NULL DEFAULT '#000000' COMMENT '服装颜色（冗余）',
    clothing_image VARCHAR(500) NOT NULL DEFAULT '' COMMENT '服装图片（冗余）',

    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

    UNIQUE KEY uk_record_clothing (record_id, clothing_id),
    INDEX          idx_record (record_id),
    INDEX          idx_clothing (clothing_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='试穿服装关联表';
```

#### 3.2.5 sms_log（短信验证码日志表）

```sql
CREATE TABLE sms_log
(
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    merchant_id BIGINT UNSIGNED NULL     COMMENT '商家ID（关联 merchant.id，无外键约束；登录时可能为空）',
    phone       VARCHAR(20) NOT NULL COMMENT '手机号',
    code        VARCHAR(6)  NOT NULL COMMENT '验证码',
    purpose     VARCHAR(20) NOT NULL DEFAULT 'login' COMMENT '用途: login/bind_phone',
    is_used     TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '是否已使用',
    ip_address  VARCHAR(45) NOT NULL DEFAULT '' COMMENT '请求IP',

    created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expired_at  DATETIME    NOT NULL COMMENT '过期时间',

    INDEX       idx_phone_code (phone, code, is_used),
    INDEX       idx_expired (expired_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='短信验证码日志表';
```

#### 3.2.6 preset_clothing（预设服装模板表）

```sql
CREATE TABLE preset_clothing
(
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category    VARCHAR(30)  NOT NULL COMMENT '大类',
    subcategory VARCHAR(30)  NOT NULL COMMENT '子类',
    name_i18n   JSON         NOT NULL COMMENT '多语言名称 {"zh-CN":"T恤","zh-TW":"T恤","en":"T-Shirts"}',
    color       VARCHAR(30)  NOT NULL DEFAULT '#000000' COMMENT '主色调',
    image_url   VARCHAR(500) NOT NULL DEFAULT '' COMMENT '服装图片URL',
    sort_order  INT          NOT NULL DEFAULT 0 COMMENT '排序',
    is_active   TINYINT(1)   NOT NULL DEFAULT 1,

    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_category_sub (category, subcategory, name_i18n(100)),
    INDEX       idx_category (category, subcategory, sort_order DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='预设服装模板表';
```

---

## 4. Django 项目结构

```
myproject/
├── manage.py
├── requirements.txt
├── pyproject.toml
├── .env                    # 环境变量
├── config/                 # Django 配置
│   ├── __init__.py
│   ├── settings/
│   │   ├── __init__.py     # from .base import *
│   │   ├── base.py         # 基础配置
│   │   ├── development.py  # 开发环境
│   │   ├── production.py   # 生产环境
│   │   └── testing.py      # 测试环境
│   ├── urls.py             # 根路由
│   └── wsgi.py
├── apps/
│   ├── __init__.py
│   ├── api_root.py         # API 版本入口
│   │
│   ├── accounts/           # 认证模块
│   │   ├── __init__.py
│   │   ├── models.py       # Merchant, SmsLog
│   │   ├── serializers.py
│   │   ├── views.py        # 登录/注册/验证码
│   │   ├── urls.py
│   │   ├── services.py     # 认证业务逻辑
│   │   ├── permissions.py  # 自定义权限
│   │   ├── admin.py        # Django Admin 注册
│   │   └── tests.py
│   │
│   ├── wardrobe/           # 衣橱模块
│   │   ├── __init__.py
│   │   ├── models.py       # Clothing, PresetClothing
│   │   ├── serializers.py
│   │   ├── views.py        # 服装 CRUD
│   │   ├── urls.py
│   │   ├── services.py
│   │   ├── admin.py
│   │   └── tests.py
│   │
│   ├── tryon/              # 试穿核心模块
│   │   ├── __init__.py
│   │   ├── models.py       # TryOnRecord, TryOnClothing
│   │   ├── serializers.py
│   │   ├── views.py        # 试穿触发/查询/收藏
│   │   ├── urls.py
│   │   ├── services.py     # 试穿业务逻辑
│   │   ├── tasks.py        # Celery 异步任务
│   │   ├── sse.py          # SSE 进度推送视图
│   │   ├── ai_engines/     # AI 引擎适配层
│   │   │   ├── __init__.py
│   │   │   ├── base.py     # 抽象基类
│   │   │   ├── factory.py  # 引擎工厂
│   │   │   ├── aliyun.py   # 阿里云
│   │   │   ├── tencent.py  # 腾讯云
│   │   │   └── seeddance.py
│   │   ├── admin.py
│   │   └── tests.py
│   │
│   ├── media/              # 文件上传模块
│   │   ├── __init__.py
│   │   ├── views.py        # 图片上传/获取
│   │   ├── urls.py
│   │   ├── services.py     # 存储服务（MinIO/OSS）
│   │   ├── admin.py
│   │   └── tests.py
│   │
│   └── common/             # 公共模块
│       ├── __init__.py
│       ├── utils/
│       │   ├── __init__.py
│       │   ├── crypto.py       # 加密工具
│       │   ├── pagination.py   # 分页工具
│       │   ├── response.py     # 统一响应格式
│       │   └── validators.py   # 自定义校验器
│       ├── middleware/
│       │   ├── __init__.py
│       │   ├── rate_limit.py   # 限流中间件
│       │   └── request_log.py  # 请求日志
│       └── exceptions.py       # 自定义异常
│
├── docs/
│   ├── index.html          # 前端单页应用
│   └── design-spec.md      # 本设计文档
│
├── media/                  # 本地开发用媒体文件
├── static/                 # 静态文件
├── templates/              # Django 模板（管理后台定制）
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── nginx.conf
└── scripts/
    ├── init_db.sql         # 数据库初始化脚本
    ├── seed_data.py        # 预设数据填充
    └── migrate.sh          # 迁移脚本
```

---

## 5. API 接口设计

### 5.1 统一规范

#### 请求规范

| 项目   | 规范                                     |
|------|----------------------------------------|
| 基础路径 | `/api/v1/`                             |
| 认证方式 | `Authorization: Bearer <access_token>` |
| 内容类型 | `application/json`（除文件上传外）             |
| 文件上传 | `multipart/form-data`                  |
| 语言切换 | `Accept-Language: zh-CN / zh-TW / en`  |

#### 统一响应格式

```typescript
// 成功响应
interface ApiResponse<T> {
    success: true;
    data: T;
    message?: string;        // 可选的成功提示
}

// 错误响应
interface ApiError {
    success: false;
    error_code: string;      // 错误码，如 "AUTH_TOKEN_EXPIRED"
    message: string;         // 用户可读的错误信息
    details?: Record<string, string[]>;  // 字段级错误（表单校验）
}

// 分页响应
interface PaginatedResponse<T> {
    success: true;
    data: {
        items: T[];
        total: number;
        page: number;
        page_size: number;
        total_pages: number;
    };
}
```

#### 错误码定义

| 错误码                        | HTTP状态码 | 说明        |
|----------------------------|---------|-----------|
| `AUTH_REQUIRED`            | 401     | 未提供认证信息   |
| `AUTH_TOKEN_EXPIRED`       | 401     | Token 已过期 |
| `AUTH_INVALID_CREDENTIALS` | 401     | 账号或密码错误   |
| `AUTH_SMS_CODE_INVALID`    | 400     | 验证码错误或已过期 |
| `AUTH_SMS_TOO_FREQUENT`    | 429     | 验证码发送过于频繁 |
| `MERCHANT_DISABLED`        | 403     | 商家账号已被禁用  |
| `QUOTA_EXCEEDED`           | 429     | 试穿配额已用完   |
| `VALIDATION_ERROR`         | 400     | 参数校验失败    |
| `FILE_TOO_LARGE`           | 400     | 文件大小超限    |
| `FILE_TYPE_INVALID`        | 400     | 文件类型不支持   |
| `CLOTHING_NOT_FOUND`       | 404     | 服装不存在     |
| `RECORD_NOT_FOUND`         | 404     | 记录不存在     |
| `AI_ENGINE_ERROR`          | 502     | AI 引擎调用失败 |
| `AI_ENGINE_TIMEOUT`        | 504     | AI 引擎超时   |
| `RATE_LIMIT_EXCEEDED`      | 429     | 请求频率超限    |

---

### 5.2 认证接口

#### 5.2.1 账号密码登录

**接口**: `POST /api/v1/auth/login/`

**请求参数**:

| 参数         | 类型     | 必填 | 说明      |
|------------|--------|----|---------|
| `username` | string | 是  | 用户名或手机号 |
| `password` | string | 是  | 密码      |

**响应**:

```typescript
{
    success: true;
    data: {
        access_token: string;       // JWT access token，有效期 24h
        refresh_token: string;      // JWT refresh token，有效期 7d
        token_type: "Bearer";
        expires_in: 86400;          // access token 有效秒数
        merchant: {
            id: number;
            username: string;
            phone: string;            // 脱敏: 138****8888
            store_name: string;
            avatar_url: string;
            quota_total: number;
            quota_used: number;
            quota_remaining: number;
        }
        ;
    }
    ;
}
```

#### 5.2.2 手机验证码登录

**接口**: `POST /api/v1/auth/sms-login/`

**请求参数**:

| 参数      | 类型     | 必填 | 说明       |
|---------|--------|----|----------|
| `phone` | string | 是  | 手机号（11位） |
| `code`  | string | 是  | 6位验证码    |

**响应**: 同 5.2.1

#### 5.2.3 发送验证码

**接口**: `POST /api/v1/auth/send-sms/`

**请求参数**:

| 参数        | 类型     | 必填 | 说明            |
|-----------|--------|----|---------------|
| `phone`   | string | 是  | 手机号（11位）      |
| `purpose` | string | 否  | 用途，默认 `login` |

**响应**:

```typescript
{
    success: true;
    data: {
        expired_in: 300;  // 验证码有效期（秒）
    }
    ;
}
```

**业务规则**:

- 同一手机号 60 秒内只能发送一次
- 同一 IP 每小时最多发送 10 次
- 验证码有效期 5 分钟
- 验证码 6 位纯数字

#### 5.2.4 刷新 Token

**接口**: `POST /api/v1/auth/refresh/`

**请求参数**:

| 参数              | 类型     | 必填 | 说明   |
|-----------------|--------|----|------|
| `refresh_token` | string | 是  | 刷新令牌 |

**响应**:

```typescript
{
    success: true;
    data: {
        access_token: string;
        refresh_token: string;
        token_type: "Bearer";
        expires_in: 86400;
    }
    ;
}
```

#### 5.2.5 退出登录

**接口**: `POST /api/v1/auth/logout/`

**请求头**: `Authorization: Bearer <token>`

**响应**:

```typescript
{
    success: true;
    data: null;
    message: "已退出登录";
}
```

#### 5.2.6 获取当前商家信息

**接口**: `GET /api/v1/auth/me/`

**请求头**: `Authorization: Bearer <token>`

**响应**:

```typescript
{
    success: true;
    data: {
        id: number;
        username: string;
        phone: string;            // 脱敏
        store_name: string;
        store_address: string;
        avatar_url: string;
        quota_total: number;
        quota_used: number;
        quota_remaining: number;
        last_login_at: string;    // ISO 8601
        status: number;
    }
    ;
}
```

---

### 5.3 衣橱接口

#### 5.3.1 获取服装列表

**接口**: `GET /api/v1/wardrobe/clothing/`

**请求头**: `Authorization: Bearer <token>`

**查询参数**:

| 参数            | 类型      | 必填 | 说明                                                      |
|---------------|---------|----|---------------------------------------------------------|
| `category`    | string  | 否  | 按大类筛选: tops/bottoms/dresses/outerwear/shoes/accessories |
| `subcategory` | string  | 否  | 按子类筛选: t-shirt/shirt/...                                |
| `source`      | string  | 否  | 按来源筛选: preset/custom/wardrobe                           |
| `is_active`   | boolean | 否  | 是否上架，默认 true                                            |
| `page`        | integer | 否  | 页码，默认 1                                                 |
| `page_size`   | integer | 否  | 每页条数，默认 50，最大 200                                       |

**响应**:

```typescript
{
    success: true;
    data: {
        items: Array<{
            uuid: string;            // 对外唯一标识
            category: string;
            subcategory: string;
            name: string;
            color: string;
            image_url: string;
            image_thumb_url: string;
            source: string;
            sort_order: number;
        }>;
        total: number;
        page: number;
        page_size: number;
        total_pages: number;
    }
    ;
}
```

#### 5.3.2 上传服装到衣橱

**接口**: `POST /api/v1/wardrobe/clothing/upload/`

**请求头**: `Authorization: Bearer <token>`  
**内容类型**: `multipart/form-data`

**请求参数**:

| 参数            | 类型     | 必填 | 说明                       |
|---------------|--------|----|--------------------------|
| `image`       | file   | 是  | 服装图片（JPG/PNG/WebP，≤10MB） |
| `name`        | string | 是  | 服装名称（≤30字符）              |
| `category`    | string | 是  | 大类                       |
| `subcategory` | string | 是  | 子类                       |
| `color`       | string | 否  | 主色调HEX，默认自动提取            |

**响应**:

```typescript
{
    success: true;
    data: {
        uuid: string;            // 对外唯一标识
        name: string;
        category: string;
        subcategory: string;
        color: string;
        image_url: string;
        image_thumb_url: string;
        source: "wardrobe";
    }
    ;
}
```

#### 5.3.3 删除服装

**接口**: `DELETE /api/v1/wardrobe/clothing/{uuid}/`

**请求头**: `Authorization: Bearer <token>`

**响应**:

```typescript
{
    success: true;
    data: null;
    message: "已删除";
}
```

**业务规则**:

- 只能删除 `source=custom` 或 `source=wardrobe` 的服装
- 预设服装（`source=preset`）不可删除
- 软删除，不物理删除

#### 5.3.4 获取分类配置

**接口**: `GET /api/v1/wardrobe/categories/`

**请求头**: `Authorization: Bearer <token>`

**响应**:

```typescript
{
    success: true;
    data: Array<{
        id: string;           // "tops"
        name: string;         // "上装"（根据 Accept-Language 返回）
        subcategories: Array<{
            id: string;         // "t-shirt"
            name: string;       // "T恤"
            count: number;      // 该子类下服装数量
        }>;
    }>;
}
```

---

### 5.4 试穿接口

#### 5.4.1 提交试穿任务

**接口**: `POST /api/v1/tryon/generate/`

**请求头**: `Authorization: Bearer <token>`  
**内容类型**: `multipart/form-data`

**请求参数**:

| 参数               | 类型     | 必填 | 说明                                      |
|------------------|--------|----|-----------------------------------------|
| `avatar`         | file   | 是  | 顾客形象照片（JPG/PNG，≤10MB）                   |
| `clothing_uuids` | string | 是  | 服装UUID列表，逗号分隔，如 `"cloth_xxx,cloth_yyy"` |
| `session_id`     | string | 是  | 会话ID（前端生成UUID）                          |
| `ai_engine`      | string | 否  | AI引擎，默认 `aliyun`                        |

**响应**:

```typescript
{
    success: true;
    data: {
        record_uuid: string;      // 试穿记录UUID
        task_id: string;          // AI任务ID，用于轮询
        status: "pending";
        estimated_time: number;   // 预估耗时（秒）
        sse_url: string;          // SSE 订阅地址
    }
    ;
}
```

**业务规则**:

- 每次试穿最多选择 6 件服装（每个大类最多 1 件）
- 提交前检查配额：`quota_remaining > 0`
- 配额在 AI 任务**成功完成**后扣减（失败不扣）
- 同一会话最多保留 20 条记录，超出自动清理最旧的

#### 5.4.2 查询试穿状态（轮询）

**接口**: `GET /api/v1/tryon/records/{uuid}/status/`

**请求头**: `Authorization: Bearer <token>`

**响应**:

```typescript
{
    success: true;
    data: {
        record_uuid: string;
        status: "pending" | "processing" | "completed" | "failed";
        progress: number;         // 0-100 进度百分比
        result_url: string | null;  // 完成后返回
        result_thumb_url: string | null;
        error_message: string | null;
        processing_time: number | null;
    }
    ;
}
```

**业务规则**:

- 前端每 2 秒轮询一次
- 超过 120 秒未完成视为超时
- `completed` 状态才返回 `result_url`

#### 5.4.3 获取试穿记录列表

**接口**: `GET /api/v1/tryon/records/`

**请求头**: `Authorization: Bearer <token>`

**查询参数**:

| 参数           | 类型      | 必填 | 说明         |
|--------------|---------|----|------------|
| `session_id` | string  | 否  | 按会话筛选      |
| `is_saved`   | boolean | 否  | 按收藏筛选      |
| `status`     | string  | 否  | 按状态筛选      |
| `page`       | integer | 否  | 页码，默认 1    |
| `page_size`  | integer | 否  | 每页条数，默认 20 |

**响应**:

```typescript
{
    success: true;
    data: {
        items: Array<{
            uuid: string;            // 对外唯一标识
            session_id: string;
            avatar_url: string;
            result_url: string;
            result_thumb_url: string;
            status: string;
            is_saved: boolean;
            clothing: Array<{
                uuid: string;
                name: string;
                category: string;
                subcategory: string;
                color: string;
                image_url: string;
            }>;
            processing_time: number | null;
            created_at: string;
        }>;
        total: number;
        saved_count: number;     // 收藏总数
        page: number;
        page_size: number;
    }
    ;
}
```

#### 5.4.4 收藏/取消收藏

**接口**: `PATCH /api/v1/tryon/records/{uuid}/save/`

**请求头**: `Authorization: Bearer <token>`

**请求参数**:

| 参数         | 类型      | 必填 | 说明                 |
|------------|---------|----|--------------------|
| `is_saved` | boolean | 是  | true=收藏，false=取消收藏 |

**响应**:

```typescript
{
    success: true;
    data: {
        uuid: string;
        is_saved: boolean;
    }
    ;
}
```

#### 5.4.5 删除试穿记录

**接口**: `DELETE /api/v1/tryon/records/{uuid}/`

**请求头**: `Authorization: Bearer <token>`

**响应**:

```typescript
{
    success: true;
    data: null;
}
```

#### 5.4.6 批量删除试穿记录

**接口**: `POST /api/v1/tryon/records/batch-delete/`

**请求头**: `Authorization: Bearer <token>`

**请求参数**:

| 参数           | 类型     | 必填 | 说明                 |
|--------------|--------|----|--------------------|
| `uuids`      | array  | 是  | 记录UUID列表           |
| `session_id` | string | 否  | 按会话清空（与 uuids 二选一） |

**响应**:

```typescript
{
    success: true;
    data: {
        deleted_count: number;
    }
    ;
}
```

---

### 5.5 文件上传接口

#### 5.5.1 上传图片

**接口**: `POST /api/v1/media/upload/`

**请求头**: `Authorization: Bearer <token>`  
**内容类型**: `multipart/form-data`

**请求参数**:

| 参数        | 类型     | 必填 | 说明                                     |
|-----------|--------|----|----------------------------------------|
| `file`    | file   | 是  | 图片文件                                   |
| `purpose` | string | 否  | 用途: avatar/clothing/result，默认 `avatar` |

**响应**:

```typescript
{
    success: true;
    data: {
        url: string;           // 原图 URL
        thumb_url: string;     // 缩略图 URL（300px 宽）
        size: number;          // 文件大小（字节）
        content_type: string;  // image/jpeg
        width: number;
        height: number;
    }
    ;
}
```

**业务规则**:

- 支持格式: JPG, PNG, WebP
- 文件大小限制: 10MB
- 自动生成 300px 宽缩略图
- 文件路径规则: `{purpose}/{merchant_uuid}/{uuid}.{ext}`（uuid 带业务前缀）

---

### 5.6 SSE 接口（试穿进度推送）

**连接地址**: `GET /api/v1/tryon/tasks/{task_uuid}/progress/?token={access_token}`

**认证**: 通过 Query String 传递 `token` 参数（浏览器原生 `EventSource` API 不支持自定义 Header）

> **安全说明**: SSE 使用短有效期 Token（access_token，24h），且连接仅限 HTTPS 环境。Token 在 URL 中暴露的风险可通过以下措施缓解：
> - Nginx 日志中过滤 `token` 参数，避免明文记录
> - Token 有效期短（24h），泄露窗口有限
> - 服务端校验 Token 后立即验证 `merchant_id` 归属

**协议**: `text/event-stream`（Server-Sent Events）

**服务端推送事件**:

```typescript
// 进度更新事件
event: progress
data: {
    "record_uuid"
:
    "tryon_xxxx", "status"
:
    "processing", "progress"
:
    45, "message"
:
    "AI 正在生成试穿效果..."
}

// 完成事件
event: completed
data: {
    "record_uuid"
:
    "tryon_xxxx", "status"
:
    "completed", "result_url"
:
    "https://...", "result_thumb_url"
:
    "https://...", "processing_time"
:
    12.5
}

// 失败事件
event: failed
data: {
    "record_uuid"
:
    "tryon_xxxx", "status"
:
    "failed", "error_message"
:
    "AI 引擎处理超时"
}

// 心跳事件（每 15 秒）
event: heartbeat
data: {
    "ts"
:
    1700000000
}
```

**业务规则**:

- SSE 连接超时时间: 5 分钟（超时后客户端自动重连）
- 客户端应在 `completed` 或 `failed` 事件后关闭连接
- 服务端通过 Redis Pub/Sub 向 SSE 视图推送进度（Celery 任务发布 → SSE 视图订阅）
- 同一 `task_uuid` 只允许一个活跃 SSE 连接，新连接自动替换旧连接

---

## 6. 前端设计

### 6.1 技术方案

| 项目       | 方案                       | 说明                    |
|----------|--------------------------|-----------------------|
| 架构       | 单页应用 (SPA)               | `docs/index.html` 单文件 |
| 样式       | Tailwind CSS CDN         | 响应式布局                 |
| 状态管理     | 全局 `state` 对象            | 简单直接                  |
| 持久化      | localStorage + API       | 本地缓存 + 服务端同步          |
| HTTP 客户端 | 封装 `Api` 模块              | 统一请求/响应/错误处理          |
| 实时通信     | SSE (Server-Sent Events) | 试穿进度推送                |
| 多语言      | 内置 `i18n` 模块             | 简中/繁中/English         |

### 6.2 前端模块划分（逻辑模块，非文件拆分）

```
┌─────────────────────────────────────────────────┐
│                  docs/index.html                 │
├─────────────────────────────────────────────────┤
│  CSS Layer                                       │
│  ├── CSS Variables (主题系统/深色模式)            │
│  ├── Tailwind CDN                                │
│  ├── Custom Styles (动画/骨架屏/响应式)           │
│  └── Reduced Motion (动画降级)                    │
├─────────────────────────────────────────────────┤
│  HTML Layer                                      │
│  ├── Header (Logo/语言/设置/门店信息)             │
│  ├── Main Content                                │
│  │   ├── Left Sidebar (形象/分类/服装列表)        │
│  │   ├── Center (预览/加载/操作按钮)              │
│  │   └── Right Sidebar (已选/试穿记录)            │
│  └── Modals (登录/设置/门店/衣橱/确认/放大)       │
├─────────────────────────────────────────────────┤
│  JS Layer                                        │
│  ├── i18n Module (多语言)                        │
│  ├── Api Module (HTTP 客户端)                    │
│  ├── Auth Module (登录/Token 管理)               │
│  ├── Storage Module (本地持久化)                  │
│  ├── State Module (全局状态)                      │
│  ├── UI Module (通知/确认/弹窗)                   │
│  ├── Clothing Module (服装选择/渲染)              │
│  ├── TryOn Module (试穿触发/SSE进度)              │
│  ├── History Module (记录/收藏/删除)              │
│  ├── Media Module (拍照/上传/预览)                │
│  ├── Guide Module (首次引导)                      │
│  ├── Network Module (网络检测)                    │
│  ├── Keyboard Module (快捷键)                     │
│  ├── Theme Module (深色模式切换)                  │
│  ├── Performance Module (Web Vitals)              │
│  └── Init Module (初始化/错误边界)                │
└─────────────────────────────────────────────────┘
```

### 6.3 前端 API 调用层设计

```typescript
// 统一 HTTP 客户端封装
const Api = {
    baseUrl: '/api/v1/',
    token: null,

    // 请求拦截器：自动附加 Token 和 Accept-Language
    async request(method, path, data, options) { ...
    },

    // Token 管理
    setToken(token) { ...
    },
    clearToken() { ...
    },
    getRefreshToken() { ...
    },

    // 自动刷新 Token
    async refreshToken() { ...
    },

    // 统一错误处理
    handleError(error) { ...
    },

    // 业务接口
    auth: {
        login(username, password) { ...
        },
        smsLogin(phone, code) { ...
        },
        sendSms(phone) { ...
        },
        refresh(refreshToken) { ...
        },
        logout() { ...
        },
        getMe() { ...
        },
    },
    wardrobe: {
        getClothing(params) { ...
        },
        uploadClothing(formData) { ...
        },
        deleteClothing(id) { ...
        },
        getCategories() { ...
        },
    },
    tryon: {
        generate(formData) { ...
        },
        getStatus(id) { ...
        },
        getRecords(params) { ...
        },
        toggleSave(id, isSaved) { ...
        },
        deleteRecord(id) { ...
        },
        batchDelete(uuids, sessionId) { ...
        },
    },
    media: {
        upload(file, purpose) { ...
        },
    },
};
```

### 6.4 前端状态管理

```typescript
const state = {
    // 认证
    isLoggedIn: boolean;
    userInfo: MerchantInfo | null;
    accessToken: string | null;
    refreshToken: string | null;

    // 会话
    sessionId: string;           // UUID，每次打开页面生成

    // 服装
    selectedCategory: string;    // "tops"
    selectedSubcategory: string; // "t-shirt"
    selectedClothing: ClothingItem[];  // 已选服装（每类最多1件）
    clothingData: Record<string, Record<string, ClothingItem[]>>;  // 从API加载

    // 形象
    userImage: string | null;    // Base64 或 URL

    // 试穿
    hasResult: boolean;
    currentTaskId: string | null;
    tryOnHistory: TryOnRecord[];
    historyFilter: 'all' | 'saved';

    // UI
    loginTab: 'password' | 'sms';
    theme: 'light' | 'dark' | 'system';
    lang: 'zh-CN' | 'zh-TW' | 'en';
};
```

### 6.5 响应式断点

| 断点   | 宽度          | 设备     | 布局策略      |
|------|-------------|--------|-----------|
| `xl` | ≥1280px     | PC/大平板 | 三栏布局      |
| `lg` | 1024-1279px | 平板横屏   | 双栏（侧栏折叠）  |
| `md` | 640-1023px  | 平板竖屏   | 单栏（Tab切换） |
| `sm` | <640px      | 手机     | 单栏（紧凑模式）  |

### 6.6 前端安全措施

| 措施       | 说明                                                  |
|----------|-----------------------------------------------------|
| XSS 防护   | 所有动态内容使用 `textContent`，`innerHTML` 使用前 DOMPurify 消毒 |
| CSRF 防护  | JWT 无 Cookie，天然免疫 CSRF                              |
| Token 存储 | `accessToken` 存内存，`refreshToken` 存 `localStorage`   |
| Token 刷新 | 401 时自动用 `refreshToken` 刷新，刷新失败跳转登录                 |
| 敏感信息     | 手机号脱敏显示，密码不明文传输                                     |
| 图片安全     | 上传前前端校验类型和大小，后端二次校验                                 |

---

## 7. 认证与权限

### 7.1 JWT 认证流程

```
┌──────────┐     POST /auth/login/      ┌──────────┐
│  前端     │ ──────────────────────────► │  后端     │
│          │  { username, password }     │          │
│          │                             │ 验证账号  │
│          │ ◄────────────────────────── │ 密码     │
│          │  { access_token,            │          │
│          │    refresh_token,           │          │
│          │    merchant }               │          │
│          │                             │          │
│  存储     │                             │          │
│  Token    │                             │          │
│          │                             │          │
│          │  GET /wardrobe/clothing/    │          │
│          │  Authorization: Bearer xxx  │          │
│          │ ──────────────────────────► │          │
│          │                             │ 验证Token │
│          │ ◄────────────────────────── │ 返回数据  │
│          │                             │          │
│          │  Token 过期 (401)           │          │
│          │ ──────────────────────────► │          │
│          │                             │          │
│          │  POST /auth/refresh/        │          │
│          │  { refresh_token }          │          │
│          │ ──────────────────────────► │          │
│          │ ◄────────────────────────── │          │
│          │  { new_access_token }       │          │
│          │                             │          │
│          │  重试原请求                  │          │
│          │ ──────────────────────────► │          │
└──────────┘                             └──────────┘
```

### 7.2 数据隔离策略（租户隔离）

> **核心原则**: 所有业务接口的数据查询必须强制携带 `merchant_id` 条件，禁止返回其他商户的数据。禁止客户端传递`merchant_id`
> 参数，由服务端从 Token 中自动提取。

#### 7.2.1 数据隔离实现

```python
# apps/common/mixins.py

class MerchantQuerySetMixin:
    """
    所有业务 Model 的 Manager Mixin
    自动过滤当前商户的数据，防止跨租户访问
    """

    def get_queryset(self):
        return super().get_queryset().filter(
            merchant_id=self.request.merchant_id,
            is_deleted=False,
        )


class MerchantAccessMixin:
    """
    详情接口的访问控制 Mixin
    获取单条记录时自动校验是否属于当前商户
    """

    def get_object(self):
        obj = super().get_object()
        if obj.merchant_id != self.request.merchant_id:
            raise NotFound()  # 返回 404，不暴露数据是否存在
        return obj
```

#### 7.2.2 禁止客户端传递 merchant_id

```python
# apps/common/serializers.py

class MerchantFilteredSerializer:
    """
    序列化器中禁止客户端传入 merchant_id
    merchant_id 由服务端从 Token 中自动填充
    """

    def validate(self, attrs):
        # 移除客户端可能传入的 merchant_id
        attrs.pop('merchant_id', None)
        return attrs
```

#### 7.2.3 URL 防猜测策略

| 策略             | 说明                                                            |
|----------------|---------------------------------------------------------------|
| **UUID 主键**    | 业务表使用 `UUID` 作为对外暴露的主键，替代自增 ID，防止遍历                           |
| **Token 绑定商户** | JWT Payload 中存储 `merchant_id`，每次请求从 Token 提取，不信任任何客户端参数       |
| **统一查询过滤**     | 所有 `SELECT` 查询自动追加 `WHERE merchant_id = ? AND is_deleted = 0` |
| **详情接口校验**     | 获取单条记录时二次校验 `merchant_id` 是否匹配，不匹配返回 404                      |
| **删除接口校验**     | 删除前校验记录归属，非本商户数据返回 404                                        |
| **不暴露数量**      | 404 不区分"不存在"和"无权限"，防止通过响应差异猜测数据                               |

#### 7.2.4 UUID 主键方案

> `clothing`、`tryon_record` 和 `merchant` 表已在 DDL 中定义 `uuid` 字段（CHAR(42) UNIQUE）。内部自增 `id` 仅用于数据库关联，对外
> API 统一使用 `uuid`。

API 路由中使用 UUID：

```
DELETE /api/v1/wardrobe/clothing/{uuid}/        # 替代 {id}
GET    /api/v1/tryon/records/{uuid}/status/     # 替代 {id}
PATCH  /api/v1/tryon/records/{uuid}/save/       # 替代 {id}
DELETE /api/v1/tryon/records/{uuid}/            # 替代 {id}
```

#### 7.2.5 数据隔离校验流程

```
客户端请求 (携带 JWT Token)
    │
    ▼
认证中间件
    ├── 解析 Token → 提取 merchant_id
    ├── 写入 request.merchant_id
    └── Token 无效 → 401
    │
    ▼
View / ViewSet
    ├── List 接口 → QuerySet 自动过滤 merchant_id
    ├── Create 接口 → 从 request.merchant_id 填充，忽略客户端传入值
    ├── Retrieve 接口 → 获取后校验 merchant_id，不匹配返回 404
    ├── Update 接口 → 获取后校验 merchant_id，不匹配返回 404
    └── Destroy 接口 → 获取后校验 merchant_id，不匹配返回 404
    │
    ▼
返回数据（仅包含当前商户的数据）
```

### 7.3 权限矩阵

| 操作           | 商家           | 未认证 | Admin |
|--------------|--------------|-----|-------|
| 登录           | ✅            | ✅   | ✅     |
| 查看服装列表       | ✅（仅自己的）      | ❌   | ✅（全部） |
| 上传服装         | ✅            | ❌   | ✅     |
| 删除服装         | ✅（仅自己的自定义服装） | ❌   | ✅（全部） |
| 提交试穿         | ✅            | ❌   | ✅     |
| 查看试穿记录       | ✅（仅自己的）      | ❌   | ✅（全部） |
| 收藏/取消收藏      | ✅（仅自己的）      | ❌   | ✅     |
| 删除试穿记录       | ✅（仅自己的）      | ❌   | ✅（全部） |
| Django Admin | ❌            | ❌   | ✅     |

### 7.4 限流策略

| 接口     | 限流规则       | 说明      |
|--------|------------|---------|
| 登录     | 5次/分钟/IP   | 防暴力破解   |
| 发送验证码  | 1次/60秒/手机号 | 防短信轰炸   |
| 发送验证码  | 10次/小时/IP  | IP 级别限制 |
| 提交试穿   | 10次/分钟/商家  | 防滥用     |
| 上传图片   | 20次/分钟/商家  | 防存储滥用   |
| 其他 API | 60次/分钟/商家  | 通用限流    |

---

## 8. AI 试穿引擎集成

### 8.1 引擎适配层设计

```python
# apps/tryon/ai_engines/base.py
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class TryOnResult:
    success: bool
    result_url: str | None = None
    result_thumb_url: str | None = None
    error_message: str | None = None
    processing_time: float | None = None
    task_id: str | None = None


class BaseAIEngine(ABC):
    """AI 试穿引擎抽象基类"""

    engine_name: str  # "aliyun" / "tencent" / "seeddance"

    @abstractmethod
    async def submit_task(
            self,
            avatar_url: str,
            clothing_urls: list[str],
            callback_url: str | None = None,
    ) -> str:
        """提交试穿任务，返回 task_id"""
        pass

    @abstractmethod
    async def poll_result(self, task_id: str) -> TryOnResult:
        """轮询任务结果"""
        pass

    @abstractmethod
    async def get_progress(self, task_id: str) -> int:
        """获取进度百分比 0-100"""
        pass
```

### 8.2 异步任务流程

```
前端提交试穿
    │
    ▼
API View (同步)
    ├── 校验参数
    ├── 检查配额
    ├── 上传形象照片到存储
    ├── 创建 TryOnRecord (status=pending)
    └── 投递 Celery 任务
         │
         ▼
Celery Task (异步)
    ├── 更新状态 → processing
    ├── 调用 AI 引擎 submit_task()
    ├── 轮询 AI 引擎 poll_result()
    │   ├── 成功 → 下载结果图 → 上传到存储
    │   │         → 更新状态 → completed
    │   │         → 扣减配额
    │   │         → SSE 推送完成
    │   └── 失败 → 更新状态 → failed
    │             → SSE 推送失败
    └── 记录处理耗时
```

### 8.3 Celery 任务配置

```python
# config/settings/base.py
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND', 'redis://localhost:6379/1')

CELERY_TASK_ROUTES = {
    'apps.tryon.tasks.process_tryon': {
        'queue': 'tryon',
        'rate_limit': '10/m',  # 每分钟最多10个任务
    },
}

CELERY_TASK_TIME_LIMIT = 180  # 硬超时 3 分钟
CELERY_TASK_SOFT_TIME_LIMIT = 150  # 软超时 2.5 分钟
```

### 8.4 AI 引擎熔断与降级

当 AI 引擎连续失败时，自动熔断并切换到备用引擎，避免持续调用失败的服务。

```python
# apps/tryon/ai_engines/circuit_breaker.py
from datetime import datetime, timedelta
from django.core.cache import cache

class AICircuitBreaker:
    """AI 引擎熔断器"""
    
    def __init__(self, engine_name: str, fail_threshold: int = 5, reset_timeout: int = 60):
        self.engine_name = engine_name
        self.fail_threshold = fail_threshold
        self.reset_timeout = reset_timeout
        self.cache_key = f"ai:breaker:{engine_name}"
    
    def is_open(self) -> bool:
        """检查熔断器是否打开（引擎是否被熔断）"""
        state = cache.get(self.cache_key)
        if state is None:
            return False
        return state.get('open', False)
    
    def record_success(self):
        """记录成功，重置计数器"""
        cache.delete(self.cache_key)
    
    def record_failure(self):
        """记录失败，达到阈值时触发熔断"""
        state = cache.get(self.cache_key) or {'fail_count': 0, 'open': False}
        state['fail_count'] += 1
        
        if state['fail_count'] >= self.fail_threshold:
            state['open'] = True
            state['opened_at'] = datetime.now().isoformat()
        
        cache.set(self.cache_key, state, timeout=self.reset_timeout)
    
    def get_fallback_engine(self) -> str | None:
        """获取备用引擎"""
        fallback_map = {
            'aliyun': 'tencent',
            'tencent': 'aliyun',
            'seeddance': 'aliyun',
        }
        return fallback_map.get(self.engine_name)
```

**降级策略**:

| 场景          | 处理方式                          |
|-------------|-------------------------------|
| 主引擎连续 5 次失败 | 熔断 60 秒，自动切换到备用引擎             |
| 所有引擎均熔断     | 返回 `AI_ENGINE_ERROR`，提示用户稍后重试 |
| 引擎恢复        | 熔断超时后自动尝试，成功则关闭熔断器            |
| 单次超时        | 不触发熔断，仅记录日志                   |

---

## 9. 文件存储方案

### 9.1 存储架构

```
MinIO / 阿里云 OSS
├── avatars/                        # 顾客形象照片
│   └── {merchant_uuid}/             # mcht_xxx
│       └── {uuid}.jpg               # tryon_xxx.jpg
├── clothing/                       # 服装图片
│   └── {merchant_uuid}/             # mcht_xxx
│       ├── original/
│       │   └── {uuid}.jpg           # cloth_xxx.jpg
│       └── thumbs/
│           └── {uuid}_300.jpg       # cloth_xxx_300.jpg
├── results/                        # AI 生成效果图
│   └── {merchant_uuid}/             # mcht_xxx
│       ├── original/
│       │   └── {uuid}.png           # tryon_xxx.png
│       └── thumbs/
│           └── {uuid}_300.jpg       # tryon_xxx_300.jpg
└── presets/                        # 预设服装图片
    └── {category}/{subcategory}/
        └── {name}.jpg
```

> 路径中使用带前缀的 uuid，文件名即可识别业务类型和归属，无需查数据库。

### 9.2 图片处理规则

| 用途     | 最大尺寸   | 格式      | 质量  | 缩略图   |
|--------|--------|---------|-----|-------|
| 形象照片   | 2048px | JPG     | 85% | 300px |
| 服装图片   | 1024px | JPG/PNG | 90% | 300px |
| AI 结果图 | 2048px | PNG     | 无损  | 300px |

### 9.3 文件上传安全校验

上传文件需经过四层校验，防止恶意文件上传：

```python
# apps/media/services.py
import hashlib
import magic
from PIL import Image
from django.core.exceptions import ValidationError

ALLOWED_MIME_TYPES = {'image/jpeg', 'image/png', 'image/webp'}
MAX_IMAGE_DIMENSION = 8000  # 最大像素尺寸，防止解压炸弹


def validate_upload_file(file) -> dict:
    """
    完整的图片安全校验，返回文件元信息
    
    Raises:
        ValidationError: 校验失败时抛出
    """
    # 1. 文件大小校验（由 Django 配置限制，此处二次确认）
    file.seek(0, 2)
    file_size = file.tell()
    file.seek(0)
    if file_size > 10 * 1024 * 1024:
        raise ValidationError({'error_code': 'FILE_TOO_LARGE', 'message': '文件大小不能超过10MB'})

    # 2. MIME 类型校验（不信任 Content-Type 头，使用 magic 字节检测）
    file_header = file.read(2048)
    file.seek(0)
    detected_mime = magic.from_buffer(file_header, mime=True)
    if detected_mime not in ALLOWED_MIME_TYPES:
        raise ValidationError({'error_code': 'FILE_TYPE_INVALID', 'message': f'不支持的文件类型: {detected_mime}'})

    # 3. 图片完整性校验（防止畸形文件）
    try:
        img = Image.open(file)
        img.verify()
    except Exception:
        raise ValidationError({'error_code': 'FILE_CORRUPTED', 'message': '图片文件已损坏或格式不正确'})

    # 4. 图片尺寸校验（防止像素炸弹 DoS）
    file.seek(0)
    img = Image.open(file)
    if img.width > MAX_IMAGE_DIMENSION or img.height > MAX_IMAGE_DIMENSION:
        raise ValidationError({'error_code': 'IMAGE_TOO_LARGE', 'message': f'图片尺寸不能超过 {MAX_IMAGE_DIMENSION}px'})

    # 5. 计算文件哈希（用于去重）
    file.seek(0)
    file_hash = hashlib.sha256(file.read()).hexdigest()
    file.seek(0)

    return {
        'mime_type': detected_mime,
        'width': img.width,
        'height': img.height,
        'size': file_size,
        'file_hash': file_hash,
        'format': img.format.lower(),  # 'jpeg', 'png', 'webp'
    }
```

### 9.4 存储配置

```python
# config/settings/base.py
# 开发环境使用本地文件系统
STORAGE_BACKEND = 'filesystem'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
MEDIA_URL = '/media/'

# 生产环境使用 MinIO 或阿里云 OSS
# STORAGE_BACKEND = 'minio'  # 或 'oss'
# MINIO_ENDPOINT = 'localhost:9000'
# MINIO_ACCESS_KEY = 'xxx'
# MINIO_SECRET_KEY = 'xxx'
# MINIO_BUCKET_NAME = 'tryon'
# MINIO_SECURE = False

# 或阿里云 OSS
# OSS_ACCESS_KEY_ID = 'xxx'
# OSS_ACCESS_KEY_SECRET = 'xxx'
# OSS_BUCKET_NAME = 'tryon'
# OSS_ENDPOINT = 'oss-cn-hangzhou.aliyuncs.com'
```

---

## 10. 多语言方案

### 10.1 后端 i18n

```python
# config/settings/base.py
LANGUAGE_CODE = 'zh-hans'
LANGUAGES = [
    ('zh-hans', '简体中文'),
    ('zh-hant', '繁體中文'),
    ('en', 'English'),
]
LOCALE_PATHS = [
    os.path.join(BASE_DIR, 'locale'),
]
USE_I18N = True

# 中间件
MIDDLEWARE = [
    ...
    'django.middleware.locale.LocaleMiddleware',
    ...
]
```

### 10.2 前端 i18n

前端内置三语翻译字典，通过 `Accept-Language` 请求头与后端保持一致。

| 语言代码    | 前端 key  | 后端 locale |
|---------|---------|-----------|
| 简体中文    | `zh-CN` | `zh-hans` |
| 繁体中文    | `zh-TW` | `zh-hant` |
| English | `en`    | `en`      |

### 10.3 服装名称多语言

预设服装名称通过 `preset_clothing.name_i18n` JSON 字段存储：

```json
{
  "zh-CN": "米白T恤",
  "zh-TW": "米白T恤",
  "en": "Off-White T-Shirt"
}
```

后端根据 `Accept-Language` 返回对应语言的名称。

---

## 11. 部署方案

### 11.1 Docker Compose 架构

```yaml
# docker/docker-compose.prod.yml
version: '3.8'
services:
  web:
    build: ..
    command: gunicorn config.wsgi:application -b 0.0.0.0:8000 -w 4
    volumes:
      - ..:/app
      - media_data:/app/media
    depends_on:
      - db
      - redis
    env_file:
      - ../.env

  celery-worker:
    build: ..
    command: celery -A config worker -l info -Q tryon -c 2 --max-tasks-per-child=50
    volumes:
      - ..:/app
    depends_on:
      - db
      - redis
    env_file:
      - ../.env
    deploy:
      replicas: 2
    restart: unless-stopped

  celery-beat:
    build: ..
    command: celery -A config beat -l info
    depends_on:
      - redis
    env_file:
      - ../.env

  db:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_PASSWORD}
      MYSQL_DATABASE: ${DB_NAME}
      MYSQL_CHARSET: utf8mb4
    volumes:
      - db_data:/var/lib/mysql
    ports:
      - "3306:3306"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - media_data:/usr/share/nginx/media:ro
    depends_on:
      - web

volumes:
  db_data:
  redis_data:
  media_data:
```

### 11.2 环境变量

```bash
# .env
# Django
SECRET_KEY=your-secret-key-here
DEBUG=False
ALLOWED_HOSTS=your-domain.com

# Database
DB_ENGINE=django.db.backends.mysql
DB_NAME=tryon_db
DB_USER=tryon
DB_PASSWORD=your-db-password
DB_HOST=db
DB_PORT=3306

# Redis
REDIS_URL=redis://redis:6379/0

# JWT
JWT_ACCESS_TOKEN_LIFETIME=86400    # 24h
JWT_REFRESH_TOKEN_LIFETIME=604800  # 7d

# Storage
STORAGE_BACKEND=minio
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=your-access-key
MINIO_SECRET_KEY=your-secret-key
MINIO_BUCKET_NAME=tryon

# AI Engines
ALIYUN_ACCESS_KEY_ID=xxx
ALIYUN_ACCESS_KEY_SECRET=xxx
TENCENT_SECRET_ID=xxx
TENCENT_SECRET_KEY=xxx

# SMS (短信服务)
SMS_PROVIDER=aliyun
SMS_ACCESS_KEY=xxx
SMS_ACCESS_SECRET=xxx
SMS_SIGN_NAME=AI试衣
SMS_TEMPLATE_CODE=SMS_123456

# Celery
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/1
```

---

## 12. 验收标准

### 12.1 功能验收

- [ ] 商家可通过账号密码登录，登录后 Token 正确返回
- [ ] 商家可通过手机验证码登录，验证码 60 秒内有效
- [ ] Token 过期后自动刷新，刷新失败跳转登录页
- [ ] 服装列表按分类正确展示，支持 6 大类 20+ 子类
- [ ] 商家可上传自定义服装到衣橱，图片自动生成缩略图
- [ ] 商家可删除自定义服装，预设服装不可删除
- [ ] 顾客可拍照/上传形象照片，支持移动端直接调用摄像头
- [ ] 每个服装大类最多选择 1 件，不同大类可自由搭配
- [ ] 点击试穿后正确调用 AI 引擎，生成效果图
- [ ] 试穿过程中显示进度（SSE 实时推送）
- [ ] 试穿成功后自动保存到记录列表
- [ ] 试穿记录支持收藏/取消收藏
- [ ] 试穿记录支持按"全部/收藏"筛选
- [ ] 支持清空当前会话所有数据（保留登录状态）
- [ ] 配额用完后提示商家，不允许继续试穿
- [ ] 三语切换（简中/繁中/English）实时生效
- [ ] 响应式布局：PC/平板/手机均无变形
- [ ] 网络断开时显示提示条，恢复后自动隐藏

### 12.2 安全验收

- [ ] 密码使用 PBKDF2 哈希存储，不明文
- [ ] 手机号加密存储，API 返回脱敏格式
- [ ] JWT Token 有效期正确，过期后无法使用
- [ ] 登录接口限流 5次/分钟/IP
- [ ] 验证码接口限流 1次/60秒/手机号
- [ ] 文件上传校验类型和大小，防止恶意文件
- [ ] 所有 API 接口需要认证（除登录/验证码外）
- [ ] 商家只能操作自己的数据（租户隔离）

### 12.3 性能验收

- [ ] 首屏加载时间 < 3 秒（3G 网络）
- [ ] 服装列表接口响应 < 200ms
- [ ] AI 试穿任务提交响应 < 500ms
- [ ] 图片上传（5MB）< 3 秒
- [ ] 支持 100 个商家并发使用
- [ ] 数据库查询使用索引，慢查询 < 100ms

### 12.4 Django Admin 验收

- [ ] 商家列表：可查看/搜索/禁用商家
- [ ] 商家详情：可查看配额使用情况
- [ ] 服装管理：可查看/搜索/删除所有商家的服装
- [ ] 试穿记录：可查看/搜索/删除所有记录
- [ ] 配额管理：可手动调整商家配额
- [ ] 数据统计：试穿次数趋势、成功率、引擎使用分布

---

## 附录 A：服装分类体系

| 大类 (category) | 子类 (subcategory) | 简中  | 繁中  | English        |
|---------------|------------------|-----|-----|----------------|
| tops          | t-shirt          | T恤  | T恤  | T-Shirts       |
| tops          | shirt            | 衬衫  | 襯衫  | Shirts         |
| tops          | sweater          | 针织衫 | 針織衫 | Sweaters       |
| tops          | tank             | 背心  | 背心  | Tanks          |
| tops          | hoodie           | 卫衣  | 衛衣  | Hoodies        |
| bottoms       | jeans            | 牛仔裤 | 牛仔褲 | Jeans          |
| bottoms       | trousers         | 休闲裤 | 休閒褲 | Trousers       |
| bottoms       | shorts           | 短裤  | 短褲  | Shorts         |
| bottoms       | skirt            | 半身裙 | 半身裙 | Skirts         |
| dresses       | casual           | 休闲裙 | 休閒裙 | Casual Dresses |
| dresses       | formal           | 礼服裙 | 禮服裙 | Formal Dresses |
| dresses       | knit             | 针织裙 | 針織裙 | Knit Dresses   |
| outerwear     | jacket           | 夹克  | 夾克  | Jackets        |
| outerwear     | coat             | 大衣  | 大衣  | Coats          |
| outerwear     | blazer           | 西装  | 西裝  | Blazers        |
| shoes         | sneakers         | 运动鞋 | 運動鞋 | Sneakers       |
| shoes         | heels            | 高跟鞋 | 高跟鞋 | Heels          |
| shoes         | boots            | 靴子  | 靴子  | Boots          |
| shoes         | flat             | 平底鞋 | 平底鞋 | Flats          |
| accessories   | bag              | 包袋  | 包袋  | Bags           |
| accessories   | hat              | 帽子  | 帽子  | Hats           |
| accessories   | scarf            | 围巾  | 圍巾  | Scarves        |
| accessories   | jewelry          | 首饰  | 首飾  | Jewelry        |

---

## 附录 B：API 路由汇总

| 方法     | 路径                                          | 说明       | 认证 |
|--------|---------------------------------------------|----------|----|
| POST   | `/api/v1/auth/login/`                       | 账号密码登录   | ❌  |
| POST   | `/api/v1/auth/sms-login/`                   | 验证码登录    | ❌  |
| POST   | `/api/v1/auth/send-sms/`                    | 发送验证码    | ❌  |
| POST   | `/api/v1/auth/refresh/`                     | 刷新 Token | ❌  |
| POST   | `/api/v1/auth/logout/`                      | 退出登录     | ✅  |
| GET    | `/api/v1/auth/me/`                          | 当前商家信息   | ✅  |
| GET    | `/api/v1/wardrobe/categories/`              | 分类配置     | ✅  |
| GET    | `/api/v1/wardrobe/clothing/`                | 服装列表     | ✅  |
| POST   | `/api/v1/wardrobe/clothing/upload/`         | 上传服装     | ✅  |
| DELETE | `/api/v1/wardrobe/clothing/{uuid}/`         | 删除服装     | ✅  |
| POST   | `/api/v1/tryon/generate/`                   | 提交试穿     | ✅  |
| GET    | `/api/v1/tryon/records/{uuid}/status/`      | 试穿状态     | ✅  |
| GET    | `/api/v1/tryon/records/`                    | 试穿记录列表   | ✅  |
| PATCH  | `/api/v1/tryon/records/{uuid}/save/`        | 收藏/取消    | ✅  |
| DELETE | `/api/v1/tryon/records/{uuid}/`             | 删除记录     | ✅  |
| POST   | `/api/v1/tryon/records/batch-delete/`       | 批量删除     | ✅  |
| POST   | `/api/v1/media/upload/`                     | 上传图片     | ✅  |
| GET    | `/api/v1/tryon/tasks/{task_uuid}/progress/` | SSE 试穿进度 | ✅  |
| GET    | `/api/health/`                              | 健康检查     | ❌  |

---

## 附录 C：补充设计细节

### C.1 商家账号管理

#### C.1.1 商家创建方式

商家账号**不支持自助注册**，由平台管理员通过 Django Admin 手动创建。

**Django Admin 创建商家流程**:

1. Admin 填写：用户名、手机号、初始密码、门店名称
2. 系统自动生成：`uuid`、`phone_encrypted`（AES加密）、`password`（PBKDF2哈希）
3. 系统自动分配：默认配额 100 次/月
4. 创建成功后，Admin 将账号信息通过安全渠道（短信/邮件）告知商家
5. 商家首次登录后可修改密码

#### C.1.2 密码强度校验

| 规则   | 要求                       |
|------|--------------------------|
| 最小长度 | 8 位                      |
| 复杂度  | 必须包含大写字母、小写字母、数字中的至少 2 种 |
| 禁止   | 不能与用户名相同                 |
| 最大长度 | 128 位                    |

#### C.1.3 登录安全策略

| 策略    | 规则                                       |
|-------|------------------------------------------|
| 失败锁定  | 连续 5 次密码错误，锁定账号 30 分钟                    |
| 锁定通知  | 锁定时记录 `status=0`，Admin 后台可手动解锁           |
| 登录日志  | 每次登录记录 `last_login_at` 和 `last_login_ip` |
| 单设备登录 | 新登录会使旧 Token 失效（Redis 黑名单机制）             |

**JWT 黑名单实现细节**:

```python
# apps/accounts/services.py
from django.core.cache import cache


class TokenBlacklistService:
    """JWT Token 黑名单服务（单设备登录 + 退出登录）"""

    @staticmethod
    def invalidate_old_tokens(merchant_id: int, current_jti: str, current_exp: int):
        """
        使当前商家的所有旧 Token 失效
        - 将旧 jti 加入黑名单
        - 更新当前活跃 jti
        
        Args:
            merchant_id: 商家ID
            current_jti: 当前 Token 的 JWT ID
            current_exp: 当前 Token 的过期时间戳
        """
        active_key = f"auth:tokens:mcht_{merchant_id}"
        old_jtis = cache.get(active_key, set())

        # 将所有旧 jti 加入黑名单
        for old_jti in old_jtis:
            if old_jti != current_jti:
                blacklist_key = f"auth:token:blacklist:{old_jti}"
                # 黑名单过期时间 = 旧 Token 剩余有效期（最多 24h）
                cache.set(blacklist_key, "1", timeout=86400)

        # 更新当前活跃 jti
        cache.set(active_key, {current_jti}, timeout=86400)

    @staticmethod
    def is_blacklisted(jti: str) -> bool:
        """检查 Token 是否在黑名单中"""
        return cache.get(f"auth:token:blacklist:{jti}") is not None

    @staticmethod
    def blacklist_all(merchant_id: int):
        """使该商家的所有 Token 失效（用于修改密码、账号锁定等场景）"""
        active_key = f"auth:tokens:mcht_{merchant_id}"
        old_jtis = cache.get(active_key, set())

        for jti in old_jtis:
            cache.set(f"auth:token:blacklist:{jti}", "1", timeout=86400)

        cache.delete(active_key)
```

```python
# apps/accounts/authentication.py — SimpleJWT 自定义认证
from rest_framework_simplejwt.authentication import JWTAuthentication

class CustomJWTAuthentication(JWTAuthentication):
    """自定义 JWT 认证，增加黑名单校验"""
    
    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None
        
        user, token = result
        jti = token.get('jti')
        
        # 检查黑名单
        if TokenBlacklistService.is_blacklisted(jti):
            raise AuthenticationFailed('Token has been invalidated')
        
        # 将 merchant_id 注入 request（供租户隔离使用）
        request.merchant_id = token.get('merchant_id')
        return result
```

#### C.1.4 修改密码

**接口**: `PUT /api/v1/auth/password/`

| 参数             | 类型     | 必填 | 说明           |
|----------------|--------|----|--------------|
| `old_password` | string | 是  | 旧密码          |
| `new_password` | string | 是  | 新密码（需满足强度规则） |

修改密码后，当前 Token 立即失效，需重新登录。

---

### C.2 配额管理

#### C.2.1 配额重置机制

- 配额按**自然月**重置，每月 1 号 00:00 自动将 `quota_used` 归零
- 由 Celery Beat 定时任务执行

```python
# apps/accounts/tasks.py
from django.db import transaction
from django.utils import timezone


@shared_task
def reset_monthly_quota():
    """每月1号重置所有正常状态商家的配额"""
    today = date.today()
    # 仅重置 quota_reset_at < 本月1号的商家，防止重复执行
    with transaction.atomic():
        updated = Merchant.objects.filter(
            status=1, is_deleted=False,
            quota_reset_at__lt=today.replace(day=1),
        ).update(quota_used=0, quota_reset_at=today)
        logger.info(f"配额重置完成，共更新 {updated} 个商家")
```

#### C.2.2 配额扣减规则

| 场景                    | 是否扣减            |
|-----------------------|-----------------|
| AI 试穿成功（`completed`）  | ✅ 扣减 1 次        |
| AI 试穿失败（`failed`）     | ❌ 不扣减           |
| AI 试穿超时               | ❌ 不扣减           |
| 重复提交（同 session 同服装组合） | ❌ 不扣减（直接返回已有结果） |

#### C.2.3 配额不足响应

```typescript
// 配额不足时返回
{
    success: false;
    error_code: "QUOTA_EXCEEDED";
    message: "本月试穿配额已用完，请联系管理员充值";
    data: {
        quota_total: 100;
        quota_used: 100;
        quota_remaining: 0;
        reset_date: "2026-05-01";  // 下次重置日期
    }
    ;
}
```

---

### C.3 并发控制

#### C.3.1 同一商家并发限制

- 同一商家**同时只能有 1 个进行中**（`status=pending/processing`）的试穿任务
- 提交新任务时，如果已有进行中的任务，返回 `TRYON_TASK_IN_PROGRESS`

```typescript
{
    success: false;
    error_code: "TRYON_TASK_IN_PROGRESS";
    message: "当前有试穿任务正在进行中，请等待完成后再试";
    data: {
        current_task_uuid: "tryon_550e8400-e29b-41d4-a716-446655440000";  // 当前进行中的任务UUID
    }
    ;
}
```

#### C.3.2 幂等性保证

- 同一 `session_id` + 相同 `clothing_uuids` 组合，24 小时内不重复提交
- 直接返回已有的试穿记录（如果存在）

---

### C.4 数据清理策略

#### C.4.1 定时清理任务（Celery Beat）

| 任务           | 频率  | 说明                                                          |
|--------------|-----|-------------------------------------------------------------|
| 清理过期验证码      | 每小时 | 删除 `sms_log` 中 `expired_at < NOW()` 且 `is_used=0` 的记录       |
| 清理过期会话记录     | 每天  | 软删除 `tryon_record` 中 `created_at < 30天前` 且 `is_saved=0` 的记录 |
| 清理孤立图片       | 每周  | 扫描存储中无关联记录的图片文件并删除                                          |
| 清理 Redis 黑名单 | 每天  | 清理已过期的 Token 黑名单                                            |

#### C.4.2 软删除与物理删除

| 数据类型   | 删除方式   | 说明                       |
|--------|--------|--------------------------|
| 服装     | 软删除    | `is_deleted=1`，Admin 可恢复 |
| 试穿记录   | 软删除    | `is_deleted=1`，30天后物理删除  |
| 形象照片   | 随记录软删除 | 关联记录软删除后，图片保留 30 天       |
| AI 结果图 | 随记录软删除 | 同上                       |
| 验证码日志  | 物理删除   | 过期后直接删除                  |

---

### C.5 Redis Key 命名规范与 Pub/Sub 频道

所有 Redis Key 采用 **`{业务}:{实体}:{标识}`** 三段式命名，与 UUID 前缀体系配合使用。

| Key 格式                           | 用途             | 过期时间            | 示例                                |
|----------------------------------|----------------|-----------------|-----------------------------------|
| `auth:token:blacklist:{jti}`     | JWT 黑名单（单设备登录） | 与 Token 剩余有效期一致 | `auth:token:blacklist:abc123`     |
| `auth:sms:limit:{phone}`         | 验证码发送频率限制      | 60s             | `auth:sms:limit:13800138000`      |
| `auth:login:fail:{ip}`           | 登录失败计数         | 30min           | `auth:login:fail:192.168.1.1`     |
| `tryon:task:{task_uuid}`         | 试穿任务状态缓存       | 1h              | `tryon:task:task_7c9e6679...`     |
| `tryon:lock:{merchant_uuid}`     | 商家试穿并发锁        | 3min            | `tryon:lock:mcht_f47ac10b...`     |
| `tryon:idempotent:{hash}`        | 幂等性去重          | 24h             | `tryon:idempotent:a1b2c3d4`       |
| `cache:clothing:{merchant_uuid}` | 服装列表缓存         | 5min            | `cache:clothing:mcht_f47ac10b...` |
| `cache:categories:{lang}`        | 分类配置缓存         | 1h              | `cache:categories:zh-CN`          |
| `rate:{merchant_uuid}:{api}`     | API 限流计数       | 1min            | `rate:mcht_f47ac10b...:tryon`     |

**命名规则**:

- 第一段：业务域（`auth`/`tryon`/`cache`/`rate`）
- 第二段：实体类型（`token`/`sms`/`task`/`lock`/`clothing`）
- 第三段：具体标识（UUID / 手机号 / IP / 哈希值）

#### C.5.1 Redis Pub/Sub 频道（SSE 进度推送）

Celery 任务通过 Redis Pub/Sub 向 SSE 视图推送进度，频道命名与 Key 规范保持一致：

| 频道格式                             | 用途          | 发布者         | 订阅者      |
|----------------------------------|-------------|-------------|----------|
| `sse:tryon:progress:{task_uuid}` | 单个试穿任务的进度事件 | Celery Task | SSE View |
| `sse:tryon:heartbeat`            | 全局心跳频道（可选）  | Celery Beat | SSE View |

**消息格式**（与 SSE 事件 data 字段一致）：

```json
{
  "event": "progress",
  "data": {
    "record_uuid": "tryon_xxx",
    "status": "processing",
    "progress": 45
  }
}
```

**连接管理**：

- SSE View 订阅 `sse:tryon:progress:{task_uuid}` 频道
- Celery Task 完成后发布消息到该频道
- SSE View 收到 `completed` 或 `failed` 事件后自动取消订阅并关闭连接
- 使用 Redis `SETNX` 实现同一 `task_uuid` 只允许一个活跃 SSE 连接

---

### C.6 CORS 与安全头

#### C.6.1 CORS 配置

```python
# config/settings/base.py
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [
    "https://your-domain.com",
    "https://admin.your-domain.com",
]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
CORS_ALLOW_HEADERS = ["Authorization", "Content-Type", "Accept-Language"]
```

#### C.6.2 安全响应头

```python
# config/settings/base.py
SECURE_SSL_REDIRECT = True  # 强制 HTTPS
SECURE_HSTS_SECONDS = 31536000  # HSTS 1年
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

SECURE_CONTENT_TYPE_NOSNIFF = True  # 防止 MIME 嗅探
SECURE_BROWSER_XSS_FILTER = True  # 浏览器 XSS 过滤
X_FRAME_OPTIONS = 'DENY'  # 禁止 iframe 嵌入
CONTENT_SECURITY_POLICY = (
    "default-src 'self'; "
    "img-src 'self' data: https:; "
    "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src 'self' https://fonts.gstatic.com; "
    "connect-src 'self';"
)
```

---

### C.7 前端补充设计

#### C.7.1 未登录拦截策略

| 场景            | 处理方式                   |
|---------------|------------------------|
| 页面加载时未登录      | 显示登录弹窗，遮罩主内容           |
| Token 过期（401） | 自动尝试刷新 Token，刷新失败弹出登录框 |
| 手动退出登录        | 清空状态，弹出登录框             |
| 试穿/上传等操作未登录   | 弹出登录框，登录成功后自动重试原操作     |

#### C.7.2 API 请求 Loading 管理

```typescript
// 全局 loading 计数器
let loadingCount = 0;

function showGlobalLoading() {
    loadingCount++;
    if (loadingCount === 1) {
        // 显示顶部进度条或全局 loading 遮罩
    }
}

function hideGlobalLoading() {
    loadingCount--;
    if (loadingCount <= 0) {
        loadingCount = 0;
        // 隐藏 loading
    }
}
```

#### C.7.3 图片上传进度

```typescript
// 使用 XMLHttpRequest 替代 fetch 以获取上传进度
function uploadWithProgress(file, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                onProgress(Math.round((e.loaded / e.total) * 100));
            }
        });
        xhr.addEventListener('load', () => resolve(JSON.parse(xhr.responseText)));
        xhr.addEventListener('error', reject);
        xhr.open('POST', '/api/v1/media/upload/');
        xhr.setRequestHeader('Authorization', `Bearer ${Api.token}`);
        const formData = new FormData();
        formData.append('file', file);
        xhr.send(formData);
    });
}
```

---

### C.8 部署补充

#### C.8.1 健康检查接口

```python
# apps/common/views.py
from django.http import JsonResponse
from django.db import connections


def health_check(request):
    """健康检查接口，供 Docker/Nginx/负载均衡使用"""
    checks = {}

    # 数据库连接检查
    try:
        connections['default'].ensure_connection()
        checks['database'] = 'ok'
    except Exception as e:
        checks['database'] = f'error: {str(e)}'

    # Redis 连接检查
    try:
        from django.core.cache import cache
        cache.set('_health', '1', 10)
        checks['redis'] = 'ok'
    except Exception as e:
        checks['redis'] = f'error: {str(e)}'

    status = 200 if all(v == 'ok' for v in checks.values()) else 503
    return JsonResponse({'status': 'healthy' if status == 200 else 'degraded', 'checks': checks}, status=status)
```

**路由**: `GET /api/health/`（无需认证）

#### C.8.2 日志方案

```python
# config/settings/base.py
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'json': {
            '()': 'apps.common.utils.json_formatter.CustomJsonFormatter',
            'format': '%(asctime)s %(levelname)s %(name)s %(filename)s %(lineno)d %(message)s %(funcName)s %(pathname)s',
            'datefmt': '%Y-%m-%d %H:%M:%S',
            'rename_fields': {
                'asctime': 'timestamp',
                'levelname': 'level',
                'name': 'logger',
                'filename': 'file',
                'lineno': 'line',
                'funcName': 'function',
                'pathname': 'filepath',
            },
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'json',
        },
        'file': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': BASE_DIR / 'logs' / 'django.log',
            'maxBytes': 50 * 1024 * 1024,  # 50MB
            'backupCount': 10,
            'formatter': 'json',
        },
    },
    'loggers': {
        # Django 框架日志
        'django': {'handlers': ['console', 'file'], 'level': 'INFO', 'propagate': False},
        # Django 请求日志
        'django.request': {'handlers': ['console', 'file'], 'level': 'INFO', 'propagate': False},
        # 禁用 Django 默认的服务器日志（避免重复）
        'django.server': {'handlers': [], 'propagate': False, 'level': 'WARNING'},
        # 应用日志
        'apps': {'handlers': ['console', 'file'], 'level': 'INFO', 'propagate': False},
        # Celery 日志
        'celery': {'handlers': ['console', 'file'], 'level': 'INFO', 'propagate': False},
        # AI 引擎日志
        'ai_engines': {'handlers': ['console', 'file'], 'level': 'INFO', 'propagate': False},
        # OSS 日志
        'oss': {'handlers': ['console', 'file'], 'level': 'INFO', 'propagate': False},
        # 试衣服务日志
        'tryon': {'handlers': ['console', 'file'], 'level': 'INFO', 'propagate': False},
    },
}
```

#### C.8.3 数据库备份策略

| 策略   | 说明                 |
|------|--------------------|
| 备份工具 | `mysqldump`        |
| 备份频率 | 每天凌晨 2:00 全量备份     |
| 保留策略 | 保留最近 7 天的备份        |
| 备份存储 | 本地 + 异地（OSS/MinIO） |
| 恢复测试 | 每月 1 次恢复演练         |

```bash
# scripts/backup_db.sh
#!/bin/bash
BACKUP_DIR="/app/backups"
DATE=$(date +%Y%m%d_%H%M%S)
FILE="${BACKUP_DIR}/tryon_${DATE}.sql.gz"

mysqldump -h${DB_HOST} -u${DB_USER} -p${DB_PASSWORD} \
  --single-transaction --routines --triggers \
  ${DB_NAME} | gzip > ${FILE}

# 上传到 OSS（可选）
# ossutil cp ${FILE} oss://tryon-backups/mysql/

# 清理 7 天前的备份
find ${BACKUP_DIR} -name "tryon_*.sql.gz" -mtime +7 -delete
```

---

## 附录 D：性能优化方案

### D.1 数据库优化

| 优化项      | 方案                            | 说明                                        |
|----------|-------------------------------|-------------------------------------------|
| 热点数据缓存   | Redis 缓存服装列表 5 分钟             | `cache:clothing:{merchant_uuid}`，写操作时主动失效 |
| 批量插入     | `bulk_create()` 替代循环 `save()` | 试穿-服装关联表创建时使用                             |
| 查询只选必要字段 | `only()` / `defer()`          | 列表接口避免 `SELECT *`，仅返回序列化器需要的字段            |
| 慢查询监控    | Django `django-db-logger`     | 超过 100ms 的查询记录到日志                         |

### D.2 API 优化

| 优化项    | 方案                                     | 说明                                          |
|--------|----------------------------------------|---------------------------------------------|
| 响应压缩   | Nginx `gzip on; gzip_min_length 1024;` | JSON 响应通常可压缩 70%+                           |
| 条件请求   | `ETag` / `Last-Modified`               | 服装列表等变化不频繁的接口支持 304 缓存                      |
| 图片 CDN | Nginx 缓存 + `Cache-Control`             | 静态图片设置 `max-age=31536000`（1年），通过文件名哈希实现版本控制 |

### D.3 前端优化

| 优化项   | 方案                     | 说明                  |
|-------|------------------------|---------------------|
| 图片懒加载 | `loading="lazy"`       | 试穿记录列表中的图片使用原生懒加载   |
| 骨架屏   | CSS 骨架动画               | 数据加载期间显示骨架占位，提升感知速度 |
| 图片格式  | WebP 优先 + JPG 回退       | `<picture>` 标签自动适配  |
| 资源预加载 | `<link rel="preload">` | 关键 CSS/字体提前加载       |

---

## 附录 E：测试策略

### E.1 测试分层

| 测试类型     | 覆盖率要求     | 说明                       |
|----------|-----------|--------------------------|
| 单元测试     | ≥ 80%     | Model 层、Service 层、工具函数   |
| API 集成测试 | 100% 接口覆盖 | 所有 API 端点的正常/异常路径        |
| 端到端测试    | 核心流程      | 登录 → 选衣 → 试穿 → 查看结果 → 收藏 |

### E.2 测试工具

| 工具                        | 用途                                    |
|---------------------------|---------------------------------------|
| pytest + pytest-django    | 测试框架                                  |
| factory_boy               | 测试数据工厂（Merchant、Clothing、TryOnRecord） |
| responses / requests-mock | Mock 外部 HTTP 调用（AI 引擎、短信服务）           |
| freezegun                 | Mock 时间（验证码过期、配额重置等）                  |

### E.3 核心测试场景

```
认证模块
├── 账号密码登录（成功/密码错误/账号锁定/账号禁用）
├── 验证码登录（成功/验证码错误/验证码过期/频率限制）
├── Token 刷新（成功/refresh_token 过期）
└── 单设备登录（新登录踢掉旧 Token）

数据隔离
├── 商家 A 无法访问商家 B 的服装列表
├── 商家 A 无法查看商家 B 的试穿记录
├── 商家 A 无法删除商家 B 的服装
└── UUID 猜测无法越权访问

试穿模块
├── 提交试穿（成功/配额不足/并发限制/幂等去重）
├── AI 任务成功 → 配额扣减 + SSE 推送
├── AI 任务失败 → 配额不扣 + SSE 推送
└── 超时处理 → 任务标记为 failed

文件上传
├── 正常上传（JPG/PNG/WebP）
├── 文件类型拒绝（GIF/BMP/SVG）
├── 文件大小超限（>10MB）
├── 恶意文件检测（非图片文件伪装）
└── 重复图片检测（相同 file_hash）
```

### E.4 CI/CD 集成

```yaml
# .github/workflows/test.yml（示例）
test:
  steps:
    - run: pytest --cov=apps --cov-report=xml --cov-fail-under=80
    - run: pytest apps/ --tb=short -q
```

---

## 附录 F：监控与告警

### F.1 监控指标

| 指标        | 采集方式                           | 告警阈值                  | 说明    |
|-----------|--------------------------------|-----------------------|-------|
| API 响应时间  | Prometheus + django-prometheus | P99 > 2s              | 接口性能  |
| 错误率       | Prometheus                     | 5xx 比例 > 5%           | 服务健康  |
| AI 任务队列长度 | Celery Exporter                | 待处理 > 50              | 任务积压  |
| AI 任务成功率  | 自定义指标                          | < 90%                 | 引擎质量  |
| MySQL 慢查询 | MySQL Exporter                 | > 100ms               | 数据库性能 |
| MySQL 连接数 | MySQL Exporter                 | > 80% max_connections | 连接池压力 |
| Redis 内存  | Redis Exporter                 | > 80% maxmemory       | 内存压力  |
| 磁盘使用率     | Node Exporter                  | > 85%                 | 存储空间  |

### F.2 日志规范

```python
# 结构化日志格式（JSON）
import structlog

logger = structlog.get_logger()

# 使用示例
logger.info("tryon.task.submitted",
    record_uuid="tryon_xxx",
    merchant_uuid="mcht_xxx",
    ai_engine="aliyun",
    clothing_count=3,
)

logger.error("tryon.task.failed",
    record_uuid="tryon_xxx",
    error="AI_ENGINE_TIMEOUT",
    processing_time=180.5,
)
```

**日志级别规范**:

| 级别        | 使用场景                           |
|-----------|--------------------------------|
| `ERROR`   | AI 引擎失败、数据库异常、第三方服务不可用         |
| `WARNING` | 配额即将用完（>80%）、Token 即将过期、限流触发   |
| `INFO`    | 登录成功、试穿提交、任务完成、配额扣减            |
| `DEBUG`   | SQL 查询详情、Redis 操作、外部 API 请求/响应 |

### F.3 告警通知

| 告警级别       | 通知渠道         | 响应时间   |
|------------|--------------|--------|
| P0 - 服务不可用 | 电话 + 钉钉/企业微信 | 5 分钟内  |
| P1 - 功能异常  | 钉钉/企业微信 + 邮件 | 30 分钟内 |
| P2 - 性能下降  | 邮件           | 2 小时内  |
| P3 - 预警提醒  | 钉钉/企业微信      | 下个工作日  |

### F.4 健康检查增强

```python
# apps/common/views.py 增强版健康检查
def health_check(request):
    """增强版健康检查，包含 Celery 和存储状态"""
    checks = {}
    
    # 数据库
    try:
        connections['default'].ensure_connection()
        checks['database'] = 'ok'
    except Exception as e:
        checks['database'] = f'error: {e}'
    
    # Redis
    try:
        from django.core.cache import cache
        cache.set('_health', '1', 10)
        checks['redis'] = 'ok'
    except Exception as e:
        checks['redis'] = f'error: {e}'
    
    # Celery Worker
    try:
        from celery import current_app
        insp = current_app.control.inspect(timeout=3)
        active = insp.active()
        checks['celery'] = 'ok' if active else 'no_workers'
    except Exception as e:
        checks['celery'] = f'error: {e}'
    
    # 存储服务
    try:
        from apps.media.services import storage_service
        storage_service.health_check()
        checks['storage'] = 'ok'
    except Exception as e:
        checks['storage'] = f'error: {e}'
    
    is_healthy = all(v == 'ok' for v in checks.values())
    status = 200 if is_healthy else 503
    return JsonResponse(
        {'status': 'healthy' if is_healthy else 'degraded', 'checks': checks},
        status=status,
    )
```

---

## 附录 G：前端 React 架构

### G.1 项目结构

```
frontend-react/
├── src/
│   ├── main.jsx              # 入口文件
│   ├── App.jsx               # 主应用组件
│   ├── index.css             # 全局样式（Tailwind）
│   │
│   ├── components/           # UI 组件
│   │   ├── Header.jsx        # 顶部导航栏
│   │   ├── LoginModal.jsx    # 登录弹窗
│   │   ├── GlobalLoading.jsx # 全局加载状态
│   │   ├── Toast.jsx         # 消息提示（z-200）
│   │   ├── UploadModal.jsx   # 上传弹窗
│   │   ├── ClothingGrid.jsx  # 服装网格展示
│   │   └── MainLayout.jsx    # 主布局
│   │
│   ├── config/               # 配置
│   │   └── api.js            # API 端点配置
│   │
│   ├── hooks/                # 自定义 Hooks
│   │   ├── useI18n.jsx       # 国际化 Hook
│   │   ├── useAuth.js        # 认证状态管理
│   │   ├── useClothing.js    # 服装数据管理
│   │   ├── useTryOn.js       # 试穿逻辑
│   │   └── useWardrobe.js    # 衣橱管理
│   │
│   ├── utils/                # 工具函数
│   │   └── request.js        # HTTP 请求封装
│   │
│   └── data/                 # 静态数据
│       └── clothingData.js   # 服装分类数据
│
├── public/                   # 静态资源
├── vite.config.js            # Vite 配置（代理）
├── tailwind.config.js        # Tailwind 配置
└── package.json
```

### G.2 核心组件说明

| 组件 | 功能 | 关键 Props/State |
|------|------|-----------------|
| `App.jsx` | 主应用，管理全局状态 | `isLoggedIn`, `userInfo`, `quota`, `sessionCustomer` |
| `Header.jsx` | 顶部导航，语言切换 | `language`, `onLanguageChange` |
| `LoginModal.jsx` | 登录弹窗，双Tab切换 | `loginTab`, `phone`, `code` |
| `Toast.jsx` | 消息提示，最高层级 | `message`, `type` (z-200) |
| `ClothingGrid.jsx` | 服装分类展示 | `clothing`, `selected`, `onSelect` |

### G.3 状态管理

**全局状态（App.jsx）**:

```javascript
// 认证状态
const [isLoggedIn, setIsLoggedIn] = useState(false)
const [userInfo, setUserInfo] = useState(null)
const [quota, setQuota] = useState({ total: 100, used: 0, remaining: 100 })

// 顾客会话
const [sessionCustomer, setSessionCustomer] = useState(() => {
  // 刷新保持，结束重置
  return localStorage.getItem(CACHE_KEYS.SESSION_CUSTOMER) || generateSessionCustomer()
})

// 试穿状态
const [tryOnHistory, setTryOnHistory] = useState([])
const [selected, setSelected] = useState([])
```

### G.4 顾客会话管理

**生成规则**:
- 格式：`Customer-YYYYMMDD-HHMMSS`（如 `Customer-20260410-131026`）
- 刷新页面：从 `localStorage` 恢复，保持会话
- 点击"结束试穿"：生成新会话ID，清空记录

**展示脱敏**:
- 不显示完整ID
- 不显示"尾号"字样
- 仅显示星号遮蔽后几位（如 `Customer-2026****26`）

### G.5 HTTP 请求封装

```javascript
// utils/request.js
export const api = {
  get: (url, params) => request(url + queryString),
  post: (url, body, options) => request(url, { method: 'POST', body, ...options }),
  put: (url, body, options) => request(url, { method: 'PUT', body, ...options }),
  delete: (url, options) => request(url, { method: 'DELETE', ...options }),
}

// Token 管理
export const TokenManager = {
  setTokens: (access, refresh) => { /* localStorage */ },
  getAccessToken: () => localStorage.getItem('tryon_access_token'),
  clearTokens: () => { /* 清除所有认证相关 */ },
}

// 请求 ID（用于追踪）
function generateRequestId() {
  // 使用 sessionCustomer 作为前缀
  return sessionCustomer.replace(/_/g, '-')
}
```

### G.6 错误处理

**后端错误格式解析**:

```javascript
// Django ErrorDetail 格式
// "ErrorDetail(string='验证码错误或已过期', code='invalid')"
function parseErrorDetail(str) {
  const match = str.match(/string='([^']+)'/)
  return match ? match[1] : str
}

// 提取优先级
// error > detail > message > non_field_errors > 字段错误
```

---

## 附录 H：数据加密

### H.1 加密方案

采用 **XOR + Base64** 方案（生产环境可升级为 AES）：

**后端（Python）**:

```python
# apps/common/utils/crypto.py
class CryptoUtils:
    KEY = settings.ENCRYPTION_KEY  # 从环境变量读取
    
    @classmethod
    def encrypt(cls, data: dict) -> str:
        json_str = json.dumps(data)
        encrypted = ''.join(
            chr(ord(c) ^ ord(cls.KEY[i % len(cls.KEY)]))
            for i, c in enumerate(json_str)
        )
        return base64.b64encode(encrypted.encode()).decode()
    
    @classmethod
    def decrypt(cls, encrypted: str) -> dict:
        decoded = base64.b64decode(encrypted).decode()
        decrypted = ''.join(
            chr(ord(c) ^ ord(cls.KEY[i % len(cls.KEY)]))
            for i, c in enumerate(decoded)
        )
        return json.loads(decrypted)
```

**前端（JavaScript）**:

```javascript
// utils/request.js
const ENCRYPTION_KEY = 'TryOn@2024!Secret'

export function encryptData(data) {
  const jsonStr = JSON.stringify(data)
  let encrypted = ''
  for (let i = 0; i < jsonStr.length; i++) {
    encrypted += String.fromCharCode(
      jsonStr.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length)
    )
  }
  return btoa(encrypted)
}
```

### H.2 开关配置

| 环境 | 配置项 | 默认值 |
|------|--------|--------|
| 后端 | `DATA_ENCRYPTION_ENABLED` | `false` |
| 前端 | `setEncryptionEnabled(true)` | `false` |

**请求格式**:

```javascript
// 开启加密后
POST /api/v1/tryon/generate/
{
  "encrypted": "eW91cl9lbmNyeXB0ZWRfZGF0YQ=="
}
```

---

## 附录 I：配额管理

### I.1 配额数据来源

配额数据从后端 `/api/v1/auth/me/` 接口获取：

```json
{
  "merchant": {
    "uuid": "mcht_xxx",
    "username": "store001",
    "store_name": "时尚服饰店",
    "quota_total": 100,
    "quota_used": 35,
    "quota_remaining": 65
  }
}
```

### I.2 前端展示

**门店信息弹窗**:

- 已登录：显示门店名称、配额进度条、使用统计
- 未登录：显示"未登录"状态，隐藏配额信息，提供登录按钮

**配额进度条**:

```jsx
<div className="h-2.5 bg-grayLight rounded-full overflow-hidden">
  <div 
    className="h-full bg-gradient-to-r from-champagne to-champagne/80"
    style={{ width: `${(quota.used / quota.total) * 100}%` }}
  />
</div>
<div className="flex justify-between mt-2">
  <span>已使用 {quota.used} 次</span>
  <span>剩余 {quota.remaining} 次</span>
</div>
```

### I.3 扣减逻辑

1. **前端预检查**：提交前检查 `quota.remaining > 0`
2. **后端验证**：`TryOnGenerateView` 中验证并原子扣减
3. **失败回滚**：AI任务失败时返还配额

---

## 附录 J：国际化

### J.1 支持语言

| 语言 | 代码 | 默认 |
|------|------|-------|
| 简体中文 | `zh-CN` | ✅ |
| 繁体中文 | `zh-TW` | |
| English | `en` | |

### J.2 实现方式

**自定义 Hook（useI18n）**:

```javascript
const TRANSLATIONS = {
  'zh-CN': {
    loginTitle: '商家登录',
    loginTabPassword: '账号密码',
    loginTabSms: '手机验证码',
    tryOnButton: '开始试穿',
    endTryOn: '结束试穿',
    // ...
  },
  'zh-TW': { /* 繁体中文 */ },
  'en': { /* English */ },
}

export function useI18n() {
  const [language, setLanguage] = useState(() => 
    localStorage.getItem('language') || 'zh-CN'
  )
  
  const t = useCallback((key) => TRANSLATIONS[language][key] || key, [language])
  
  return { t, language, setLanguage }
}
```

### J.3 服装分类翻译

**一级分类（前端翻译）**:

| 英文键 | 中文 | 英文 |
|--------|------|------|
| tops | 上装 | Tops |
| bottoms | 下装 | Bottoms |
| dresses | 连衣裙 | Dresses |
| outerwear | 外套 | Outerwear |
| shoes | 鞋子 | Shoes |
| accessories | 配饰 | Accessories |

**二级分类（后端返回）**:
- 二级分类名称由后端数据提供，支持 `name_i18n` 字段

---

## 附录 K：移动端适配

### K.1 响应式断点

```javascript
// Tailwind 配置
screens: {
  'sm': '640px',   // 手机横屏
  'md': '768px',   // 平板
  'lg': '1024px',  // 桌面
  'xl': '1280px',  // 大屏
}
```

### K.2 关键适配点

| 功能 | 移动端 | 桌面端 |
|------|--------|--------|
| 布局 | 单列滚动 | 双栏布局 |
| 弹窗 | 全屏弹窗 | 居中弹窗 |
| 按钮 | 固定底部 | 内联按钮 |
| 试穿锚点 | 自动滚动到结果区 | 无需滚动 |

### K.3 试穿后锚点

```javascript
// 移动端试穿完成后滚动到结果展示区
if (isMobile && hasResult) {
  resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
```
