"""
统一存储服务
支持 OSS 和本地存储切换
支持 MD5 去重（跨进程持久化到数据库）

配置环境变量:
- STORAGE_TYPE: 存储类型 'oss' 或 'local'，默认 'local'
- OSS_ACCESS_KEY_ID: 阿里云 AccessKey ID
- OSS_ACCESS_KEY_SECRET: 阿里云 AccessKey Secret
- OSS_BUCKET_NAME: OSS Bucket 名称
- OSS_ENDPOINT: OSS 端点
- OSS_DOMAIN: 自定义域名 (可选)

返回值说明:
    upload_file() 返回 (storage_key, url, is_duplicate, content_key)
    - storage_key: 存储路径，如 "wardrobe/a1b2c3d4.jpg"
    - url: 访问 URL
    - is_duplicate: 是否重复
    - content_key: 内容 Key，如 "local:a1b2c3d4..." 或 "oss:a1b2c3d4..."
"""
import os
import hashlib
import logging
from typing import Optional, Tuple, BinaryIO, Dict, Any
from io import BytesIO

from apps.common.constants import (
    StorageType,
    StorageFolder,
    FileType,
    FileSizeLimit,
    ErrorMessage,
)
from apps.common.services.upload_config import UploadValidationError
from apps.common.utils.content_key import ContentKey

logger = logging.getLogger('storage')


def calculate_md5(content: bytes) -> str:
    """计算内容的 MD5 哈希"""
    return hashlib.md5(content).hexdigest()


def get_upload_record_model():
    """延迟导入 FileUploadRecord 模型，避免循环依赖"""
    from apps.common.models import FileUploadRecord
    return FileUploadRecord


class LocalStorageService:
    """
    本地文件存储服务
    将文件保存到 Django media 目录
    支持 MD5 去重（持久化到数据库）
    """

    def __init__(self):
        from django.conf import settings
        self.media_root = getattr(settings, 'MEDIA_ROOT', 'media')
        self.media_url = getattr(settings, 'MEDIA_URL', '/media/')
        self.enabled = True
        logger.info(f"[LocalStorage] 初始化成功: media_root={self.media_root}")

    def _ensure_dir(self, filepath: str):
        """确保目录存在"""
        os.makedirs(os.path.dirname(filepath), exist_ok=True)

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
            ext = self._get_ext_from_filename(filename)
            from apps.common.constants import FileExtension
            if not FileExtension.is_supported(ext):
                raise UploadValidationError(
                    f'{ErrorMessage.FILE_TYPE_NOT_SUPPORTED}，仅支持：{", ".join(FileExtension.ALL)}'
                )
        
        return ext

    def _generate_filename(self, folder: str, md5: str, ext: str = '.png') -> str:
        """基于 MD5 生成文件名（便于去重）"""
        return f"{folder}/{md5}{ext}"

    def _get_ext_from_content_type(self, content_type: str) -> str:
        """从 content-type 获取扩展名"""
        if 'png' in content_type:
            return '.png'
        elif 'jpeg' in content_type or 'jpg' in content_type:
            return '.jpg'
        elif 'webp' in content_type:
            return '.webp'
        elif 'gif' in content_type:
            return '.gif'
        elif 'text/plain' in content_type:
            return '.txt'
        elif 'json' in content_type:
            return '.json'
        elif 'pdf' in content_type:
            return '.pdf'
        return ''

    def _get_ext_from_filename(self, filename: str) -> str:
        """从文件名获取扩展名"""
        if '.' in filename:
            ext = os.path.splitext(filename)[1].lower()
            return ext if ext else ''
        return ''

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
            FileUploadRecord = get_upload_record_model()
            record = FileUploadRecord.get_by_md5(md5, tenant_id=tenant_id, storage_type='local')
            if record:
                logger.info(f"[LocalStorage] MD5 命中缓存: tenant={tenant_id}, md5={md5}")
                return record.storage_key, record.access_url
        except Exception as e:
            logger.warning(f"[LocalStorage] 查询缓存失败: {e}")
        return None

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
        width: int = 0,
        height: int = 0,
        ref_type: str = '',
        ref_id: str = '',
        source: str = '',
        client_ip: str = ''
    ):
        """保存上传记录"""
        try:
            FileUploadRecord = get_upload_record_model()
            FileUploadRecord.create_record(
                md5=md5,
                storage_type='local',
                storage_key=storage_key,
                access_url=access_url,
                folder=folder,
                tenant_id=tenant_id,
                file_category=file_category,
                file_size=file_size,
                content_type=content_type,
                file_ext=file_ext,
                width=width,
                height=height,
                ref_type=ref_type,
                ref_id=ref_id,
                source=source,
                client_ip=client_ip,
            )
        except Exception as e:
            logger.warning(f"[LocalStorage] 保存记录失败: {e}")

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
        上传文件到本地

        Args:
            file_obj: 文件对象
            filename: 原始文件名
            folder: 存储文件夹
            tenant_id: 租户 ID（用于去重隔离）
            content_type: 内容类型
            file_category: 文件用途分类
            skip_duplicate: 是否跳过重复文件（MD5 去重）
            ref_type: 关联类型
            ref_id: 关联 ID
            source: 上传来源
            client_ip: 客户端 IP

        Returns:
            (relative_path, url, is_duplicate)
        """
        # 读取内容
        if hasattr(file_obj, 'seek'):
            file_obj.seek(0)
        content = file_obj.read()

        # 验证上传文件（类型、大小）
        ext = self._validate_upload(content, filename, content_type)

        # 计算 MD5
        md5 = calculate_md5(content)

        # 检查去重
        if skip_duplicate and tenant_id:
            cached = self._check_duplicate(md5, tenant_id)
            if cached:
                content_key = ContentKey.from_md5(md5, 'local')
                return cached[0], cached[1], True, content_key

        # 生成存储路径
        relative_path = self._generate_filename(folder, md5, ext)
        full_path = os.path.join(self.media_root, relative_path)

        # 确保目录存在
        self._ensure_dir(full_path)

        # 写入文件
        with open(full_path, 'wb') as f:
            f.write(content)

        # 生成 URL
        url = f"{self.media_url}{relative_path.replace(os.sep, '/')}"

        # 保存上传记录
        if tenant_id:
            self._save_record(
                md5=md5,
                storage_key=relative_path,
                access_url=url,
                folder=folder,
                tenant_id=tenant_id,
                file_category=file_category,
                file_size=len(content),
                content_type=content_type,
                file_ext=ext,
                ref_type=ref_type,
                ref_id=ref_id,
                source=source,
                client_ip=client_ip,
            )

        logger.info(f"[LocalStorage] 文件已保存: {relative_path}, MD5={md5}")
        content_key = ContentKey.from_md5(md5, 'local')
        return relative_path, url, False, content_key

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
        从 Base64 数据上传

        Args:
            base64_data: Base64 编码数据（可带 data: 前缀）
            folder: 存储文件夹
            tenant_id: 租户 ID（用于去重隔离）
            content_type: 内容类型
            file_category: 文件用途分类
            skip_duplicate: 是否跳过重复文件（MD5 去重）
            ref_type: 关联类型
            ref_id: 关联 ID
            source: 上传来源
            client_ip: 客户端 IP

        Returns:
            (relative_path, url, is_duplicate)
        """
        import base64

        # 处理 data URL 格式
        if base64_data.startswith('data:'):
            # data:image/png;base64,xxxxx
            header, base64_data = base64_data.split(',', 1)
            # 从 header 提取 content-type
            if 'image/' in header:
                content_type = header.split(':')[1].split(';')[0]

        # 解码
        content = base64.b64decode(base64_data)

        # 验证上传文件（类型、大小）
        default_ext = FileType.get_extension(content_type)
        ext = self._validate_upload(content, 'image' + default_ext, content_type)

        # 计算 MD5
        md5 = calculate_md5(content)

        # 检查去重
        if skip_duplicate and tenant_id:
            cached = self._check_duplicate(md5, tenant_id)
            if cached:
                content_key = ContentKey.from_md5(md5, 'local')
                return cached[0], cached[1], True, content_key

        # 生成存储路径
        relative_path = self._generate_filename(folder, md5, ext)
        full_path = os.path.join(self.media_root, relative_path)

        # 确保目录存在
        self._ensure_dir(full_path)

        # 写入文件
        with open(full_path, 'wb') as f:
            f.write(content)

        # 生成 URL
        url = f"{self.media_url}{relative_path.replace(os.sep, '/')}"

        # 保存上传记录
        if tenant_id:
            self._save_record(
                md5=md5,
                storage_key=relative_path,
                access_url=url,
                folder=folder,
                tenant_id=tenant_id,
                file_category=file_category,
                file_size=len(content),
                content_type=content_type,
                file_ext=ext,
                ref_type=ref_type,
                ref_id=ref_id,
                source=source,
                client_ip=client_ip,
            )

        logger.info(f"[LocalStorage] Base64 文件已保存: {relative_path}, MD5={md5}")
        content_key = ContentKey.from_md5(md5, 'local')
        return relative_path, url, False, content_key
    
    def get_url(self, relative_path: str) -> str:
        """获取文件 URL"""
        return f"{self.media_url}{relative_path.replace(os.sep, '/')}"
    
    def get_signed_url(self, relative_path: str, expires: int = 3600) -> str:
        """本地存储不需要签名，返回完整 URL"""
        return self.get_url(relative_path)
    
    def get_signed_url_from_url(self, url: str, expires: int = 3600) -> str:
        """本地存储返回完整 URL（供 AI 引擎访问）"""
        if not url:
            return url
        
        # 已经是完整 URL，直接返回
        if url.startswith('http://') or url.startswith('https://'):
            return url
        
        # 相对路径，拼接完整 URL
        # 使用 BACKEND_URL 配置（与 get_full_url 保持一致）
        base_url = os.getenv('BACKEND_URL', 'http://localhost:8888')
        return f"{base_url.rstrip('/')}{url}"


class StorageService:
    """
    统一存储服务
    根据配置切换 OSS 或本地存储
    """
    
    _instance = None
    
    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = object.__new__(cls)
        return cls._instance
    
    def __init__(self):
        if hasattr(self, 'initialized'):
            return
        
        # 读取存储类型配置
        storage_type = os.getenv('STORAGE_TYPE', 'local').lower()
        
        self._storage_type = storage_type
        
        if storage_type == 'oss':
            # 使用 OSS 存储
            from apps.common.services.oss_service import oss_service
            self._backend = oss_service
            self._is_oss = True
            logger.info(f"[Storage] 使用 OSS 存储, enabled={oss_service.enabled}")
        else:
            # 使用本地存储
            self._backend = LocalStorageService()
            self._is_oss = False
            logger.info("[Storage] 使用本地存储")
        
        self.initialized = True
    
    @property
    def enabled(self) -> bool:
        """存储服务是否可用"""
        return getattr(self._backend, 'enabled', True)
    
    @property
    def is_oss(self) -> bool:
        """是否使用 OSS"""
        return self._is_oss
    
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
        上传文件

        Args:
            file_obj: 文件对象
            filename: 原始文件名
            folder: 存储文件夹
            tenant_id: 租户 ID（用于去重隔离）
            content_type: 内容类型
            file_category: 文件用途分类 (avatar/clothing/result/other)
            skip_duplicate: 是否跳过重复文件（MD5 去重）
            ref_type: 关联类型
            ref_id: 关联 ID
            source: 上传来源
            client_ip: 客户端 IP

        Returns:
            (key, url, is_duplicate)
        """
        return self._backend.upload_file(
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
        从 Base64 上传

        Args:
            base64_data: Base64 编码数据（可带 data: 前缀）
            folder: 存储文件夹
            tenant_id: 租户 ID（用于去重隔离）
            content_type: 内容类型
            file_category: 文件用途分类 (avatar/clothing/result/other)
            skip_duplicate: 是否跳过重复文件（MD5 去重）
            ref_type: 关联类型
            ref_id: 关联 ID
            source: 上传来源
            client_ip: 客户端 IP

        Returns:
            (key, url, is_duplicate)
        """
        return self._backend.upload_from_base64(
            base64_data=base64_data,
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
    
    def get_url(self, key: str) -> str:
        """获取文件 URL"""
        return self._backend.get_url(key)
    
    def get_signed_url(self, key: str, expires: int = 3600) -> str:
        """获取签名 URL（本地存储直接返回 URL）"""
        return self._backend.get_signed_url(key, expires)
    
    def get_signed_url_from_url(self, url: str, expires: int = 3600) -> str:
        """从 URL 生成签名 URL（本地存储直接返回原 URL）"""
        return self._backend.get_signed_url_from_url(url, expires)

    def get_url_by_key(self, key: str, tenant_id: str = '', storage_type: str = None) -> str:
        """
        根据存储 key 获取 URL（自动判断存储类型）
        
        从数据库查询记录，根据记录的 storage_type 决定返回本地 URL 还是 OSS 签名 URL
        
        Args:
            key: 存储路径（storage_key）或 MD5
            tenant_id: 租户 ID（用于 MD5 查询）
            storage_type: 存储类型（可选，默认使用当前配置的存储类型）
            
        Returns:
            访问 URL，未找到返回空字符串
        """
        FileUploadRecord = get_upload_record_model()
        
        # 确定存储类型
        if not storage_type:
            storage_type = self._storage_type
        
        # 尝试通过 storage_key + storage_type 查询
        try:
            record = FileUploadRecord.objects.get(storage_key=key, storage_type=storage_type)
            return self._get_url_from_record(record)
        except FileUploadRecord.DoesNotExist:
            pass
        
        # 尝试通过 MD5 + tenant_id + storage_type 查询
        if tenant_id:
            try:
                record = FileUploadRecord.objects.get(
                    md5_hash=key, 
                    tenant_id=tenant_id,
                    storage_type=storage_type
                )
                return self._get_url_from_record(record)
            except FileUploadRecord.DoesNotExist:
                pass
        
        # 未找到记录，根据当前存储类型返回默认 URL
        return self.get_url(key)

    def get_url_by_record(self, record) -> str:
        """
        根据数据库记录获取 URL
        
        Args:
            record: FileUploadRecord 实例
            
        Returns:
            访问 URL
        """
        return self._get_url_from_record(record)

    def _get_url_from_record(self, record) -> str:
        """
        根据记录获取 URL（内部方法）
        
        Args:
            record: FileUploadRecord 实例
            
        Returns:
            访问 URL
        """
        # 根据记录的存储类型决定 URL 生成方式
        if record.storage_type == 'oss':
            # OSS 存储：生成签名 URL
            return self._backend.get_signed_url(record.storage_key)
        else:
            # 本地存储：拼接完整 URL
            from django.conf import settings
            base_url = os.getenv('BASE_URL', 'http://127.0.0.1:8000')
            return f"{base_url.rstrip('/')}{record.access_url}"
    
    def delete_file(self, storage_key: str, storage_type: str = None) -> bool:
        """
        删除文件（根据存储类型调用对应的后端）
        
        Args:
            storage_key: 存储路径
            storage_type: 存储类型，默认使用当前配置的类型
            
        Returns:
            是否成功
        """
        if not storage_type:
            storage_type = self._storage_type
        
        if storage_type == 'oss':
            from apps.common.services.oss_service import oss_service
            return oss_service.delete_file(storage_key)
        else:
            # 本地存储删除
            try:
                filepath = os.path.join(self.media_root, storage_key)
                if os.path.exists(filepath):
                    os.remove(filepath)
                    logger.info(f"[LocalStorage] 文件删除成功: {storage_key}")
                    return True
                else:
                    logger.warning(f"[LocalStorage] 文件不存在: {storage_key}")
                    return False
            except Exception as e:
                logger.error(f"[LocalStorage] 删除失败: {storage_key}, error={e}")
                return False
    
    def delete_files(self, files: list) -> dict:
        """
        批量删除文件（根据存储类型分组处理）
        
        Args:
            files: 文件列表，每个元素为 {'storage_key': str, 'storage_type': str}
            
        Returns:
            {'deleted': int, 'failed': int, 'details': list}
        """
        if not files:
            return {'deleted': 0, 'failed': 0, 'details': []}
        
        # 按存储类型分组
        local_files = [f for f in files if f.get('storage_type', 'local') == 'local']
        oss_files = [f for f in files if f.get('storage_type') == 'oss']
        
        deleted = 0
        failed = 0
        details = []
        
        # 删除本地文件
        for f in local_files:
            storage_key = f['storage_key']
            if self._delete_local_file(storage_key):
                deleted += 1
                details.append({'key': storage_key, 'type': 'local', 'success': True})
            else:
                failed += 1
                details.append({'key': storage_key, 'type': 'local', 'success': False})
        
        # 批量删除 OSS 文件
        if oss_files:
            from apps.common.services.oss_service import oss_service
            oss_keys = [f['storage_key'] for f in oss_files]
            result = oss_service.delete_files(oss_keys)
            deleted += result['deleted']
            failed += result['failed']
            
            # 记录详情
            for i, f in enumerate(oss_files):
                # 简化：假设前 result['deleted'] 个成功
                success = i < result['deleted']
                details.append({'key': f['storage_key'], 'type': 'oss', 'success': success})
        
        logger.info(f"[Storage] 批量删除完成: deleted={deleted}, failed={failed}")
        return {'deleted': deleted, 'failed': failed, 'details': details}
    
    def _delete_local_file(self, storage_key: str) -> bool:
        """删除本地文件"""
        try:
            filepath = os.path.join(self.media_root, storage_key)
            if os.path.exists(filepath):
                os.remove(filepath)
                logger.info(f"[LocalStorage] 文件删除成功: {storage_key}")
                return True
            else:
                logger.warning(f"[LocalStorage] 文件不存在: {storage_key}")
                return True  # 文件不存在也算成功
        except Exception as e:
            logger.error(f"[LocalStorage] 删除失败: {storage_key}, error={e}")
            return False


# 全局单例
storage_service = StorageService()
