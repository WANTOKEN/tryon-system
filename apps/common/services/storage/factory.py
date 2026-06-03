import os
import threading
from typing import Type

from .base import StorageBackend


class StorageFactory:
    """存储服务工厂"""

    _backends = {}

    @classmethod
    def register_backend(cls, storage_type: str, backend_class: Type[StorageBackend]):
        """注册存储后端"""
        cls._backends[storage_type] = backend_class

    @classmethod
    def create_backend(cls, storage_type: str, **kwargs) -> StorageBackend:
        """创建存储后端实例"""
        if storage_type not in cls._backends:
            raise ValueError(f"不支持的存储类型: {storage_type}")

        return cls._backends[storage_type](**kwargs)

    @classmethod
    def get_backend(cls, storage_type: str = None) -> StorageBackend:
        """获取存储后端（线程安全）"""
        if not storage_type:
            storage_type = os.getenv("STORAGE_TYPE", "local").lower()

        thread_local = threading.local()
        cache_key = f"storage_backend_{storage_type}"

        if not hasattr(thread_local, cache_key):
            setattr(thread_local, cache_key, cls.create_backend(storage_type))

        return getattr(thread_local, cache_key)


try:
    from .local import LocalStorageBackend
    from .oss import OSSStorageBackend

    StorageFactory.register_backend("local", LocalStorageBackend)
    StorageFactory.register_backend("oss", OSSStorageBackend)
except ImportError:
    pass
