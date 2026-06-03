"""
AI 引擎工厂
支持多引擎注册和动态切换
"""

import importlib
import os
import logging
from typing import Dict, Optional

from .base import BaseAIEngine
from .mock_engine import MockAIEngine
from .circuit_breaker import get_fallback_engine

logger = logging.getLogger("ai_engines")


class AIEngineConfigError(Exception):
    """AI 引擎配置错误异常"""

    pass


_engines: Dict[str, BaseAIEngine] = {}
_mock_logged: bool = False


def _import_engine(module_name: str, class_name: str, raise_on_error: bool = False) -> Optional[BaseAIEngine]:
    """
    动态导入引擎类

    Args:
        module_name: 模块名
        class_name: 类名
        raise_on_error: 配置失败时是否抛出异常

    Returns:
        引擎实例或 None
    """
    try:
        full_module_name = f"apps.tryon.ai_engines.{module_name}"
        module = importlib.import_module(full_module_name)
        engine_class = getattr(module, class_name)
        engine = engine_class()

        if engine.validate_config():
            logger.info(f"[AIEngineFactory] 引擎 {engine.name} 配置验证通过")
            return engine
        else:
            msg = f"引擎 {engine.name} 配置不完整"
            if raise_on_error:
                raise AIEngineConfigError(msg)
            logger.warning(f"[AIEngineFactory] {msg}")
            return None
    except AIEngineConfigError:
        raise
    except ImportError as e:
        msg = f"无法导入引擎 {module_name}.{class_name}: {e}"
        if raise_on_error:
            raise AIEngineConfigError(msg)
        logger.warning(f"[AIEngineFactory] {msg}")
        return None
    except Exception as e:
        msg = f"初始化引擎 {module_name}.{class_name} 失败: {e}"
        if raise_on_error:
            raise AIEngineConfigError(msg)
        logger.error(f"[AIEngineFactory] {msg}")
        return None


def _register_default_engines():
    """注册默认引擎"""
    global _engines

    _engines["mock"] = MockAIEngine()

    use_mock = os.getenv("AI_USE_MOCK", "false").lower() == "true"

    if use_mock:
        logger.info("[AIEngineFactory] AI_USE_MOCK=true，跳过真实引擎注册")
        return

    engines_config = [
        ("seeddance", "SeedDanceEngine"),
    ]

    for module_name, class_name in engines_config:
        engine = _import_engine(module_name, class_name, raise_on_error=False)
        if engine:
            _engines[module_name] = engine


def get_engine(name: str, allow_fallback: bool = True) -> BaseAIEngine:
    """
    获取指定引擎实例

    Args:
        name: 引擎名称
        allow_fallback: 是否允许降级到备用引擎

    Returns:
        引擎实例
    """
    global _mock_logged

    if not _engines:
        _register_default_engines()

    use_mock = os.getenv("AI_USE_MOCK", "false").lower() == "true"

    if use_mock:
        if not _mock_logged:
            logger.info("[AIEngineFactory] AI_USE_MOCK=true，强制使用 Mock 引擎")
            _mock_logged = True
        return _engines["mock"]

    if name not in _engines:
        logger.warning(f"[AIEngineFactory] 引擎 {name} 不存在，使用默认引擎")
        name = os.getenv("AI_ENGINE_DEFAULT", "mock")

    engine = _engines.get(name)

    if allow_fallback and hasattr(engine, "circuit_breaker"):
        if engine.circuit_breaker.is_open():
            fallback_name = get_fallback_engine(name)
            if fallback_name and fallback_name in _engines:
                logger.warning(f"[AIEngineFactory] 引擎 {name} 已熔断，" f"切换到备用引擎 {fallback_name}")
                engine = _engines[fallback_name]

    return engine or _engines["mock"]


class AIEngineFactory:
    """AI 引擎工厂类"""

    @staticmethod
    def get(name: str, allow_fallback: bool = True) -> BaseAIEngine:
        """获取引擎实例"""
        return get_engine(name, allow_fallback)

    @staticmethod
    def list_engines() -> Dict[str, str]:
        """
        列出所有可用引擎

        Returns:
            {引擎名称: 显示名称}
        """
        if not _engines:
            _register_default_engines()
        return {name: engine.display_name for name, engine in _engines.items()}

    @staticmethod
    def list_available_engines() -> Dict[str, dict]:
        """
        列出所有引擎的详细状态

        Returns:
            {引擎名称: {display_name, configured, circuit_open}}
        """
        if not _engines:
            _register_default_engines()

        result = {}
        for name, engine in _engines.items():
            info = {
                "display_name": engine.display_name,
                "configured": engine.validate_config(),
                "circuit_open": False,
            }
            if hasattr(engine, "circuit_breaker"):
                info["circuit_open"] = engine.circuit_breaker.is_open()
                info["circuit_status"] = engine.circuit_breaker.get_status()
            result[name] = info
        return result

    @staticmethod
    def register(name: str, engine: BaseAIEngine):
        """
        注册自定义引擎

        Args:
            name: 引擎名称
            engine: 引擎实例
        """
        _engines[name] = engine
        logger.info(f"[AIEngineFactory] 引擎 {name} 已注册")

    @staticmethod
    def reset_circuit_breaker(name: str):
        """
        重置指定引擎的熔断器

        Args:
            name: 引擎名称
        """
        if name in _engines and hasattr(_engines[name], "circuit_breaker"):
            _engines[name].circuit_breaker.record_success()
            logger.info(f"[AIEngineFactory] 引擎 {name} 熔断器已重置")
