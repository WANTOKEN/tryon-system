"""
统一响应格式工具

使用标准化的 Pydantic 模型确保响应格式一致性。
"""

from typing import Any, Optional, Dict, List
from rest_framework.response import Response
from rest_framework import status

from apps.common.schemas import (
    ApiResponse as ApiResponseSchema,
    PaginatedResponse as PaginatedResponseSchema,
    PaginatedData,
    ErrorCode,
    ErrorDetail,
)


class StandardApiResponse:
    """
    统一 API 响应格式工具

    使用标准化的响应模型，确保前后端数据结构一致性。
    """

    @staticmethod
    def success(data: Any = None, message: Optional[str] = None, status_code: int = status.HTTP_200_OK) -> Response:
        """
        成功响应

        Args:
            data: 响应数据
            message: 提示信息
            status_code: HTTP 状态码

        Returns:
            Response: 标准化的成功响应
        """
        response_model = ApiResponseSchema(
            success=True, data=data, message=message, error_code=None, status_code=status_code
        )
        return Response(response_model.model_dump(exclude_none=True), status=status_code)

    @staticmethod
    def error(
        message: str, error_code: Optional[str] = None, data: Any = None, status_code: int = status.HTTP_400_BAD_REQUEST
    ) -> Response:
        """
        错误响应

        Args:
            message: 错误消息
            error_code: 错误码
            data: 附加数据（如校验错误详情）
            status_code: HTTP 状态码

        Returns:
            Response: 标准化的错误响应
        """
        response_model = ApiResponseSchema(
            success=False,
            data=data,
            message=message,
            error_code=error_code or ErrorCode.SYSTEM_ERROR.value,
            status_code=status_code,
        )
        return Response(response_model.model_dump(exclude_none=True), status=status_code)

    @staticmethod
    def paginated(
        items: List[Any], total: int, page: int, page_size: int, total_pages: int, message: Optional[str] = None
    ) -> Response:
        """
        分页响应

        Args:
            items: 数据列表
            total: 总记录数
            page: 当前页码
            page_size: 每页大小
            total_pages: 总页数
            message: 提示信息

        Returns:
            Response: 标准化的分页响应
        """
        paginated_data = PaginatedData(
            items=items, total=total, page=page, page_size=page_size, total_pages=total_pages
        )

        response_model = PaginatedResponseSchema(
            success=True, data=paginated_data, message=message, error_code=None, status_code=status.HTTP_200_OK
        )
        return Response(response_model.model_dump(exclude_none=True), status=status.HTTP_200_OK)

    @classmethod
    def unauthorized(cls, message: str = "请先登录", error_code: str = "AUTH_REQUIRED"):
        """未授权响应"""
        return cls.error(message, error_code, status_code=status.HTTP_401_UNAUTHORIZED)

    @classmethod
    def forbidden(cls, message: str = "无权限访问", error_code: str = "FORBIDDEN"):
        """禁止访问响应"""
        return cls.error(message, error_code, status_code=status.HTTP_403_FORBIDDEN)

    @classmethod
    def not_found(cls, message: str = "请求的资源不存在", error_code: str = "NOT_FOUND"):
        """资源不存在响应"""
        return cls.error(message, error_code, status_code=status.HTTP_404_NOT_FOUND)

    @classmethod
    def validation_error(cls, message: str = "参数校验失败", details: Optional[List[Dict]] = None):
        """
        参数校验失败响应

        Args:
            message: 错误消息
            details: 错误详情列表

        Returns:
            Response: 标准化的校验错误响应
        """
        error_details = None
        if details:
            error_details = []
            for field, errors in details.items():
                if isinstance(errors, list):
                    for error in errors:
                        error_details.append(
                            ErrorDetail(field=field, message=str(error), code=getattr(error, "code", None)).dict(
                                exclude_none=True
                            )
                        )
                else:
                    error_details.append(ErrorDetail(field=field, message=str(errors)).dict(exclude_none=True))

        return cls.error(message, "VALIDATION_ERROR", data=error_details, status_code=status.HTTP_400_BAD_REQUEST)

    @classmethod
    def rate_limited(cls, message: str = "请求过于频繁，请稍后再试"):
        """频率限制响应"""
        return cls.error(message, "RATE_LIMIT_EXCEEDED", status_code=status.HTTP_429_TOO_MANY_REQUESTS)

    @classmethod
    def service_unavailable(cls, message: str = "服务暂时不可用，请稍后再试"):
        """服务不可用响应"""
        return cls.error(message, "SERVICE_UNAVAILABLE", status_code=status.HTTP_503_SERVICE_UNAVAILABLE)

    @classmethod
    def system_error(cls, message: str = "系统繁忙，请稍后再试"):
        """系统错误响应"""
        return cls.error(message, "SYSTEM_ERROR", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


# 保持向后兼容的别名
ApiResponse = StandardApiResponse
