"""
存储服务模块

提供统一的存储抽象接口和多种后端实现
"""

from .base import StorageBackend, BaseStorageService
from .factory import StorageFactory
from .local import LocalStorageBackend
from .oss import OSSStorageBackend

__all__ = [
    "StorageBackend",
    "BaseStorageService",
    "StorageFactory",
    "LocalStorageBackend",
    "OSSStorageBackend",
]
