"""
请求日志中间件
"""
import time
import logging

logger = logging.getLogger('django.request')


class RequestLogMiddleware:
    """请求日志中间件"""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # 记录开始时间
        start_time = time.time()

        # 获取请求信息
        request_id = request.headers.get('X-Request-ID', '-')
        method = request.method
        path = request.path
        remote_addr = self._get_client_ip(request)

        # 处理请求
        response = self.get_response(request)

        # 计算耗时
        duration = time.time() - start_time

        # 记录日志 - 使用 extra 参数传递结构化数据
        query_string = request.META.get('QUERY_STRING', '')
        log_extra = {
            'request_id': request_id,
            'method': method,
            'path': path,
            'query': query_string if query_string else None,
            'status': response.status_code,
            'duration_ms': round(duration * 1000, 2),
            'ip': remote_addr,
            'user': str(getattr(request, 'user', '-')),
        }

        # 简单的日志消息
        log_message = f"{method} {path} {response.status_code} ({log_extra['duration_ms']}ms)"

        # 根据状态码选择日志级别
        if response.status_code >= 500:
            logger.error(log_message, extra={'request_data': log_extra})
        elif response.status_code >= 400:
            logger.warning(log_message, extra={'request_data': log_extra})
        else:
            logger.info(log_message, extra={'request_data': log_extra})

        # 添加请求ID到响应头
        response['X-Request-ID'] = request_id

        return response

    def _get_client_ip(self, request):
        """获取客户端真实IP"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', '-')
