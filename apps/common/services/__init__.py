"""
公共服务模块
"""

from typing import TYPE_CHECKING

# 类型检查时导入，供 IDE 识别
if TYPE_CHECKING:
    from .oss_service import OSSService, oss_service
    from .storage import (
        StorageBackend,
        BaseStorageService,
        StorageFactory,
        LocalStorageBackend,
        OSSStorageBackend,
    )


# 延迟导入，避免 oss2 模块未安装时报错
def __getattr__(name):
    if name == "OSSService":
        from .oss_service import OSSService

        return OSSService
    elif name == "oss_service":
        from .oss_service import oss_service

        return oss_service
    elif name == "StorageBackend":
        from .storage import StorageBackend

        return StorageBackend
    elif name == "BaseStorageService":
        from .storage import BaseStorageService

        return BaseStorageService
    elif name == "StorageFactory":
        from .storage import StorageFactory

        return StorageFactory
    elif name == "LocalStorageBackend":
        from .storage import LocalStorageBackend

        return LocalStorageBackend
    elif name == "OSSStorageBackend":
        from .storage import OSSStorageBackend

        return OSSStorageBackend
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "OSSService",
    "oss_service",
    "StorageBackend",
    "BaseStorageService",
    "StorageFactory",
    "LocalStorageBackend",
    "OSSStorageBackend",
]
