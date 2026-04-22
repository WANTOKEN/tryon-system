"""
统一响应格式工具
"""
from typing import Any, Optional, Dict, List
from rest_framework.response import Response
from rest_framework import status


class ApiResponse:
    """统一 API 响应格式"""

    @staticmethod
    def success(data: Any = None, message: Optional[str] = None, status_code: int = status.HTTP_200_OK) -> Response:
        """成功响应"""
        response_data = {
            'success': True,
            'data': data,
        }
        if message:
            response_data['message'] = message
        return Response(response_data, status=status_code)

    @staticmethod
    def error(
        message: str,
        error_code: Optional[str] = None,
        details: Optional[Dict[str, List[str]]] = None,
        status_code: int = status.HTTP_400_BAD_REQUEST
    ) -> Response:
        """错误响应"""
        response_data = {
            'success': False,
            'error_code': error_code or 'UNKNOWN_ERROR',
            'message': message,
        }
        if details:
            response_data['details'] = details
        return Response(response_data, status=status_code)

    @staticmethod
    def paginated(
        items: List[Any],
        total: int,
        page: int,
        page_size: int,
        total_pages: int
    ) -> Response:
        """分页响应"""
        return Response({
            'success': True,
            'data': {
                'items': items,
                'total': total,
                'page': page,
                'page_size': page_size,
                'total_pages': total_pages,
            }
        }, status=status.HTTP_200_OK)

    # 常用错误快捷方法
    @classmethod
    def unauthorized(cls, message: str = '未授权', error_code: str = 'AUTH_REQUIRED'):
        return cls.error(message, error_code, status_code=status.HTTP_401_UNAUTHORIZED)

    @classmethod
    def forbidden(cls, message: str = '禁止访问', error_code: str = 'FORBIDDEN'):
        return cls.error(message, error_code, status_code=status.HTTP_403_FORBIDDEN)

    @classmethod
    def not_found(cls, message: str = '资源不存在', error_code: str = 'NOT_FOUND'):
        return cls.error(message, error_code, status_code=status.HTTP_404_NOT_FOUND)

    @classmethod
    def validation_error(cls, message: str = '参数校验失败', details: Optional[Dict] = None):
        return cls.error(message, 'VALIDATION_ERROR', details, status_code=status.HTTP_400_BAD_REQUEST)

    @classmethod
    def rate_limited(cls, message: str = '请求过于频繁'):
        return cls.error(message, 'RATE_LIMIT_EXCEEDED', status_code=status.HTTP_429_TOO_MANY_REQUESTS)
