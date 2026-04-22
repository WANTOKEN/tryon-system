# 图片 URL 返回规范

## 背景

项目已接入阿里云 OSS 对象存储服务,所有图片应返回完整的公网访问 URL,而不是相对路径。

## 统一处理方案

### 工具函数

创建了统一的 URL 处理工具 `apps/common/utils/url_utils.py`:

```python
from apps.common.utils.url_utils import get_full_url

# 处理 URL 字符串
url = get_full_url(image_url)

# 处理 ImageField
url = get_image_url(avatar_field)
```

### 处理逻辑

`get_full_url(url)` 函数会:

1. 如果 URL 为空,返回 `None`
2. 如果 URL 已经以 `http://` 或 `https://` 开头,直接返回
3. 如果是相对路径(如 `/media/...`),拼接 `BACKEND_URL` 配置返回完整 URL

## 已更新的序列化器

### 1. 商家模块 (apps/accounts/serializers.py)

- `MerchantSerializer.avatar_url` - 头像 URL

**返回示例**:
```json
{
  "avatar_url": "https://your-bucket.oss-cn-hangzhou.aliyuncs.com/avatars/user123.jpg"
}
```

### 2. 衣橱模块 (apps/wardrobe/serializers.py)

- `ClothingSerializer.image_url` - 服装图片 URL
- `ClothingSerializer.image_thumb_url` - 服装缩略图 URL
- `PresetClothingSerializer.image_url` - 预设服装图片 URL

**返回示例**:
```json
{
  "image_url": "https://your-bucket.oss-cn-hangzhou.aliyuncs.com/clothing/abc123.jpg",
  "image_thumb_url": "https://your-bucket.oss-cn-hangzhou.aliyuncs.com/clothing/abc123_thumb.jpg"
}
```

### 3. 试衣模块 (apps/tryon/serializers.py)

- `TryOnRecordSerializer.avatar_url` - 人物照片 URL
- `TryOnRecordSerializer.result_url` - 试衣结果图 URL
- `TryOnRecordSerializer.result_thumb_url` - 试衣结果缩略图 URL
- `TryOnClothingSerializer.clothing_image` - 试穿服装图片 URL

**返回示例**:
```json
{
  "avatar_url": "https://your-bucket.oss-cn-hangzhou.aliyuncs.com/avatars/user456.jpg",
  "result_url": "https://your-bucket.oss-cn-hangzhou.aliyuncs.com/results/tryon789.jpg",
  "result_thumb_url": "https://your-bucket.oss-cn-hangzhou.aliyuncs.com/results/tryon789_thumb.jpg",
  "clothing": [
    {
      "clothing_image": "https://your-bucket.oss-cn-hangzhou.aliyuncs.com/clothing/cloth123.jpg"
    }
  ]
}
```

## 数据存储规范

### OSS 存储

- 使用 OSS 服务上传的文件,数据库中存储 **完整的 OSS URL**
- OSS 服务 `upload_file()` 方法返回完整的公网访问 URL
- 详见: `apps/common/services/oss_service.py`

### 本地存储 (开发环境)

- 本地存储的文件,数据库中存储 **相对路径** (如 `/media/clothing/xxx.jpg`)
- 序列化器会自动拼接 `BACKEND_URL` 转换为完整 URL

## 环境配置

### settings 配置

```python
# 后端服务 URL（用于生成完整的媒体文件链接）
BACKEND_URL = os.getenv('BACKEND_URL', 'http://localhost:8888')
```

### .env 文件

```bash
# 开发环境
BACKEND_URL=http://localhost:8888

# 生产环境
BACKEND_URL=https://api.yourdomain.com
```

## 优点

✅ **前端无需拼接**: 前端直接使用返回的 URL,无需判断是否完整  
✅ **统一处理**: 所有图片 URL 通过统一的工具函数处理  
✅ **自动兼容**: 自动识别完整 URL 和相对路径  
✅ **易于维护**: 新增图片字段只需调用 `get_full_url()`  
✅ **支持 OSS**: OSS 返回的完整 URL 直接使用,无需二次处理  

## 测试验证

可以通过 API 测试验证:

```bash
# 获取商家信息
GET /api/v1/auth/me/
# 检查返回的 avatar_url 是否为完整 URL

# 获取服装列表
GET /api/v1/wardrobe/clothes/
# 检查返回的 image_url 是否为完整 URL

# 获取试衣记录
GET /api/v1/tryon/records/
# 检查所有图片 URL 是否完整
```

## 后续维护

新增包含图片 URL 的接口时:

1. 在序列化器中使用 `SerializerMethodField`
2. 调用 `get_full_url()` 处理 URL
3. 确保 API 文档同步更新

示例代码:
```python
from apps.common.utils.url_utils import get_full_url

class MyModelSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    
    def get_image_url(self, obj):
        return get_full_url(obj.image_url)
```
