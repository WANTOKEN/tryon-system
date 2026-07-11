"""
存储层入口

统一使用本地文件系统存储后端，对外暴露统一 upload / get_access_url / delete / read。
文件写入 storage_local_dir，通过 /static/uploads 暴露；资源与 AI 结果均存于服务器。
"""
from app.storage.base import StorageBackend
from app.storage.local import LocalStorageBackend

storage: StorageBackend = LocalStorageBackend()

__all__ = ["storage", "StorageBackend"]
