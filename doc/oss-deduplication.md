# OSS 文件管理与试穿流程

## 目录

1. [试穿流程概览](#试穿流程概览)
2. [OSS 文件去重机制](#oss-文件去重机制)
3. [签名 URL 机制](#签名-url-机制)
4. [相关文件](#相关文件)

---

## 试穿流程概览

### 完整流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端请求                                  │
├─────────────────────────────────────────────────────────────────┤
│ clothing_uuids: [已有服装 UUID]                                  │
│ custom_clothes: [{image: "base64...", name: "..."}]             │
│ avatar: 二进制文件                                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     后端 TryOnService                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 已有服装处理                                                 │
│     ├── 数据库查询 UUID → 获取 OSS URL                           │
│     └── URL 已在 OSS,无需重复上传                                │
│                                                                 │
│  2. 自定义服装处理                                               │
│     ├── Base64 → 解码为二进制                                    │
│     ├── 计算 MD5 → 查询缓存是否已存在                             │
│     ├── 命中缓存 → 直接返回已有 URL (跳过上传)                     │
│     └── 未命中 → 上传到 OSS → 保存 MD5 映射                       │
│                                                                 │
│  3. 头像处理                                                     │
│     ├── 计算 MD5 → 查询缓存                                      │
│     └── 同上: 命中/未命中处理                                     │
│                                                                 │
│  4. 生成签名 URL                                                 │
│     ├── 所有 OSS URL → 转换为带过期时间的签名 URL                  │
│     └── 签名有效期: 1 小时                                        │
│                                                                 │
│  5. 调用 AI 引擎                                                 │
│     └── 签名 URL → 大模型处理                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        返回结果                                  │
├─────────────────────────────────────────────────────────────────┤
│ task_id: 任务 ID (用于轮询状态)                                   │
│ avatar_url: 头像 OSS URL                                         │
│ clothes_urls: 服装 OSS URL 列表                                  │
│ duplicate_stats: 去重统计                                        │
└─────────────────────────────────────────────────────────────────┘
```

### 数据流向

| 来源 | 数据格式 | 处理方式 | 最终 URL |
|------|----------|----------|----------|
| 衣橱已有服装 | UUID | 数据库查询 | OSS 公网 URL → 签名 URL |
| 自定义上传 | Base64 | 上传 OSS (去重) | OSS 公网 URL → 签名 URL |
| 头像照片 | 二进制文件 | 上传 OSS (去重) | OSS 公网 URL → 签名 URL |

---

## OSS 文件去重机制

用户在试衣过程中可能多次上传相同的图片(如相同的头像、相同的服装),每次都上传到 OSS 会浪费:
- 存储空间
- 上传流量
- 上传时间

## 解决方案

### MD5 去重机制

基于文件内容的 MD5 哈希值进行去重:

1. **上传前检查**: 计算文件 MD5,查询数据库是否已存在
2. **命中缓存**: 直接返回已有的 OSS URL,跳过上传
3. **未命中**: 上传到 OSS,并保存 MD5 映射到数据库

### 数据库持久化

创建了 `OSSFileCache` 模型存储去重信息:

```python
class OSSFileCache(TimeStampedModel):
    md5 = models.CharField(max_length=32, unique=True)  # 文件哈希
    oss_key = models.CharField(max_length=500)           # OSS 路径
    public_url = models.URLField(max_length=1000)        # 公网 URL
    file_size = models.PositiveIntegerField()            # 文件大小
    content_type = models.CharField(max_length=100)      # 文件类型
    upload_count = models.PositiveIntegerField(default=1) # 上传次数
    last_accessed_at = models.DateTimeField(auto_now=True) # 最后访问
```

**优势**:
- ✅ 服务重启后仍然有效
- ✅ 支持多进程、多服务共享
- ✅ 统计去重效果和节省流量
- ✅ 支持清理策略

## 使用示例

### 自动去重

调用 OSS 服务上传时,默认启用去重:

```python
from apps.common.services.oss_service import oss_service

# 上传文件
oss_key, url, is_duplicate = oss_service.upload_file(
    file=image_file,
    filename='avatar.jpg',
    folder='avatars',
    user_id='user123',
    skip_duplicate=True  # 默认 True,启用去重
)

# is_duplicate=True 表示文件已存在,跳过了上传
# is_duplicate=False 表示新上传的文件
```

### 去重效果统计

```python
# 获取缓存统计
stats = oss_service.get_cache_stats()
print(f"缓存文件数: {stats['cache_size']}")
print(f"总文件大小: {stats['total_size_bytes']}")
print(f"总上传请求: {stats['total_uploads']}")
```

## 数据清理

### 手动清理

使用 Django 管理命令清理旧缓存:

```bash
# 预览将要删除的记录
python manage.py cleanup_oss_cache --days=30 --dry-run

# 清理 30 天前未访问的缓存
python manage.py cleanup_oss_cache --days=30
```

### 定时任务清理

配置 Celery 定时任务自动清理:

```python
# config/celery.py
from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    'cleanup-oss-cache': {
        'task': 'apps.common.tasks.cleanup_oss_cache',
        'schedule': crontab(hour=2, minute=0, day_of_week=0),  # 每周日凌晨 2 点
    },
}
```

创建清理任务:

```python
# apps/common/tasks.py
from celery import shared_task
from django.utils import timezone
from datetime import timedelta
from apps.common.models import OSSFileCache

@shared_task
def cleanup_oss_cache():
    """清理 30 天未访问的 OSS 缓存记录"""
    days = 30
    cutoff_date = timezone.now() - timedelta(days=days)
    deleted_count, _ = OSSFileCache.objects.filter(
        last_accessed_at__lt=cutoff_date
    ).delete()
    
    logger.info(f"[Celery] 清理 OSS 缓存: 删除 {deleted_count} 条记录")
    return deleted_count
```

## 性能优化

### 索引优化

为 `OSSFileCache` 模型创建了索引:

```python
indexes = [
    models.Index(fields=['md5']),              # 快速查询
    models.Index(fields=['-last_accessed_at']) # 清理旧记录
]
```

### 批量操作

OSS 服务支持批量上传和删除:

```python
# 批量上传
results = []
for file in files:
    oss_key, url, is_dup = oss_service.upload_file(file, ...)
    results.append((oss_key, url, is_dup))

# 批量删除
oss_service.delete_files([key1, key2, key3])
```

## 监控指标

建议监控以下指标:

1. **去重率**: `upload_count / cache_size` (平均每个文件被请求多少次)
2. **节省存储**: 统计 `file_size * (upload_count - 1)` 
3. **缓存命中率**: 命中次数 / 总请求次数
4. **缓存大小**: 数据库表大小

可以通过 Django Admin 查看 `OSSFileCache` 模型的统计信息。

## 注意事项

### 数据库异常降级

如果数据库出现异常,OSS 服务会自动降级:

```python
try:
    # 尝试查询缓存
    cached = OSSFileCache.get_by_md5(md5)
except Exception:
    # 降级:跳过去重,直接上传
    logger.warning("[OSS] 查询缓存失败,跳过去重")
```

### OSS 文件清理

此方案仅清理数据库缓存记录,**不会删除 OSS 上的实际文件**。

如需清理 OSS 文件,请配置阿里云 OSS 生命周期规则:

1. 登录阿里云 OSS 控制台
2. 选择 Bucket → 基础设置 → 生命周期
3. 配置规则:
   - 规则名称: `cleanup-old-files`
   - 应用范围: 指定前缀 (如 `avatars/`, `clothing/`)
   - 策略: 最后修改时间超过 90 天
   - 操作: 删除文件

## 成本分析

### 去重效果

假设:
- 每天上传 1000 张图片
- 平均图片大小 500KB
- 去重率 30% (相同图片重复上传)

**节省成本**:
- 存储空间: 1000 * 500KB * 30% = 150MB/天
- 流量: 150MB/天
- OSS 请求次数: 300 次/天

**数据库成本**:
- 每条记录约 200 字节
- 1000 条/天 = 200KB/天
- 可接受范围

### 收益

- ✅ 节省 OSS 存储费用
- ✅ 节省上传流量费用
- ✅ 提升用户体验 (上传更快)
- ✅ 减少重复文件管理成本

---

## 签名 URL 机制

### 为什么需要签名 URL

AI 引擎调用需要访问 OSS 上的图片文件。如果使用公开 URL:

- ❌ 安全风险: URL 可能被泄露或滥用
- ❌ 无法控制访问时效
- ❌ 难以追踪访问来源

使用签名 URL:

- ✅ 临时访问,过期自动失效
- ✅ 可控制访问时效 (默认 1 小时)
- ✅ 安全性更高

### 使用方式

```python
from apps.common.services.oss_service import oss_service

# 从公网 URL 生成签名 URL
public_url = "https://bucket.oss-cn-shenzhen.aliyuncs.com/avatars/user123/avatar.jpg"
signed_url = oss_service.get_signed_url_from_url(public_url, expires=3600)

# 结果示例:
# https://bucket.oss-cn-shenzhen.aliyuncs.com/avatars/user123/avatar.jpg?OSSAccessKeyId=xxx&Signature=xxx&Expires=xxx
```

### 自动处理逻辑

`get_signed_url_from_url()` 方法会自动判断:

1. **已经是签名 URL** → 直接返回 (避免重复签名)
2. **是 OSS URL** → 提取 oss_key → 生成签名 URL
3. **非 OSS URL** (如第三方图片) → 直接返回原 URL

### 在 TryOnService 中的应用

```python
# 调用 AI 引擎前,所有 URL 转换为签名 URL
signed_avatar_url = self._get_signed_url(avatar_url)
signed_clothes_urls = [self._get_signed_url(url) for url in clothes_urls]

# 传给 AI 引擎
result = self.engine.submit_task(
    avatar_url=signed_avatar_url,
    clothing_urls=signed_clothes_urls,
    ...
)
```

### 过期时间配置

默认签名有效期为 1 小时 (3600 秒),可根据需要调整:

```python
# 生成 10 分钟有效的签名 URL
signed_url = oss_service.get_signed_url_from_url(url, expires=600)

# 生成 24 小时有效的签名 URL
signed_url = oss_service.get_signed_url_from_url(url, expires=86400)
```

---

## 后续优化

可以考虑:

1. **Redis 缓存**: 在数据库前加一层 Redis,提升查询性能
2. **异步清理**: Celery 定时任务清理旧缓存和 OSS 文件
3. **监控告警**: 接入监控系统,跟踪去重率和节省成本
4. **前端优化**: 前端计算文件 MD5,提前判断是否已上传

## 相关文件

- 模型: `apps/common/models.py` - `OSSFileCache`
- 服务: `apps/common/services/oss_service.py` - `OSSFileHash`
- 迁移: `apps/common/migrations/0002_oss_file_cache.py`
- 命令: `apps/common/management/commands/cleanup_oss_cache.py`
