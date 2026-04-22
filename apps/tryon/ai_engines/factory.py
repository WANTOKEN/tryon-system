"""
AI 引擎工厂
支持多引擎注册和动态切换
"""
import importlib
import os
import logging
from typing import Dict, Optional

from .base import BaseAIEngine, MockAIEngine
from .circuit_breaker import get_fallback_engine

logger = logging.getLogger('ai_engines')


class AIEngineConfigError(Exception):
    """AI 引擎配置错误异常"""
    pass

# 引擎注册表
_engines: Dict[str, BaseAIEngine] = {}


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
        # 使用 importlib 替代 __import__（Python 3.12 兼容）
        full_module_name = f'apps.tryon.ai_engines.{module_name}'
        module = importlib.import_module(full_module_name)
        engine_class = getattr(module, class_name)
        engine = engine_class()
        
        # 验证配置
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
        raise  # 重新抛出配置错误
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
    
    # 总是注册 mock 引擎作为后备
    _engines['mock'] = MockAIEngine()
    
    # 动态导入真实引擎（调试阶段：配置失败直接抛异常）
    engines_config = [
        ('seeddance', 'SeedDanceEngine'),  # 当前仅使用 seeddance
    ]
    
    for module_name, class_name in engines_config:
        # raise_on_error=False 允许引擎配置失败时降级到 mock
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
    if not _engines:
        _register_default_engines()
    
    # 如果引擎不存在，使用默认值
    if name not in _engines:
        logger.warning(f"[AIEngineFactory] 引擎 {name} 不存在，使用默认引擎")
        name = os.getenv('AI_ENGINE_DEFAULT', 'mock')
    
    engine = _engines.get(name)
    
    # 检查熔断器，如需降级
    if allow_fallback and hasattr(engine, 'circuit_breaker'):
        if engine.circuit_breaker.is_open():
            fallback_name = get_fallback_engine(name)
            if fallback_name and fallback_name in _engines:
                logger.warning(
                    f"[AIEngineFactory] 引擎 {name} 已熔断，"
                    f"切换到备用引擎 {fallback_name}"
                )
                engine = _engines[fallback_name]
    
    return engine or _engines['mock']


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
                'display_name': engine.display_name,
                'configured': engine.validate_config(),
                'circuit_open': False,
            }
            if hasattr(engine, 'circuit_breaker'):
                info['circuit_open'] = engine.circuit_breaker.is_open()
                info['circuit_status'] = engine.circuit_breaker.get_status()
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
        if name in _engines and hasattr(_engines[name], 'circuit_breaker'):
            _engines[name].circuit_breaker.record_success()
            logger.info(f"[AIEngineFactory] 引擎 {name} 熔断器已重置")
