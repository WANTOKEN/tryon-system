"""
公共服务模块
"""
from typing import TYPE_CHECKING

# 类型检查时导入，供 IDE 识别
if TYPE_CHECKING:
    from .oss_service import OSSService, oss_service


# 延迟导入，避免 oss2 模块未安装时报错
def __getattr__(name):
    if name == 'OSSService':
        from .oss_service import OSSService
        return OSSService
    elif name == 'oss_service':
        from .oss_service import oss_service
        return oss_service
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    'OSSService',
    'oss_service',
]
