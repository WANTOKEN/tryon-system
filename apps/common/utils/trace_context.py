"""
链路追踪上下文

使用 contextvars 实现跨层级的 trace_id 传递，无需显式传参
"""
import uuid
import time
from contextvars import ContextVar
from typing import Optional

# 上下文变量：存储当前请求的 trace_id
_trace_id: ContextVar[Optional[str]] = ContextVar('trace_id', default=None)


def get_trace_id() -> str:
    """
    获取当前上下文的 trace_id
    
    如果不存在则自动生成一个
    """
    trace = _trace_id.get()
    if not trace:
        trace = generate_trace_id()
        _trace_id.set(trace)
    return trace


def set_trace_id(trace_id: str) -> None:
    """设置当前上下文的 trace_id"""
    _trace_id.set(trace_id)


def generate_trace_id() -> str:
    """
    生成 trace_id
    
    格式: trace_{uuid12位}_{时间戳}
    示例: trace_a1b2c3d4e5f6_1745311234
    """
    return f"trace_{uuid.uuid4().hex[:12]}_{int(time.time())}"


def clear_trace_id() -> None:
    """清除当前上下文的 trace_id"""
    _trace_id.set(None)


class TraceContext:
    """
    追踪上下文管理器
    
    用法:
        with TraceContext():
            # 自动生成 trace_id
            logger.info(f"trace_id={get_trace_id()}")
        
        with TraceContext("custom_trace_id"):
            # 使用指定的 trace_id
            logger.info(f"trace_id={get_trace_id()}")
    """
    
    def __init__(self, trace_id: Optional[str] = None):
        self.trace_id = trace_id or generate_trace_id()
        self._token = None
    
    def __enter__(self) -> str:
        self._token = _trace_id.set(self.trace_id)
        return self.trace_id
    
    def __exit__(self, *args):
        if self._token:
            _trace_id.reset(self._token)


def trace_log(logger, level: str, message: str, **kwargs):
    """
    带追踪 ID 的日志记录
    
    用法:
        trace_log(logger, 'info', '处理请求')
        # 输出: [trace_xxx] 处理请求
    """
    trace_id = get_trace_id()
    full_message = f"[{trace_id}] {message}"
    
    log_func = getattr(logger, level)
    log_func(full_message, **kwargs)
