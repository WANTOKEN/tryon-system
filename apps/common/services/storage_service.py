"""
统一存储服务
支持 OSS 和本地存储切换
支持 MD5 去重（跨进程持久化到数据库）

功能特性:
- 统一 API 接口，支持本地存储和 OSS 无缝切换
- MD5 去重，避免重复上传相同内容的文件
- 支持文件公开性设置（is_public），决定是否需要签名 URL
- 自动生成唯一文件路径，基于 MD5 哈希
- 完整的错误处理和日志记录
- 支持 Base64 数据直接上传
- 支持签名 URL 生成（仅 OSS）

配置环境变量:
- STORAGE_TYPE: 存储类型 'oss' 或 'local'，默认 'local'
- OSS_ACCESS_KEY_ID: 阿里云 AccessKey ID
- OSS_ACCESS_KEY_SECRET: 阿里云 AccessKey Secret
- OSS_BUCKET_NAME: OSS Bucket 名称
- OSS_ENDPOINT: OSS 端点
- OSS_DOMAIN: 自定义域名 (可选)
- BACKEND_URL: 后端服务 URL，用于生成本地存储的完整 URL

返回值说明:
    upload_file() 返回 (storage_key, url, is_duplicate, content_key)
    - storage_key: 存储路径，如 "wardrobe/a1b2c3d4.jpg"
    - url: 访问 URL
    - is_duplicate: 是否重复
    - content_key: 内容 Key，如 "local:a1b2c3d4..." 或 "oss:a1b2c3d4..."
"""

import os
import logging
from typing import Tuple, BinaryIO

from apps.common.services.storage.factory import StorageFactory

logger = logging.getLogger("storage")


def get_upload_record_model():
    """延迟导入 FileRecord 模型，避免循环依赖"""
    from apps.common.models import FileRecord

    return FileRecord


class StorageService:
    """
    统一存储服务
    根据配置切换 OSS 或本地存储
    使用工厂模式获取后端实例
    """

    _instance = None

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = object.__new__(cls)
        return cls._instance

    def __init__(self):
        if hasattr(self, "initialized"):
            return

        storage_type = os.getenv("STORAGE_TYPE", "local").lower()
        self._storage_type = storage_type
        self._backend = StorageFactory.get_backend(storage_type)
        self._is_oss = storage_type == "oss"

        logger.info(f"[Storage] 使用 {'OSS' if self._is_oss else '本地'} 存储")
        self.initialized = True

    @property
    def enabled(self) -> bool:
        return getattr(self._backend, "enabled", True)

    @property
    def is_oss(self) -> bool:
        return self._is_oss

    def upload_file(
        self,
        file_obj: BinaryIO,
        filename: str = "image.png",
        folder: str = "uploads",
        tenant_id: str = "",
        content_type: str = "image/png",
        file_category: str = "other",
        skip_duplicate: bool = True,
        ref_type: str = "",
        ref_id: str = "",
        source: str = "",
        client_ip: str = "",
        is_public: bool = False,
    ) -> Tuple[str, str, bool, str, str]:
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
            client_ip=client_ip,
            is_public=is_public,
        )

    def upload_from_base64(
        self,
        base64_data: str,
        folder: str = "uploads",
        tenant_id: str = "",
        content_type: str = "image/png",
        file_category: str = "other",
        skip_duplicate: bool = True,
        ref_type: str = "",
        ref_id: str = "",
        source: str = "",
        client_ip: str = "",
        is_public: bool = False,
    ) -> Tuple[str, str, bool, str]:
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
            client_ip=client_ip,
            is_public=is_public,
        )

    def get_url(self, key: str) -> str:
        return self._backend.get_url(key)

    def get_signed_url(self, key: str, expires: int = 3600) -> str:
        return self._backend.get_signed_url(key, expires)

    def get_signed_url_from_url(self, url: str, expires: int = 3600) -> str:
        return self._backend.get_signed_url_from_url(url, expires)

    def get_url_by_key(self, key: str, tenant_id: str = "", storage_type: str = None) -> str:
        FileRecord = get_upload_record_model()

        if not storage_type:
            storage_type = self._storage_type

        try:
            record = FileRecord.objects.get(storage_key=key, storage_type=storage_type)
            return self._get_url_from_record(record)
        except FileRecord.DoesNotExist:
            pass

        if tenant_id:
            try:
                record = FileRecord.objects.get(md5_hash=key, tenant_id=tenant_id, storage_type=storage_type)
                return self._get_url_from_record(record)
            except FileRecord.DoesNotExist:
                pass

        return self.get_url(key)

    def get_url_by_record(self, record) -> str:
        return self._get_url_from_record(record)

    def _get_url_from_record(self, record) -> str:
        if record.storage_type == "oss":
            backend = StorageFactory.get_backend("oss")
            return backend.get_signed_url(record.storage_key)
        else:
            base_url = os.getenv("BASE_URL", "http://127.0.0.1:8000")
            return f"{base_url.rstrip('/')}{record.access_url}"

    def delete_file(self, storage_key: str, storage_type: str = None) -> bool:
        if not storage_type:
            storage_type = self._storage_type

        backend = StorageFactory.get_backend(storage_type)
        return backend.delete_file(storage_key)

    def delete_files(self, files: list) -> dict:
        if not files:
            return {"deleted": 0, "failed": 0, "details": []}

        local_files = [f for f in files if f.get("storage_type", "local") == "local"]
        oss_files = [f for f in files if f.get("storage_type") == "oss"]

        deleted = 0
        failed = 0
        details = []

        local_backend = StorageFactory.get_backend("local")
        for f in local_files:
            storage_key = f["storage_key"]
            if local_backend.delete_file(storage_key):
                deleted += 1
                details.append({"key": storage_key, "type": "local", "success": True})
            else:
                failed += 1
                details.append({"key": storage_key, "type": "local", "success": False})

        if oss_files:
            oss_backend = StorageFactory.get_backend("oss")
            oss_keys = [f["storage_key"] for f in oss_files]
            result = oss_backend.delete_files(oss_keys)
            deleted += result["deleted"]
            failed += result["failed"]

            for i, f in enumerate(oss_files):
                success = i < result["deleted"]
                details.append({"key": f["storage_key"], "type": "oss", "success": success})

        logger.info(f"[Storage] 批量删除完成: deleted={deleted}, failed={failed}")
        return {"deleted": deleted, "failed": failed, "details": details}


storage_service = StorageService()
