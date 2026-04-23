# 内容寻址存储 (Content-Addressable Storage)

## 概述

本项目采用内容寻址存储（CAS）模式，基于文件内容的 MD5 哈希生成唯一 Key，实现：

- **真正去重**：相同内容 = 相同 MD5 = 相同 Key = 只存一份
- **无带宽复用**：前端只需发送 Key，无需重新上传文件
- **存储无关**：支持本地存储和 OSS，统一接口

## Key 格式

### 内容 Key（Content Key）

格式：`{storage_type}:{md5}`

| 存储类型 | Key 示例 |
|----------|----------|
| 本地存储 | `local:a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6` |
| OSS 存储 | `oss:a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6` |

### 存储 Key（Storage Key）

格式：`{folder}/{md5}{ext}`

| 用途 | Key 示例 |
|------|----------|
| 头像 | `avatars/a1b2c3d4.jpg` |
| 服装 | `clothing/a1b2c3d4.png` |
| 结果 | `results/a1b2c3d4.jpg` |

### 记录 UUID

格式：`{prefix}{uuid4}`

| 类型 | UUID 示例 |
|------|-----------|
| 试穿记录 | `tryon_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6` |

## 核心组件

### ContentKey 工具类

```python
from apps.common.utils.content_key import ContentKey
from apps.common.constants import ContentKeyPrefix

# 生成 Key（基于文件内容）
key = ContentKey.from_content(file_content)
# -> "local:a1b2c3d4..."

# 生成 Key（基于已有 MD5）
key = ContentKey.from_md5(md5, storage_type=ContentKeyPrefix.OSS)
# -> "oss:a1b2c3d4..."

# 解析 Key
storage_type, md5 = ContentKey.parse(key)
# -> ('local', 'a1b2c3d4...')

# 验证 Key
if ContentKey.is_valid(key):
    ...

# 解析为 URL（找不到返回 None）
url = ContentKey.resolve_to_url(key, tenant_id='xxx')

# 解析为 URL（找不到抛异常）
url = ContentKey.resolve_or_raise(key, tenant_id='xxx', resource_name='头像')
```

### 存储类型判断

```python
from apps.common.services.storage_service import storage_service
from apps.common.constants import ContentKeyPrefix

# 判断当前存储类型
storage_type = ContentKeyPrefix.OSS if storage_service.is_oss else ContentKeyPrefix.LOCAL
```

### 常量定义

```python
from apps.common.constants import (
    StorageType,        # 存储类型
    StorageFolder,      # 存储文件夹
    ContentKeyPrefix,   # Key 前缀
    ContentKeyFormat,   # Key 格式
    RecordPrefix,       # 记录 UUID 前缀
    FileType,           # 文件类型
    FileSizeLimit,      # 大小限制
    ErrorMessage,       # 错误消息
)
```

## 数据流

### 上传流程

```
前端上传文件
    ↓
StorageService.upload_file()
    ↓
计算 MD5 = hashlib.md5(content).hexdigest()
    ↓
检查去重：FileUploadRecord.get_by_md5(md5, tenant_id, storage_type)
    ↓
┌─ 命中缓存 → 返回 (key, url, True, content_key)
└─ 未命中 → 保存文件 → 返回 (key, url, False, content_key)
    ↓
返回给前端：{ image_key: "local:xxx", image_url: "..." }
```

### 复用流程

```
前端发送 avatar_key = "local:xxx"
    ↓
ContentKey.is_valid(avatar_key) → True
    ↓
ContentKey.resolve_or_raise(avatar_key, tenant_id)
    ↓
查询 FileUploadRecord(md5=xxx, storage_type='local')
    ↓
┌─ 找到 → 返回 URL
└─ 找不到 → 抛出 ResourceNotFoundException
```

## 存储服务接口

### upload_file() 返回值

```python
storage_key, url, is_duplicate, content_key = storage_service.upload_file(
    file,
    filename='image.jpg',
    folder='avatars',
    tenant_id='xxx',
)

# storage_key: "avatars/a1b2c3d4.jpg"  - 存储路径
# url: "http://..."                    - 访问 URL
# is_duplicate: False                  - 是否重复
# content_key: "local:a1b2c3d4..."     - 内容 Key
```

## 前端集成

### 存储和复用

```javascript
// 上传后存储 Key
const { image_key, image_url } = await uploadImage(file)
setAvatarKey(image_key)  // 存储 "local:xxx"

// 复用时发送 Key
await submitTryOn({
  avatar_key: avatarKey,  // 发送 "local:xxx"
  clothing_uuids: [...],
})

// 后端通过 Key 查找，无需重新上传
```

## 配置

### 环境变量

```bash
# 存储类型
STORAGE_TYPE=local  # 或 oss

# OSS 配置（当 STORAGE_TYPE=oss 时）
OSS_ACCESS_KEY_ID=xxx
OSS_ACCESS_KEY_SECRET=xxx
OSS_BUCKET_NAME=xxx
OSS_ENDPOINT=oss-cn-shanghai.aliyuncs.com
```

### 文件限制

```python
from apps.common.constants import FileSizeLimit, FileType

# 最大文件大小：30MB
FileSizeLimit.MAX_FILE_SIZE

# 支持的文件类型
FileType.ALL  # ('image/jpeg', 'image/png', 'image/webp', ...)
```
