# 数据库模型设计文档

> **版本**: v3.0  
> **更新日期**: 2026-04-22  
> **技术栈**: Django 5.x + MySQL 8.0+

---

## 目录

1. [模型关系图](#1-模型关系图)
2. [公共模型](#2-公共模型)
3. [商家模块模型](#3-商家模块模型)
4. [衣橱模块模型](#4-衣橱模块模型)
5. [试穿模块模型](#5-试穿模块模型)
6. [字段说明与规范](#6-字段说明与规范)
7. [索引设计](#7-索引设计)
8. [数据流转](#8-数据流转)

---

## 1. 模型关系图

### 1.1 ER 关系图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              核心业务模型关系                                 │
└─────────────────────────────────────────────────────────────────────────────┘

                            ┌──────────────────┐
                            │    merchant      │ (商家表 - accounts 模块)
                            ├──────────────────┤
                            │ id (PK)          │
                            │ uuid             │ ← 前缀: mcht_
                            │ username         │
                            │ phone            │
                            │ store_name       │
                            │ quota_total      │
                            │ quota_used       │
                            │ status           │
                            └────────┬─────────┘
                                     │
                   ┌─────────────────┼─────────────────┐
                   │ 1:N             │ 1:N             │ 1:N
                   ▼                 ▼                 ▼
    ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
    │    clothing      │  │  tryon_record    │  │     sms_log      │
    ├──────────────────┤  ├──────────────────┤  ├──────────────────┤
    │ id (PK)          │  │ id (PK)          │  │ id (PK)          │
    │ uuid             │  │ uuid             │  │ merchant_id (FK) │
    │ merchant_id (FK) │  │ merchant_id (FK) │  │ phone            │
    │ category         │  │ session_id       │  │ code             │
    │ subcategory      │  │ avatar_url       │  │ purpose          │
    │ name             │  │ result_url       │  │ is_used          │
    │ image_url        │  │ status           │  │ expired_at       │
    │ color            │  │ ai_engine        │  └──────────────────┘
    │ source           │  │ task_id          │
    └──────────────────┘  │ is_saved         │
                          └────────┬─────────┘
                                   │
                                   │ 1:N
                                   ▼
                          ┌──────────────────┐
                          │  tryon_clothing  │ (试穿-服装关联表)
                          ├──────────────────┤
                          │ id (PK)          │
                          │ record_id (FK)   │
                          │ clothing_id      │
                          │ is_custom        │
                          │ category         │
                          │ clothing_image   │
                          └──────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                              公共服务模型                                     │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐       ┌──────────────────┐
│ file_upload_record│       │  preset_clothing │ (预设服装模板)
├──────────────────┤       ├──────────────────┤
│ id (PK)          │       │ id (PK)          │
│ md5_hash         │       │ category         │
│ storage_type     │       │ subcategory      │
│ storage_key      │       │ name_i18n (JSON) │
│ access_url       │       │ color            │
│ tenant_id        │       │ image_url        │
│ folder           │       │ sort_order       │
│ file_category    │       │ is_active        │
│ ref_type         │       └──────────────────┘
│ ref_id           │
└──────────────────┘
```

### 1.2 模块依赖关系

```
apps/
├── common/models.py                    # 公共基础模型
│   ├── TimeStampedModel (抽象基类)      # 提供 created_at, updated_at
│   ├── UUIDModel (抽象基类)             # 提供 uuid 主键
│   └── FileUploadRecord                # 文件上传记录（MD5去重）
│
├── accounts/models.py                  # 商家认证模块
│   ├── Merchant                        # 商家表（核心用户模型）
│   └── SmsLog                          # 短信验证码日志
│
├── wardrobe/models.py                  # 衣橱管理模块
│   ├── Clothing                        # 服装表（商家私有）
│   └── PresetClothing                  # 预设服装模板（全局共享）
│
└── tryon/models.py                     # 试穿核心模块
    ├── TryOnRecord                     # 试穿记录
    └── TryOnClothing                   # 试穿-服装关联（多对多）
```

### 1.3 关系说明

| 关系 | 类型 | 说明 |
|------|------|------|
| Merchant → Clothing | 1:N | 一个商家拥有多件服装 |
| Merchant → TryOnRecord | 1:N | 一个商家有多条试穿记录 |
| Merchant → SmsLog | 1:N | 一个商家有多条短信记录 |
| TryOnRecord → TryOnClothing | 1:N | 一条试穿记录关联多件服装 |
| PresetClothing | 独立 | 全局预设模板，不关联商家 |
| FileUploadRecord | 独立 | 文件去重记录，通过 tenant_id 关联 |

---

## 2. 公共模型

### 2.1 TimeStampedModel (抽象基类)

带时间戳的基础模型，所有业务模型可继承此类获得时间戳字段。

```python
class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        abstract = True
```

### 2.2 UUIDModel (抽象基类)

UUID 主键模型，提供全局唯一标识符。

```python
class UUIDModel(models.Model):
    uuid = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True
```

### 2.3 FileUploadRecord (文件上传记录)

统一文件上传记录表，核心功能：
- **MD5 去重**：避免重复上传相同内容的文件
- **存储类型记录**：区分本地存储和 OSS 存储
- **租户隔离**：不同商户的文件分开管理
- **统计监控**：记录命中次数、访问时间等

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BigAutoField | 主键 |
| `md5_hash` | CharField(32) | 文件 MD5，用于去重 |
| `storage_type` | CharField(10) | 存储类型: `local` / `oss` |
| `storage_key` | CharField(500) | 存储路径 |
| `access_url` | CharField(1000) | 访问 URL |
| `tenant_id` | CharField(50) | 租户 ID（商户 UUID） |
| `folder` | CharField(100) | 存储文件夹 |
| `file_category` | CharField(20) | 文件用途 |
| `file_size` | PositiveIntegerField | 文件大小(字节) |
| `content_type` | CharField(100) | 文件 MIME 类型 |
| `file_ext` | CharField(10) | 文件扩展名 |
| `width` | PositiveIntegerField | 图片宽度 |
| `height` | PositiveIntegerField | 图片高度 |
| `hit_count` | PositiveIntegerField | 命中次数(去重统计) |
| `last_accessed_at` | DateTimeField | 最后访问时间 |
| `ref_type` | CharField(30) | 关联类型 |
| `ref_id` | CharField(50) | 关联 ID |
| `source` | CharField(30) | 上传来源 |
| `client_ip` | CharField(45) | 客户端 IP |
| `created_at` | DateTimeField | 创建时间 |
| `updated_at` | DateTimeField | 更新时间 |

**唯一约束**: `(tenant_id, md5_hash, storage_type)`

**存储类型枚举**:
```python
class StorageType(models.TextChoices):
    LOCAL = 'local', '本地存储'
    OSS = 'oss', '阿里云 OSS'
```

**文件用途枚举**:
```python
class FileCategory(models.TextChoices):
    AVATAR = 'avatar', '人物照片'
    CLOTHING = 'clothing', '服装图片'
    RESULT = 'result', '试穿结果'
    OTHER = 'other', '其他'
```

**核心方法**:
```python
# 根据 MD5 和租户获取记录（自动更新命中计数）
record = FileUploadRecord.get_by_md5(md5, tenant_id, storage_type)

# 创建上传记录
record = FileUploadRecord.create_record(md5, storage_type, storage_key, ...)

# 清理旧记录
FileUploadRecord.cleanup_old_records(days=30, tenant_id=tenant_id)

# 获取租户统计
stats = FileUploadRecord.get_stats_by_tenant(tenant_id)
```

---

## 3. 商家模块模型

### 3.1 Merchant (商家表)

商家是系统的核心用户模型，继承 Django 的 `AbstractBaseUser` 和 `PermissionsMixin`，支持 Django 认证系统。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BigAutoField | 主键 |
| `uuid` | CharField(42) | 对外唯一标识 (前缀 `mcht_`) |
| `username` | CharField(50) | 登录用户名（唯一） |
| `phone` | CharField(20) | 手机号（用于短信发送） |
| `phone_encrypted` | CharField(255) | 手机号加密（用于查询展示） |
| `store_name` | CharField(100) | 门店名称 |
| `store_address` | CharField(255) | 门店地址 |
| `avatar_url` | URLField(500) | 商家头像 URL |
| `quota_total` | PositiveIntegerField | 总配额（试穿次数） |
| `quota_used` | PositiveIntegerField | 已用配额 |
| `quota_reset_at` | DateField | 配额重置日期 |
| `status` | PositiveSmallIntegerField | 状态: 0=禁用 1=正常 2=过期 |
| `last_login_at` | DateTimeField | 最后登录时间 |
| `last_login_ip` | CharField(45) | 最后登录 IP |
| `is_active` | BooleanField | 是否激活 |
| `is_staff` | BooleanField | 是否员工（Admin 访问） |
| `is_deleted` | BooleanField | 软删除标记 |
| `deleted_at` | DateTimeField | 删除时间 |
| `created_at` | DateTimeField | 创建时间 |
| `updated_at` | DateTimeField | 更新时间 |

**状态枚举**:
```python
class Status(models.IntegerChoices):
    DISABLED = 0, '禁用'
    NORMAL = 1, '正常'
    EXPIRED = 2, '过期'
```

**配额管理方法**:
```python
@property
def quota_remaining(self):
    """剩余配额"""
    return max(0, self.quota_total - self.quota_used)

def deduct_quota(self, count: int = 1):
    """扣减配额"""
    self.quota_used = min(self.quota_total, self.quota_used + count)

def reset_quota(self):
    """重置配额（每月重置）"""
    self.quota_used = 0
    self.quota_reset_at = date.today() + relativedelta(months=1)
```

### 3.2 SmsLog (短信验证码日志)

记录短信验证码发送和验证情况。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BigAutoField | 主键 |
| `merchant` | ForeignKey(Merchant) | 关联商家（可为空） |
| `phone` | CharField(20) | 手机号 |
| `code` | CharField(6) | 验证码 |
| `purpose` | CharField(20) | 用途: `login` / `bind_phone` |
| `is_used` | BooleanField | 是否已使用 |
| `ip_address` | CharField(45) | 请求 IP |
| `created_at` | DateTimeField | 创建时间 |
| `expired_at` | DateTimeField | 过期时间 |

**用途枚举**:
```python
class Purpose(models.TextChoices):
    LOGIN = 'login', '登录'
    BIND_PHONE = 'bind_phone', '绑定手机'
```

---

## 4. 衣橱模块模型

### 4.1 Clothing (服装表)

商家私有服装库，支持分类管理、排序、软删除。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BigAutoField | 主键 |
| `uuid` | CharField(42) | 对外唯一标识 (前缀 `cloth_`) |
| `merchant_id` | BigIntegerField | 所属商家 ID |
| `category` | CharField(30) | 大类 |
| `subcategory` | CharField(30) | 子类 |
| `name` | CharField(100) | 服装名称 |
| `color` | CharField(30) | 主色调 HEX |
| `image_url` | URLField(500) | 服装图片 URL |
| `image_thumb_url` | URLField(500) | 缩略图 URL |
| `sort_order` | IntegerField | 排序权重（越大越靠前） |
| `is_active` | BooleanField | 是否上架 |
| `source` | CharField(20) | 来源: `preset` / `custom` / `wardrobe` |
| `file_hash` | CharField(64) | 文件 SHA256 哈希（去重） |
| `is_deleted` | BooleanField | 软删除标记 |
| `deleted_at` | DateTimeField | 删除时间 |
| `created_at` | DateTimeField | 创建时间 |
| `updated_at` | DateTimeField | 更新时间 |

**分类枚举**:
```python
class Category(models.TextChoices):
    TOPS = 'tops', '上装'
    BOTTOMS = 'bottoms', '下装'
    DRESSES = 'dresses', '连衣裙'
    OUTERWEAR = 'outerwear', '外套'
    SHOES = 'shoes', '鞋'
    ACCESSORIES = 'accessories', '配饰'
```

**来源枚举**:
```python
class Source(models.TextChoices):
    PRESET = 'preset', '预设'        # 从预设模板导入
    CUSTOM = 'custom', '自定义'      # 自定义添加
    WARDROBE = 'wardrobe', '衣橱上传' # 用户上传
```

### 4.2 PresetClothing (预设服装模板)

全局预设服装模板，供所有商家选择导入。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BigAutoField | 主键 |
| `category` | CharField(30) | 大类 |
| `subcategory` | CharField(30) | 子类 |
| `name_i18n` | JSONField | 多语言名称 |
| `color` | CharField(30) | 主色调 HEX |
| `image_url` | URLField(500) | 服装图片 URL |
| `sort_order` | IntegerField | 排序权重 |
| `is_active` | BooleanField | 是否启用 |
| `created_at` | DateTimeField | 创建时间 |
| `updated_at` | DateTimeField | 更新时间 |

**多语言名称格式**:
```python
name_i18n = {
    "zh-CN": "T恤",
    "zh-TW": "T恤",
    "en": "T-Shirts"
}
```

**获取指定语言名称**:
```python
def get_name(self, lang: str = 'zh-CN') -> str:
    return self.name_i18n.get(lang, self.name_i18n.get('zh-CN', self.subcategory))
```

---

## 5. 试穿模块模型

### 5.1 TryOnRecord (试穿记录)

试穿任务主记录表，记录每次试穿的完整信息。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BigAutoField | 主键 |
| `uuid` | CharField(42) | 对外唯一标识 (前缀 `tryon_`) |
| `merchant_id` | BigIntegerField | 商户 ID |
| `session_id` | CharField(100) | 会话 ID（浏览器生成） |
| `avatar_url` | URLField(500) | 人物照片 URL |
| `result_url` | URLField(500) | AI 生成结果图 URL |
| `result_thumb_url` | URLField(500) | 结果缩略图 URL |
| `status` | CharField(20) | 状态 |
| `ai_engine` | CharField(20) | AI 引擎 |
| `task_id` | CharField(100) | AI 任务 ID |
| `error_message` | TextField | 错误信息 |
| `processing_time` | DecimalField(8,2) | 处理耗时(秒) |
| `quota_deducted` | BooleanField | 是否已扣配额 |
| `is_saved` | BooleanField | 是否收藏 |
| `ip_address` | CharField(45) | 客户端 IP |
| `device_info` | CharField(200) | 设备信息 |
| `user_agent` | CharField(500) | 浏览器 UA |
| `is_deleted` | BooleanField | 软删除标记 |
| `deleted_at` | DateTimeField | 删除时间 |
| `created_at` | DateTimeField | 创建时间 |
| `updated_at` | DateTimeField | 更新时间 |

**状态枚举**:
```python
class Status(models.TextChoices):
    PENDING = 'pending', '等待中'
    PROCESSING = 'processing', '处理中'
    COMPLETED = 'completed', '已完成'
    FAILED = 'failed', '失败'
```

**AI 引擎枚举**:
```python
class AIEngine(models.TextChoices):
    ALIYUN = 'aliyun', '阿里云'
    TENCENT = 'tencent', '腾讯云'
    SEEDDANCE = 'seeddance', 'SeedDance'
```

### 5.2 TryOnClothing (试穿-服装关联)

试穿记录与服装的关联表，支持多件服装搭配试穿。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BigAutoField | 主键 |
| `record_id` | BigIntegerField | 试穿记录 ID |
| `clothing_id` | CharField(100) | 服装 ID（支持 UUID 和自定义 ID） |
| `is_custom` | BooleanField | 是否自定义服装 |
| `category` | CharField(30) | 服装大类（冗余） |
| `subcategory` | CharField(30) | 服装子类（冗余） |
| `clothing_name` | CharField(100) | 服装名称（冗余） |
| `clothing_color` | CharField(30) | 服装颜色（冗余） |
| `clothing_image` | URLField(500) | 服装图片 URL（冗余） |
| `created_at` | DateTimeField | 创建时间 |

> **设计说明**: 冗余字段用于在服装被删除后仍能查看试穿记录中的服装信息。

---

## 6. 字段说明与规范

### 6.1 UUID 命名规范

所有业务表的 `uuid` 字段采用 **`{前缀}{UUID v4}`** 格式：

| 业务表 | 前缀 | 格式 | 示例 |
|--------|------|------|------|
| merchant | `mcht_` | `mcht_{uuid4}` | `mcht_f47ac10b-58cc-4372-a567-0e02b2c3d479` |
| clothing | `cloth_` | `cloth_{uuid4}` | `cloth_6ba7b810-9dad-11d1-80b4-00c04fd430c8` |
| tryon_record | `tryon_` | `tryon_{uuid4}` | `tryon_550e8400-e29b-41d4-a716-446655440000` |

**应用场景**:
- **日志追踪**: `[2026-04-22 12:00:00] tryon_550e8400... processing started`
- **Redis Key**: `tryon:task:task_7c9e6679...`
- **存储路径**: `results/mcht_f47ac10b.../tryon_550e8400....png`
- **API 响应**: `{"uuid": "tryon_550e8400..."}`

### 6.2 存储路径规范

文件存储路径格式：`{folder}/{tenant_id}/{filename}`

| 文件类型 | folder | 示例 |
|----------|--------|------|
| 人物照片 | `avatars` | `avatars/mcht_xxx/session_1775737047992.jpg` |
| 服装图片 | `clothes` | `clothes/b8bbd502c268d72802a75696255b3eda.webp` |
| 试穿结果 | `tryon_results` | `tryon_results/mcht_xxx/tryon_xxx.png` |

### 6.3 软删除规范

所有业务表支持软删除，包含以下字段：
- `is_deleted`: BooleanField，删除标记
- `deleted_at`: DateTimeField，删除时间

查询时需过滤 `is_deleted=False`。

---

## 7. 索引设计

### 7.1 FileUploadRecord 索引

| 索引名 | 字段 | 用途 |
|--------|------|------|
| `uq_tenant_md5_storage` | `(tenant_id, md5_hash, storage_type)` | 唯一约束 |
| `idx_tenant_md5` | `(tenant_id, md5_hash)` | 去重查询 |
| `idx_tenant_folder` | `(tenant_id, folder)` | 租户隔离查询 |
| `idx_tenant_category` | `(tenant_id, file_category)` | 按用途查询 |
| `idx_storage_folder` | `(storage_type, folder)` | 存储类型统计 |
| `idx_last_access` | `(-last_accessed_at)` | 清理旧记录 |
| `idx_ref` | `(ref_type, ref_id)` | 业务关联查询 |

### 7.2 Merchant 索引

| 索引名 | 字段 | 用途 |
|--------|------|------|
| `uk_uuid` | `(uuid)` | UUID 唯一查询 |
| `uk_username` | `(username)` | 用户名登录 |
| `idx_phone` | `(phone)` | 手机号查询 |

### 7.3 Clothing 索引

| 索引名 | 字段 | 用途 |
|--------|------|------|
| `uk_uuid` | `(uuid)` | UUID 唯一查询 |
| - | `(merchant_id, category, is_active)` | 按分类查询 |
| - | `(merchant_id, category, subcategory, is_active)` | 按子类查询 |
| - | `(merchant_id, sort_order)` | 排序查询 |

### 7.4 TryOnRecord 索引

| 索引名 | 字段 | 用途 |
|--------|------|------|
| `uk_uuid` | `(uuid)` | UUID 唯一查询 |
| - | `(merchant_id, session_id, created_at)` | 会话记录查询 |
| - | `(merchant_id, status)` | 按状态查询 |
| - | `(merchant_id, is_saved, created_at)` | 收藏列表查询 |
| - | `(task_id)` | AI任务查询 |
| - | `(session_id, created_at)` | 会话时间线查询 |

### 7.5 SmsLog 索引

| 索引名 | 字段 | 用途 |
|--------|------|------|
| - | `(phone, code, is_used)` | 验证码校验 |
| - | `(expired_at)` | 过期清理 |

---

## 8. 数据流转

### 8.1 试穿流程数据流

```
1. 用户上传图片
   └─> FileUploadRecord 记录 (MD5 去重)
       └─> 返回 access_url

2. 调用 AI 引擎
   └─> SeedDanceEngine.submit_task()
       └─> 返回 result_url (临时签名 URL)

3. 下载结果图片
   └─> StorageService.upload_file()
       └─> FileUploadRecord 记录
           └─> 返回永久 URL

4. 保存试穿记录
   └─> TryOnRecord 创建
       └─> TryOnClothing 创建 (N 条)
           └─> 返回 record_id, record_uuid
```

### 8.2 返回结果结构

```python
{
    'task_id': 'seed_xxx_xxx',           # AI 任务 ID
    'success': True,                     # 是否成功
    'result_url': 'https://...',         # 结果图片 URL (永久)
    'original_url': 'https://...',       # AI 返回的原始 URL (临时)
    'avatar_url': 'https://...',         # 人物照片 URL
    'clothes_urls': ['https://...'],     # 服装图片 URL 列表
    'engine': 'seeddance',               # AI 引擎名称
    'trace_id': 'trace_xxx',             # 追踪 ID
    'record_id': 123,                    # 数据库记录 ID
    'record_uuid': 'tryon_xxx',          # 数据库记录 UUID
    'processing_time': 5.23,             # 处理耗时(秒)
    'duplicate_stats': {                 # 去重统计
        'avatar': False,
        'clothes': [False, False]
    }
}
```

### 8.3 配额扣减流程

```
1. 试穿请求进入
   └─> 检查 merchant.quota_remaining > 0
       └─> 创建 TryOnRecord (quota_deducted=False)

2. AI 处理成功
   └─> merchant.deduct_quota()
       └─> TryOnRecord.quota_deducted = True

3. AI 处理失败
   └─> 不扣减配额
   └─> TryOnRecord.status = 'failed'
```

---

## 附录：模型快速参考

### A. 模型清单

| 模块 | 模型 | 表名 | 说明 |
|------|------|------|------|
| common | TimeStampedModel | - | 抽象基类 |
| common | UUIDModel | - | 抽象基类 |
| common | FileUploadRecord | common_file_upload_record | 文件上传记录 |
| accounts | Merchant | merchant | 商家表 |
| accounts | SmsLog | sms_log | 短信验证码日志 |
| wardrobe | Clothing | clothing | 服装表 |
| wardrobe | PresetClothing | preset_clothing | 预设服装模板 |
| tryon | TryOnRecord | tryon_record | 试穿记录 |
| tryon | TryOnClothing | tryon_clothing | 试穿-服装关联 |

### B. 外键关系（逻辑关联）

> **注意**: 本项目不使用数据库外键约束，所有关联通过应用层（Django ORM）维护。

| 模型 | 字段 | 关联模型 | 关系类型 |
|------|------|----------|----------|
| Clothing | merchant_id | Merchant | N:1 |
| TryOnRecord | merchant_id | Merchant | N:1 |
| TryOnClothing | record_id | TryOnRecord | N:1 |
| SmsLog | merchant | Merchant | N:1 |
| FileUploadRecord | tenant_id | Merchant | N:1 (逻辑) |
