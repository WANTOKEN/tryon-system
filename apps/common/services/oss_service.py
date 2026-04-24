"""
阿里云 OSS 存储服务
用于存储用户上传的图片，并提供公网访问 URL 给 AI 引擎

特性:
- 单例模式管理 OSS 客户端
- MD5 去重避免重复上传
- 自动生成唯一文件路径

返回值说明:
    upload_file() 返回 (storage_key, url, is_duplicate, content_key)
    - storage_key: OSS 存储路径，如 "wardrobe/a1b2c3d4.jpg"
    - url: 访问 URL
    - is_duplicate: 是否重复
    - content_key: 内容 Key，如 "oss:a1b2c3d4..."

文档: https://help.aliyun.com/zh/oss/developer-reference/getting-started-with-oss-sdk-for-python
"""
import os
import uuid
import hashlib
import logging
from datetime import datetime
from typing import Optional, Tuple, BinaryIO, Union
from io import BytesIO

import oss2

from apps.common.constants import (
    StorageType,
    FileType,
    FileExtension,
    FileSizeLimit,
    ErrorMessage,
)
from apps.common.exceptions import OssException
from apps.common.services.upload_config import UploadValidationError
from apps.common.utils.content_key import ContentKey

logger = logging.getLogger('oss')


class OSSFileHash:
    """
    OSS 文件哈希管理器 (数据库持久化版本)
    
    用于 MD5 去重：
    - 相同内容的文件只上传一次
    - 后续上传直接返回已有的 URL
    - 使用数据库持久化,支持跨进程、跨服务
    """
    
    def calculate_md5(self, content: bytes) -> str:
        """计算内容的 MD5 哈希值"""
        return hashlib.md5(content).hexdigest()
    
    def calculate_file_md5(self, file: BinaryIO) -> str:
        """计算文件的 MD5 哈希值（会读取整个文件）"""
        md5_hash = hashlib.md5()
        
        # 保存当前位置
        original_pos = file.tell()
        file.seek(0)
        
        # 分块计算
        for chunk in iter(lambda: file.read(8192), b''):
            md5_hash.update(chunk)
        
        # 恢复位置
        file.seek(original_pos)
        
        return md5_hash.hexdigest()
    
    def get(self, md5: str, file_size: int = 0, content_type: str = '') -> Optional[Tuple[str, str]]:
        """
        根据 MD5 获取已上传的文件信息
        
        Args:
            md5: 文件 MD5 哈希
            file_size: 文件大小(仅用于统计)
            content_type: 文件类型(仅用于统计)
            
        Returns:
            (oss_key, url) 或 None
        """
        try:
            from apps.common.models import OSSFileCache
            return OSSFileCache.get_by_md5(md5)
        except Exception as e:
            # 数据库异常时降级到跳过去重
            logger.warning(f"[OSS] 查询缓存失败,跳过去重: {e}")
            return None
    
    def set(self, md5: str, oss_key: str, url: str, file_size: int = 0, content_type: str = ''):
        """
        缓存 MD5 映射到数据库
        
        Args:
            md5: 文件 MD5 哈希
            oss_key: OSS 文件路径
            url: 公网访问 URL
            file_size: 文件大小
            content_type: 文件类型
        """
        try:
            from apps.common.models import OSSFileCache
            OSSFileCache.set_cache(md5, oss_key, url, file_size, content_type)
        except Exception as e:
            # 数据库异常时仅记录日志,不影响上传
            logger.warning(f"[OSS] 保存缓存失败: {e}")
    
    def exists(self, md5: str) -> bool:
        """检查 MD5 是否已缓存"""
        try:
            from apps.common.models import OSSFileCache
            return OSSFileCache.objects.filter(md5=md5).exists()
        except Exception:
            return False
    
    def get_stats(self) -> dict:
        """获取缓存统计"""
        try:
            from apps.common.models import OSSFileCache
            from django.db.models import Sum, Count
            stats = OSSFileCache.objects.aggregate(
                total_count=Count('id'),
                total_size=Sum('file_size'),
                total_uploads=Sum('upload_count')
            )
            return {
                'cache_size': stats['total_count'] or 0,
                'total_size_bytes': stats['total_size'] or 0,
                'total_uploads': stats['total_uploads'] or 0,
            }
        except Exception as e:
            logger.warning(f"[OSS] 获取缓存统计失败: {e}")
            return {
                'cache_size': 0,
                'total_size_bytes': 0,
                'total_uploads': 0,
            }


# 全局 MD5 缓存实例
_hash_cache = OSSFileHash()


class OSSService:
    """
    阿里云 OSS 存储服务 (单例模式)
    
    功能:
    - 上传文件到 OSS
    - 生成签名 URL (临时访问)
    - 删除文件
    - 批量操作
    
    配置环境变量:
    - OSS_ACCESS_KEY_ID: 阿里云 AccessKey ID
    - OSS_ACCESS_KEY_SECRET: 阿里云 AccessKey Secret
    - OSS_BUCKET_NAME: OSS Bucket 名称
    - OSS_ENDPOINT: OSS 端点 (如: oss-cn-shanghai.aliyuncs.com)
    - OSS_DOMAIN: 自定义域名 (可选，用于生成访问 URL)
    """
    
    _instance = None
    
    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = object.__new__(cls)
        return cls._instance
    
    def __init__(self):
        # 防止重复初始化
        if hasattr(self, 'initialized'):
            return
        
        # 从环境变量读取配置
        self.access_key_id = os.getenv('OSS_ACCESS_KEY_ID', '')
        self.access_key_secret = os.getenv('OSS_ACCESS_KEY_SECRET', '')
        self.bucket_name = os.getenv('OSS_BUCKET_NAME', '')
        self.endpoint = os.getenv('OSS_ENDPOINT', 'oss-cn-shanghai.aliyuncs.com')
        self.domain = os.getenv('OSS_DOMAIN', '')  # 自定义域名
        
        # 初始化 OSS 客户端
        self._auth = None
        self._bucket = None
        self.enabled = self._check_config()
        
        if self.enabled:
            self._init_client()
        
        self.initialized = True
    
    def _check_config(self) -> bool:
        """检查配置是否完整"""
        if not all([self.access_key_id, self.access_key_secret, self.bucket_name]):
            logger.warning(
                "[OSS] 配置不完整，OSS 服务不可用。"
                f"ACCESS_KEY_ID={'已配置' if self.access_key_id else '缺失'}, "
                f"ACCESS_KEY_SECRET={'已配置' if self.access_key_secret else '缺失'}, "
                f"BUCKET_NAME={'已配置' if self.bucket_name else '缺失'}"
            )
            return False
        return True

    def _validate_upload(self, content: bytes, filename: str, content_type: str) -> str:
        """
        验证上传文件
        
        Args:
            content: 文件内容
            filename: 原始文件名
            content_type: 内容类型
            
        Returns:
            文件扩展名
            
        Raises:
            UploadValidationError: 验证失败
        """
        # 1. 验证文件大小
        file_size = len(content)
        if file_size > FileSizeLimit.MAX_FILE_SIZE:
            raise UploadValidationError(
                f'{ErrorMessage.FILE_TOO_LARGE}（最大 {FileSizeLimit.MAX_FILE_SIZE // 1024 // 1024}MB，当前 {file_size // 1024 // 1024}MB）'
            )
        
        if file_size == 0:
            raise UploadValidationError(ErrorMessage.FILE_EMPTY)
        
        # 2. 验证文件类型
        ext = ''
        
        # 优先从 content_type 获取扩展名
        if FileType.is_supported(content_type):
            ext = FileType.get_extension(content_type)
        else:
            # 从文件名获取扩展名
            if '.' in filename:
                ext = os.path.splitext(filename)[1].lower()
            if not FileExtension.is_supported(ext):
                raise UploadValidationError(
                    f'{ErrorMessage.FILE_TYPE_NOT_SUPPORTED}，仅支持：{", ".join(FileExtension.ALL)}'
                )
        
        return ext
    
    def _init_client(self):
        """初始化 OSS 客户端"""
        try:
            self._auth = oss2.Auth(self.access_key_id, self.access_key_secret)
            self._bucket = oss2.Bucket(
                self._auth,
                self.endpoint,
                self.bucket_name
            )
            logger.info(f"[OSS] 初始化成功: bucket={self.bucket_name}, endpoint={self.endpoint}")
        except Exception as e:
            logger.error(f"[OSS] 初始化失败: {e}")
            self.enabled = False
    
    @property
    def bucket(self) -> oss2.Bucket:
        """获取 Bucket 实例"""
        if not self.enabled:
            raise OssException('OSS 服务不可用，请检查配置')
        return self._bucket
    
    def _generate_file_key(
        self,
        folder: str,
        filename: str,
        tenant_id: str = '',
        md5: Optional[str] = None
    ) -> str:
        """
        生成 OSS 文件路径

        Args:
            folder: 文件夹名称
            filename: 原始文件名
            tenant_id: 租户 ID (可选)
            md5: 文件 MD5 哈希 (可选，用于文件名)

        Returns:
            OSS 文件路径
        """
        # 获取文件扩展名
        ext = os.path.splitext(filename)[1] or '.jpg'

        # 生成唯一文件名
        if md5:
            # 使用完整 MD5 作为文件名，确保相同内容生成相同文件名
            unique_name = f"{md5}{ext}"
        else:
            unique_name = f"{uuid.uuid4().hex}{ext}"

        # 构建完整路径：只用 folder + MD5，不暴露租户信息
        return f"{folder}/{unique_name}"
    
    def upload_file(
        self,
        file_obj: BinaryIO,
        filename: str = 'image.png',
        folder: str = 'uploads',
        tenant_id: str = '',
        content_type: str = 'image/png',
        file_category: str = 'other',
        skip_duplicate: bool = True,
        ref_type: str = '',
        ref_id: str = '',
        source: str = '',
        client_ip: str = ''
    ) -> Tuple[str, str, bool]:
        """
        上传文件到 OSS（支持 MD5 去重）

        Args:
            file_obj: 文件对象 (需有 read 方法)
            filename: 原始文件名
            folder: OSS 文件夹名称
            tenant_id: 租户 ID（用于去重隔离）
            content_type: 文件 MIME 类型
            file_category: 文件用途分类
            skip_duplicate: 是否跳过重复文件（基于 MD5）
            ref_type: 关联类型
            ref_id: 关联 ID
            source: 上传来源
            client_ip: 客户端 IP

        Returns:
            (oss_key, public_url, is_duplicate, md5) - OSS 文件路径、公网访问 URL、是否重复、文件 MD5

        Raises:
            OssException: 上传失败
        """
        if not self.enabled:
            raise OssException('OSS 服务不可用')

        try:
            # 读取文件内容
            original_pos = file_obj.tell() if hasattr(file_obj, 'tell') else 0
            content = file_obj.read()

            # 验证上传文件（类型、大小）
            self._validate_upload(content, filename, content_type)

            # 计算 MD5
            md5 = _hash_cache.calculate_md5(content)

            # 检查是否已存在（去重）
            if skip_duplicate and tenant_id:
                cached = self._check_duplicate(md5, tenant_id)
                if cached:
                    oss_key, public_url = cached
                    logger.info(
                        f"[OSS] 命中缓存跳过上传 | tenant={tenant_id} | md5={md5} | saved={len(content)}bytes"
                    )
                    content_key = ContentKey.from_md5(md5, 'oss')
                    return oss_key, public_url, True, content_key

            # 生成 OSS 路径（使用 MD5 前缀作为文件名的一部分，便于追踪）
            oss_key = self._generate_file_key(folder, filename, tenant_id, md5)

            # 设置 headers（包含缓存控制）
            headers = {
                'x-oss-meta-md5': md5,  # 存储 MD5 到元数据
                # 浏览器缓存：1 年（图片内容不变，可长期缓存）
                'Cache-Control': 'public, max-age=31536000, immutable',
                # 过期时间（兼容旧浏览器）
                'Expires': 'Thu, 31 Dec 2026 23:59:59 GMT',
            }
            if content_type:
                headers['Content-Type'] = content_type

            # 上传到 OSS
            result = self.bucket.put_object(oss_key, content, headers=headers)

            if result.status != 200:
                raise OssException(f'OSS 上传失败: HTTP {result.status}')

            # 生成访问 URL
            public_url = self.get_url(oss_key)

            # 保存上传记录
            if tenant_id:
                self._save_record(
                    md5=md5,
                    storage_key=oss_key,
                    access_url=public_url,
                    folder=folder,
                    tenant_id=tenant_id,
                    file_category=file_category,
                    file_size=len(content),
                    content_type=content_type,
                    ref_type=ref_type,
                    ref_id=ref_id,
                    source=source,
                    client_ip=client_ip,
                )

            logger.info(
                f"[OSS] 上传成功 | key={oss_key} | size={len(content)}bytes | md5={md5}"
            )

            content_key = ContentKey.from_md5(md5, 'oss')
            return oss_key, public_url, False, content_key

        except UploadValidationError:
            # 验证错误直接抛出，不包装
            raise
        except oss2.exceptions.OssError as e:
            logger.error(f"[OSS] 上传失败: {e}")
            raise OssException(f'OSS 上传失败: {e.message}')
        except Exception as e:
            logger.error(f"[OSS] 上传异常: {e}")
            raise OssException(f'OSS 上传异常: {str(e)}')

    def _check_duplicate(self, md5: str, tenant_id: str) -> Optional[Tuple[str, str]]:
        """
        检查是否已存在相同 MD5 的文件

        Args:
            md5: 文件 MD5
            tenant_id: 租户 ID

        Returns:
            如果存在，返回 (storage_key, access_url)；否则返回 None
        """
        try:
            FileUploadRecord = self._get_upload_record_model()
            record = FileUploadRecord.get_by_md5(md5, tenant_id=tenant_id, storage_type='oss')
            if record:
                return record.storage_key, record.access_url
        except Exception as e:
            logger.warning(f"[OSS] 查询缓存失败: {e}")
        return None

    def _get_upload_record_model(self):
        """延迟导入 FileUploadRecord 模型"""
        from apps.common.models import FileUploadRecord
        return FileUploadRecord

    def _save_record(
        self,
        md5: str,
        storage_key: str,
        access_url: str,
        folder: str,
        tenant_id: str,
        file_category: str = 'other',
        file_size: int = 0,
        content_type: str = '',
        file_ext: str = '',
        ref_type: str = '',
        ref_id: str = '',
        source: str = '',
        client_ip: str = ''
    ):
        """保存上传记录"""
        try:
            FileUploadRecord = self._get_upload_record_model()
            FileUploadRecord.create_record(
                md5=md5,
                storage_type='oss',
                storage_key=storage_key,
                access_url=access_url,
                folder=folder,
                tenant_id=tenant_id,
                file_category=file_category,
                file_size=file_size,
                content_type=content_type,
                file_ext=file_ext,
                ref_type=ref_type,
                ref_id=ref_id,
                source=source,
                client_ip=client_ip,
            )
        except Exception as e:
            logger.warning(f"[OSS] 保存记录失败: {e}")
    
    def upload_from_path(
        self,
        local_path: str,
        folder: str = 'uploads',
        tenant_id: str = '',
        file_category: str = 'other',
        skip_duplicate: bool = True,
        ref_type: str = '',
        ref_id: str = '',
        source: str = '',
        client_ip: str = ''
    ) -> Tuple[str, str, bool]:
        """
        从本地路径上传文件

        Args:
            local_path: 本地文件路径
            folder: OSS 文件夹名称
            tenant_id: 租户 ID（用于去重隔离）
            file_category: 文件用途分类
            skip_duplicate: 是否跳过重复文件
            ref_type: 关联类型
            ref_id: 关联 ID
            source: 上传来源
            client_ip: 客户端 IP

        Returns:
            (oss_key, public_url, is_duplicate)
        """
        filename = os.path.basename(local_path)

        with open(local_path, 'rb') as f:
            return self.upload_file(
                file=f,
                filename=filename,
                folder=folder,
                tenant_id=tenant_id,
                file_category=file_category,
                skip_duplicate=skip_duplicate,
                ref_type=ref_type,
                ref_id=ref_id,
                source=source,
                client_ip=client_ip
            )
    
    def upload_from_base64(
        self,
        base64_data: str,
        folder: str = 'uploads',
        tenant_id: str = '',
        content_type: str = 'image/png',
        file_category: str = 'other',
        skip_duplicate: bool = True,
        ref_type: str = '',
        ref_id: str = '',
        source: str = '',
        client_ip: str = ''
    ) -> Tuple[str, str, bool]:
        """
        从 Base64 数据上传文件

        Args:
            base64_data: Base64 编码的文件数据
            folder: OSS 文件夹名称
            tenant_id: 租户 ID（用于去重隔离）
            content_type: 文件 MIME 类型
            file_category: 文件用途分类
            skip_duplicate: 是否跳过重复文件
            ref_type: 关联类型
            ref_id: 关联 ID
            source: 上传来源
            client_ip: 客户端 IP

        Returns:
            (oss_key, public_url, is_duplicate)
        """
        import base64 as b64_module

        # 解码 Base64
        # 处理 data URL 格式: data:image/png;base64,xxxxx
        if ',' in base64_data:
            header, base64_data = base64_data.split(',', 1)
            # 从 header 提取 content-type
            if 'image/' in header:
                content_type = header.split(':')[1].split(';')[0]

        content = b64_module.b64decode(base64_data)

        # 确定扩展名
        ext_map = {
            'image/png': '.png',
            'image/jpeg': '.jpg',
            'image/webp': '.webp',
        }
        ext = ext_map.get(content_type, '.png')

        # 生成文件名
        filename = f"{uuid.uuid4().hex}{ext}"

        # 创建类文件对象
        file_obj = BytesIO(content)

        return self.upload_file(
            file_obj=file_obj,
            filename=filename,
            folder=folder,
            tenant_id=tenant_id,
            content_type=content_type,
            file_category=file_category,
            skip_duplicate=skip_duplicate,
            ref_type=ref_type,
            ref_id=ref_id,
            source=source,
            client_ip=client_ip
        )
    
    def get_url(self, oss_key: str) -> str:
        """
        获取文件的公网访问 URL
        
        Args:
            oss_key: OSS 文件路径
        
        Returns:
            公网访问 URL
        """
        if self.domain:
            # 使用自定义域名
            return f"https://{self.domain}/{oss_key}"
        else:
            # 使用 OSS 默认域名
            return f"https://{self.bucket_name}.{self.endpoint}/{oss_key}"
    
    def get_signed_url(
        self,
        oss_key: str,
        expires: int = 3600
    ) -> str:
        """
        获取带签名的临时访问 URL
        
        Args:
            oss_key: OSS 文件路径
            expires: 过期时间（秒），默认 1 小时
        
        Returns:
            签名 URL（HTTPS）
        """
        if not self.enabled:
            raise OssException('OSS 服务不可用')
        
        url = self.bucket.sign_url('GET', oss_key, expires)
        # 强制使用 HTTPS
        if url.startswith('http://'):
            url = 'https://' + url[7:]
        return url
    
    def get_signed_url_from_url(self, url: str, expires: int = 3600) -> str:
        """
        从 URL 生成带签名的临时访问 URL
        
        Args:
            url: 原 URL (公网 URL 或 OSS 路径)
            expires: 过期时间（秒），默认 1 小时
        
        Returns:
            签名 URL (如果是 OSS 文件) 或原 URL (如果不是 OSS 文件)
        """
        if not url:
            return url
        
        # 已经是签名 URL，直接返回
        if 'OSSAccessKeyId' in url or 'Signature' in url:
            return url
        
        # 非 OSS URL (如第三方图片)，直接返回
        if not self._is_oss_url(url):
            logger.info(f"[OSS] 非 OSS URL，直接返回: {url}")
            return url
        
        # 提取 oss_key
        oss_key = self._extract_oss_key(url)
        if not oss_key:
            return url
        
        return self.get_signed_url(oss_key, expires)
    
    def _is_oss_url(self, url: str) -> bool:
        """判断是否为 OSS URL"""
        if not url or not url.startswith('http'):
            return False
        
        # 检查是否包含我们的 OSS 域名
        if self.domain and self.domain in url:
            return True
        # 检查是否包含 OSS 默认域名
        if f"{self.bucket_name}.{self.endpoint}" in url:
            return True
        
        return False
    
    def _extract_oss_key(self, url: str) -> Optional[str]:
        """从 URL 中提取 oss_key"""
        if not url:
            return None
        
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            path = parsed.path.lstrip('/')
            return path if path else None
        except Exception:
            return None
    
    def delete_file(self, oss_key: str) -> bool:
        """
        删除 OSS 文件
        
        Args:
            oss_key: OSS 文件路径
        
        Returns:
            是否成功
        """
        if not self.enabled:
            return False
        
        try:
            self.bucket.delete_object(oss_key)
            logger.info(f"[OSS] 文件删除成功: key={oss_key}")
            return True
        except oss2.exceptions.OssError as e:
            logger.error(f"[OSS] 删除失败: key={oss_key}, error={e}")
            return False
    
    def delete_files(self, oss_keys: list) -> dict:
        """
        批量删除 OSS 文件
        
        Args:
            oss_keys: OSS 文件路径列表
        
        Returns:
            {'deleted': int, 'failed': int}
        """
        if not self.enabled or not oss_keys:
            return {'deleted': 0, 'failed': len(oss_keys)}
        
        try:
            result = self.bucket.batch_delete_objects(oss_keys)
            deleted = len(result.deleted_keys) if hasattr(result, 'deleted_keys') else 0
            logger.info(f"[OSS] 批量删除成功: {deleted} 个文件")
            return {'deleted': deleted, 'failed': len(oss_keys) - deleted}
        except oss2.exceptions.OssError as e:
            logger.error(f"[OSS] 批量删除失败: {e}")
            return {'deleted': 0, 'failed': len(oss_keys)}
    
    def file_exists(self, oss_key: str) -> bool:
        """
        检查文件是否存在
        
        Args:
            oss_key: OSS 文件路径
        
        Returns:
            是否存在
        """
        if not self.enabled:
            return False
        
        try:
            return self.bucket.object_exists(oss_key)
        except oss2.exceptions.OssError:
            return False
    
    def get_file_meta(self, oss_key: str) -> Optional[dict]:
        """
        获取文件元信息
        
        Args:
            oss_key: OSS 文件路径
        
        Returns:
            元信息字典
        """
        if not self.enabled:
            return None
        
        try:
            meta = self.bucket.head_object(oss_key)
            return {
                'size': meta.content_length,
                'content_type': meta.content_type,
                'last_modified': meta.last_modified,
                'etag': meta.etag,
            }
        except oss2.exceptions.OssError:
            return None
    
    def list_files(
        self,
        prefix: str,
        max_keys: int = 100
    ) -> list:
        """
        列出指定前缀的文件
        
        Args:
            prefix: 文件前缀
            max_keys: 最大返回数量
        
        Returns:
            文件信息列表
        """
        if not self.enabled:
            return []
        
        try:
            files = []
            for obj in oss2.ObjectIterator(
                self.bucket,
                prefix=prefix,
                max_keys=max_keys
            ):
                files.append({
                    'key': obj.key,
                    'size': obj.size,
                    'last_modified': obj.last_modified,
                    'etag': obj.etag,
                })
            return files
        except oss2.exceptions.OssError as e:
            logger.error(f"[OSS] 列出文件失败: {e}")
            return []
    
    def health_check(self) -> dict:
        """
        健康检查
        
        Returns:
            {'status': 'ok'|'error', 'message': str}
        """
        if not self.enabled:
            return {
                'status': 'disabled',
                'message': 'OSS 服务未配置'
            }
        
        try:
            # 尝试获取 Bucket 信息
            info = self.bucket.get_bucket_info()
            cache_stats = _hash_cache.get_stats()
            return {
                'status': 'ok',
                'message': f"Bucket: {info.name}, Region: {info.location}",
                'cache_stats': cache_stats,
            }
        except Exception as e:
            return {
                'status': 'error',
                'message': str(e)
            }
    
    def get_cache_stats(self) -> dict:
        """
        获取 MD5 缓存统计
        
        Returns:
            缓存统计信息
        """
        return _hash_cache.get_stats()
    
    def clear_cache(self):
        """清空 MD5 缓存"""
        _hash_cache.clear()
        logger.info("[OSS] MD5 缓存已清空")


# 全局单例
oss_service = OSSService()
