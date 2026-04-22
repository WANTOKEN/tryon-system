"""
链路追踪中间件

自动为每个请求生成 trace_id，并在响应头中返回
"""
import logging
from apps.common.utils.trace_context import (
    TraceContext,
    get_trace_id,
)

logger = logging.getLogger('trace')


class TraceMiddleware:
    """
    链路追踪中间件
    
    功能:
    1. 自动为每个请求生成 trace_id
    2. 支持从请求头获取上游 trace_id（用于分布式追踪）
    3. 在响应头中返回 trace_id（便于客户端追踪）
    
    配置:
    # settings.py
    MIDDLEWARE = [
        ...
        'apps.common.middleware.TraceMiddleware',
        ...
    ]
    """
    
    # 请求头名称
    TRACE_HEADER = 'X-Trace-Id'
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # 从请求头获取或生成 trace_id
        trace_id = request.headers.get(self.TRACE_HEADER)
        
        # 使用上下文管理器设置 trace_id
        with TraceContext(trace_id) as tid:
            # 记录请求开始
            logger.info(
                f"请求开始: {request.method} {request.path} "
                f"user={getattr(request, 'user', 'anonymous')}"
            )
            
            # 处理请求
            response = self.get_response(request)
            
            # 在响应头中返回 trace_id
            response[self.TRACE_HEADER] = tid
            
            # 记录请求结束
            logger.info(
                f"请求结束: {request.method} {request.path} "
                f"status={response.status_code}"
            )
        
        return response
