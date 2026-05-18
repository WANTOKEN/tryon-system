"""
URL 工具函数
统一处理图片 URL,确保返回完整的可访问链接
支持 OSS 预签名 URL 自动生成
支持通过 key 获取 URL（通用，同时支持 OSS 和本地存储）

Key 设计：
- 存储 Key 格式: {folder}/{md5}{ext}，如 "wardrobe/a1b2c3d4e5f6.jpg"
- 内容 Key 格式: {storage_type}:{md5}，如 "local:a1b2c3d4e5f6"
- MD5 是基于图片内容计算的，相同内容 = 相同 MD5 = 相同 Key
- 这实现了真正的去重：相同图片只需存储一次
"""
import os
import hashlib
from django.conf import settings
from typing import Optional, Tuple
from functools import lru_cache

from apps.common.constants import FileSizeLimit, StorageType

# URL 缓存（避免重复处理同一个 URL）
_url_cache = {}
_cache_max_size = 1000


def get_url_by_key(key, expires=86400):
    """
    通过存储 key 获取完整 URL（通用方法）
    
    同时支持 OSS 和本地存储：
    - OSS: 生成预签名 URL
    - 本地: 返回完整 URL
    
    Args:
        key: 存储 key，如 "wardrobe/abc123.jpg" 或 "tryon_avatars/xxx.png"
        expires: 预签名 URL 有效期（秒），仅 OSS 有效，默认 24 小时
        
    Returns:
        完整的可访问 URL
    """
    if not key:
        return None
    
    # 获取存储服务
    from apps.common.services.storage_service import StorageService
    storage = StorageService()
    
    # 生成 URL（自动处理 OSS 预签名或本地路径）
    return storage.get_signed_url(key, expires=expires)


def get_key_from_url(url):
    """
    从 URL 中提取存储 key
    
    支持格式：
    - OSS URL: https://bucket.oss-cn-shanghai.aliyuncs.com/wardrobe/xxx.jpg → wardrobe/xxx.jpg
    - 本地 URL: /media/wardrobe/xxx.jpg → wardrobe/xxx.jpg
    - 完整本地 URL: http://localhost:8888/media/wardrobe/xxx.jpg → wardrobe/xxx.jpg
    
    Args:
        url: 图片 URL
        
    Returns:
        存储 key，如 "wardrobe/abc123.jpg"
    """
    if not url:
        return ''
    
    # OSS URL
    if url.startswith('http://') or url.startswith('https://'):
        # 检查是否是 OSS URL
        storage_type = os.getenv('STORAGE_TYPE', 'local').lower()
        if storage_type == 'oss':
            try:
                from apps.common.services.oss_service import oss_service
                if oss_service.enabled:
                    return oss_service._extract_oss_key(url) or ''
            except Exception:
                pass
        
        # 本地完整 URL，提取 /media/ 后的路径
        from urllib.parse import urlparse
        parsed = urlparse(url)
        path = parsed.path
        
        # 移除 /media/ 前缀
        if path.startswith('/media/'):
            return path[7:]
        
        return path.lstrip('/')
    
    # 相对路径
    if url.startswith('/media/'):
        return url[7:]
    
    # 已经是 key 格式
    return url


def get_full_url(url, use_presigned=True):
    """
    获取完整的可访问 URL
    
    根据 URL 的实际存储类型动态处理：
    - 本地 URL：拼接后端域名返回完整 URL
    - OSS URL：生成预签名 URL 或公共读 URL
    - 相对路径：拼接后端域名
    
    Args:
        url: 图片 URL,可以是完整 URL 或相对路径
        use_presigned: 是否对 OSS URL 生成预签名（默认 True）
        
    Returns:
        完整的可访问 URL,如果 url 为空则返回 None
    """
    if not url:
        return None
    
    # 检查缓存
    cache_key = f"{url}:{use_presigned}"
    if cache_key in _url_cache:
        return _url_cache[cache_key]
    
    # 获取 base_url
    base_url = getattr(settings, 'BACKEND_URL', 'http://localhost:8888')
    
    # 如果是相对路径，拼接后端域名
    if not url.startswith('http://') and not url.startswith('https://'):
        if not url.startswith('/'):
            url = f'/{url}'
        result = f"{base_url.rstrip('/')}{url}"
        
        # 保存到缓存
        if len(_url_cache) >= _cache_max_size:
            keys_to_remove = list(_url_cache.keys())[:_cache_max_size // 2]
            for k in keys_to_remove:
                del _url_cache[k]
        _url_cache[cache_key] = result
        return result
    
    # 完整 URL：根据实际类型处理
    from urllib.parse import urlparse, urlunparse
    parsed = urlparse(url)
    backend_parsed = urlparse(base_url)
    
    # 判断是否是本地 URL
    is_local_url = (
        parsed.netloc == backend_parsed.netloc or
        parsed.netloc.startswith('localhost:') or
        parsed.netloc == 'localhost' or
        parsed.netloc.startswith('127.0.0.1:')
    )
    
    result = None
    
    if is_local_url:
        # 本地 URL：替换域名部分为 BACKEND_URL
        result = urlunparse((
            backend_parsed.scheme,
            backend_parsed.netloc,
            parsed.path,
            parsed.params,
            parsed.query,
            parsed.fragment
        ))
    else:
        # 外部 URL（OSS 或其他）：使用 _get_presigned_url_if_oss 处理
        # use_presigned=True 时，use_public_read=None（自动判断）
        # use_presigned=False 时，use_public_read=True（使用公共读）
        use_public_read = not use_presigned if use_presigned is not None else None
        result = _get_presigned_url_if_oss(url, use_public_read=use_public_read)
    
    # 保存到缓存
    if len(_url_cache) >= _cache_max_size:
        keys_to_remove = list(_url_cache.keys())[:_cache_max_size // 2]
        for k in keys_to_remove:
            del _url_cache[k]
    _url_cache[cache_key] = result
    return result


def _migrate_local_url_to_oss(url: str) -> Optional[str]:
    """
    将本地 URL 迁移到 OSS
    
    当系统配置为 OSS 存储时，如果遇到本地 URL（旧数据），
    尝试将图片上传到 OSS 并返回 OSS URL。
    
    Args:
        url: 本地 URL，如 "http://localhost:8888/media/clothing/xxx.png"
        
    Returns:
        OSS URL 或 None（迁移失败）
    """
    try:
        from urllib.parse import urlparse
        import requests
        from apps.common.services.oss_service import oss_service
        
        if not oss_service.enabled:
            return None
        
        parsed = urlparse(url)
        path = parsed.path
        
        # 移除 /media/ 前缀
        if path.startswith('/media/'):
            storage_key = path[7:]
        else:
            storage_key = path.lstrip('/')
        
        # 提取文件名中的 MD5
        filename = os.path.basename(path)
        if '.' in filename:
            md5 = os.path.splitext(filename)[0]
            ext = os.path.splitext(filename)[1]
        else:
            md5 = filename
            ext = ''
        
        # 验证 MD5 格式
        if len(md5) != 32 or not all(c in '0123456789abcdefABCDEF' for c in md5):
            print(f"[_migrate_local_url_to_oss] 无效的 MD5 格式: {md5}")
            return None
        
        print(f"[_migrate_local_url_to_oss] 开始迁移: md5={md5}, key={storage_key}")
        
        # 检查 OSS 是否已存在该文件
        existing_url = oss_service.get_signed_url(storage_key, expires=3600)
        if existing_url:
            # 验证文件是否真的存在
            try:
                resp = requests.head(existing_url, timeout=5)
                if resp.status_code == 200:
                    print(f"[_migrate_local_url_to_oss] OSS 已存在: {storage_key}")
                    return existing_url
            except Exception:
                pass
        
        # 从本地服务下载文件
        print(f"[_migrate_local_url_to_oss] 从本地下载: {url}")
        resp = requests.get(url, timeout=30)
        if resp.status_code != 200:
            print(f"[_migrate_local_url_to_oss] 下载失败: status={resp.status_code}")
            return None
        
        content = resp.content
        content_type = resp.headers.get('Content-Type', 'image/png')
        
        # 上传到 OSS（将 bytes 包装为 BytesIO）
        from io import BytesIO
        file_obj = BytesIO(content)
        
        print(f"[_migrate_local_url_to_oss] 上传到 OSS: key={storage_key}, size={len(content)}")
        oss_key, oss_url, _, _ = oss_service.upload_file(
            file_obj=file_obj,
            filename=filename,
            folder=os.path.dirname(storage_key) or 'migrated',
            content_type=content_type,
            file_category='other',
            source='migration'
        )
        
        if oss_url:
            print(f"[_migrate_local_url_to_oss] 迁移成功: {oss_url}")
            return oss_url
        
        return None
        
    except Exception as e:
        print(f"[_migrate_local_url_to_oss] 迁移失败: {e}")
        return None


def _migrate_oss_url_to_local(url: str) -> Optional[str]:
    """
    将 OSS URL 迁移到本地存储
    
    当系统配置为本地存储时，如果遇到 OSS URL（旧数据），
    尝试从数据库找到对应的本地记录并返回本地 URL。
    
    Args:
        url: OSS URL，如 "https://bucket.oss-cn-shanghai.aliyuncs.com/wardrobe/xxx.png"
        
    Returns:
        本地 URL 或 None（找不到记录）
    """
    try:
        from urllib.parse import urlparse
        from apps.common.models import FileUploadRecord
        
        parsed = urlparse(url)
        path = parsed.path
        
        # 提取文件名中的 MD5
        filename = os.path.basename(path)
        if '.' in filename:
            md5 = os.path.splitext(filename)[0]
        else:
            md5 = filename
        
        # 验证 MD5 格式
        if len(md5) != 32 or not all(c in '0123456789abcdefABCDEF' for c in md5):
            print(f"[_migrate_oss_url_to_local] 无效的 MD5 格式: {md5}")
            return None
        
        print(f"[_migrate_oss_url_to_local] 开始查找: md5={md5}")
        
        # 在数据库中查找该 MD5 的本地存储记录
        record = FileUploadRecord.objects.filter(
            md5_hash=md5,
            storage_type='local'
        ).first()
        
        if record and record.access_url:
            print(f"[_migrate_oss_url_to_local] 找到本地记录: {record.access_url}")
            # 返回本地 URL（使用 get_full_url 处理）
            return get_full_url(record.access_url)
        
        print(f"[_migrate_oss_url_to_local] 未找到本地记录: md5={md5}")
        return None
        
    except Exception as e:
        print(f"[_migrate_oss_url_to_local] 查找失败: {e}")
        return None


def _get_presigned_url_if_oss(url, use_public_read=None, expires=604800):
    """
    根据图片原始存储类型返回可访问的 URL
    
    动态判断 URL 的存储类型：
    - OSS URL：生成预签名 URL 或公共读 URL
    - 本地 URL：拼接后端域名返回完整 URL
    
    注意：不根据当前系统配置强制转换，而是根据图片实际存储位置返回对应 URL
    
    Args:
        url: 完整的 URL
        use_public_read: 是否使用公共读模式，None 表示自动判断
        expires: 预签名 URL 过期时间（秒），默认 7 天
        
    Returns:
        可访问的 URL（预签名 OSS URL 或完整本地 URL）
    """
    if not url:
        return None
    
    # 如果已经有签名参数，直接返回
    if 'OSSAccessKeyId' in url or 'Signature' in url or 'X-Tos' in url:
        return url
    
    # 判断是否是本地 URL
    base_url = getattr(settings, 'BACKEND_URL', 'http://localhost:8888')
    from urllib.parse import urlparse
    parsed = urlparse(url)
    backend_parsed = urlparse(base_url)
    
    is_local_url = (
        parsed.netloc == backend_parsed.netloc or
        parsed.netloc.startswith('localhost:') or
        parsed.netloc == 'localhost' or
        parsed.netloc.startswith('127.0.0.1:')
    )
    
    # 本地 URL：拼接后端域名返回完整 URL
    if is_local_url or not (url.startswith('http://') or url.startswith('https://')):
        return get_full_url(url)
    
    # OSS URL：尝试生成预签名 URL
    try:
        from apps.common.services.oss_service import oss_service
        
        if not oss_service.enabled:
            # OSS 服务未启用，但 URL 是 OSS 格式，直接返回原 URL（可能无法访问）
            return url
        
        if not oss_service._is_oss_url(url):
            # 不是 OSS URL，按外部 URL 处理
            return url
        
        oss_key = oss_service._extract_oss_key(url)
        if not oss_key:
            return url
        
        if use_public_read is None:
            use_public_read = oss_service.public_read
        
        if use_public_read:
            return oss_service.get_url(oss_key)
        else:
            return oss_service.get_signed_url(oss_key, expires=expires)
            
    except Exception as e:
        print(f"[URL] 生成 OSS URL 失败: {e}")
    
    return url


def get_public_url(url):
    """
    获取服装图片 URL
    
    根据 OSS_PUBLIC_READ 自动判断：
    - OSS_PUBLIC_READ=true: 返回公共读 URL（无签名）
    - OSS_PUBLIC_READ=false: 返回预签名 URL（7天有效）
    
    Args:
        url: 原始 URL
        
    Returns:
        可访问的 URL
    """
    return _get_presigned_url_if_oss(url, use_public_read=None)


def get_private_url(url, expires=604800):
    """
    获取私有读预签名 URL（试穿结果等私密图片）
    
    适用于：需要权限控制的图片，如试穿结果
    
    Args:
        url: 原始 URL
        expires: 过期时间（秒），默认 7 天
        
    Returns:
        预签名 URL（7天有效）
    """
    return _get_presigned_url_if_oss(url, use_public_read=False, expires=expires)


def _get_presigned_url_if_oss_legacy(url):
    """
    [已废弃] 旧版预签名 URL 生成函数
    
    保留用于兼容，新代码请使用 get_public_url() 或 get_private_url()
    """
    return _get_presigned_url_if_oss(url)


def get_image_url(image_field):
    """
    获取图片字段的完整 URL
    
    处理 Django ImageField 或单纯 URL 字符串
    
    Args:
        image_field: ImageField 实例或 URL 字符串
        
    Returns:
        完整的可访问 URL
    """
    if not image_field:
        return None
    
    # 如果是字符串
    if isinstance(image_field, str):
        return get_full_url(image_field)
    
    # 如果是 ImageField
    if hasattr(image_field, 'url'):
        return get_full_url(image_field.url)
    
    return None


def get_thumb_url(url, width=200, height=200, quality=80, use_presigned=None):
    """
    获取缩略图 URL
    
    Args:
        url: 原图 URL
        width: 宽度，默认 200
        height: 高度，默认 200
        quality: 图片质量，默认 80
        use_presigned: 是否使用预签名，None 表示根据 OSS_PUBLIC_READ 自动判断
        
    Returns:
        缩略图 URL
    """
    if not url:
        return None
    
    storage_type = os.getenv('STORAGE_TYPE', 'local').lower()
    
    if storage_type != 'oss':
        return get_full_url(url)
    
    try:
        from apps.common.services.oss_service import oss_service
        
        if not oss_service.enabled:
            return get_full_url(url)
        
        oss_key = oss_service._extract_oss_key(url)
        if not oss_key:
            return get_full_url(url)
        
        if use_presigned is None:
            use_presigned = not oss_service.public_read
        
        if use_presigned:
            return oss_service.get_signed_thumb_url(
                oss_key,
                width=width,
                height=height,
                quality=quality,
                format='webp',
                expires=604800
            )
        else:
            return oss_service.get_thumb_url(
                oss_key,
                width=width,
                height=height,
                quality=quality,
                format='webp'
            )
    except Exception as e:
        print(f"[URL] 获取缩略图失败: {e}")
        return get_full_url(url)


def calculate_content_md5(content: bytes) -> str:
    """
    计算内容的 MD5 哈希值
    
    Args:
        content: 文件内容（字节）
        
    Returns:
        MD5 哈希字符串（32位小写）
    """
    return hashlib.md5(content).hexdigest()


def generate_key_from_content(content: bytes, folder: str, ext: str = '.jpg') -> str:
    """
    基于内容生成唯一的存储 key
    
    相同内容 = 相同 MD5 = 相同 Key
    
    Args:
        content: 文件内容（字节）
        folder: 存储文件夹，如 "wardrobe"、"tryon_avatars"
        ext: 文件扩展名，如 ".jpg"、".png"
        
    Returns:
        存储 key，如 "wardrobe/a1b2c3d4e5f6g7h8i9j0.jpg"
    """
    md5 = calculate_content_md5(content)
    return f"{folder}/{md5}{ext}"


def get_md5_from_key(key: str) -> Optional[str]:
    """
    从存储 key 中提取 MD5
    
    Args:
        key: 存储 key，如 "wardrobe/a1b2c3d4e5f6.jpg"
        
    Returns:
        MD5 字符串，如 "a1b2c3d4e5f6"
    """
    if not key:
        return None
    
    # 提取文件名（不含扩展名）
    filename = os.path.basename(key)
    if '.' in filename:
        md5 = os.path.splitext(filename)[0]
        # 验证是否是有效的 MD5 格式（32位十六进制）
        if len(md5) == 32 and all(c in '0123456789abcdef' for c in md5.lower()):
            return md5
    
    return None


def resolve_key_to_url(key: str, tenant_id: str = None, expires: int = 86400) -> Optional[str]:
    """
    解析 key 为可访问的 URL
    
    支持的 key 格式：
    1. 内容 Key: "local:xxx" 或 "oss:xxx" → 使用 ContentKey 解析
    2. 完整存储路径: "wardrobe/a1b2c3d4.jpg" → 直接解析
    3. 记录 UUID: "tryon_xxx" → 从对应记录获取 URL
    
    Args:
        key: 存储 key 或内容 Key 或记录 UUID
        tenant_id: 租户 ID（用于内容 Key 查询）
        expires: 预签名 URL 有效期（秒）
        
    Returns:
        可访问的 URL，找不到返回 None
    """
    if not key:
        return None
    
    # 1. 检查是否是记录 UUID
    if key.startswith('tryon_') and len(key) == 42:
        try:
            from apps.tryon.models import TryOnRecord
            record = TryOnRecord.objects.get(uuid=key)
            return get_full_url(record.avatar_url)
        except Exception:
            pass
    
    # 2. 检查是否是内容 Key
    from apps.common.utils.content_key import ContentKey
    if ContentKey.is_valid(key):
        return ContentKey.resolve_to_url(key, tenant_id)
    
    # 3. 作为存储路径处理
    return get_url_by_key(key, expires=expires)
