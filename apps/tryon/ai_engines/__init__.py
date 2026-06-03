# AI 试穿引擎模块

from .base import BaseAIEngine, MockAIEngine
from .factory import AIEngineFactory, get_engine
from .circuit_breaker import CircuitBreaker, get_fallback_engine

__all__ = [
    # 基类
    "BaseAIEngine",
    "MockAIEngine",
    # 工厂
    "AIEngineFactory",
    "get_engine",
    # 熔断器
    "CircuitBreaker",
    "get_fallback_engine",
]


# 延迟导入真实引擎（避免循环导入）
def get_seeddance_engine():
    """获取 SeedDance 引擎类"""
    from .seeddance import SeedDanceEngine

    return SeedDanceEngine
