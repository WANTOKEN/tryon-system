"""
自定义异常

异常分类:
1. BusinessException - 业务异常，可以展示给用户
2. SystemException - 系统异常，统一返回"系统繁忙"，不暴露内部信息
"""

import logging
from rest_framework.views import exception_handler
from rest_framework import status
from apps.common.utils.response import ApiResponse

logger = logging.getLogger("exception")


# ==================== 业务异常 (可展示给用户) ====================


class BusinessException(Exception):
    """
    业务异常基类
    - 消息可以展示给用户
    - 用于业务逻辑校验失败等场景
    """

    def __init__(
        self, message: str, error_code: str = "BUSINESS_ERROR", status_code: int = status.HTTP_400_BAD_REQUEST
    ):
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        super().__init__(message)


class AuthenticationException(BusinessException):
    """认证失败"""

    def __init__(self, message: str = "认证失败", error_code: str = "AUTH_ERROR"):
        super().__init__(message, error_code, status.HTTP_401_UNAUTHORIZED)


class TokenExpiredException(AuthenticationException):
    """Token 过期"""

    def __init__(self):
        super().__init__("登录已过期，请重新登录", "AUTH_TOKEN_EXPIRED")


class QuotaExceededException(BusinessException):
    """配额用尽"""

    def __init__(self):
        super().__init__("试穿配额已用完，请联系商家", "QUOTA_EXCEEDED", status.HTTP_429_TOO_MANY_REQUESTS)


class RateLimitException(BusinessException):
    """频率限制"""

    def __init__(self, message: str = "请求过于频繁，请稍后再试"):
        super().__init__(message, "RATE_LIMIT_EXCEEDED", status.HTTP_429_TOO_MANY_REQUESTS)


class ResourceNotFoundException(BusinessException):
    """资源不存在"""

    def __init__(self, resource: str = "资源"):
        super().__init__(f"{resource}不存在", "NOT_FOUND", status.HTTP_404_NOT_FOUND)


class ValidationException(BusinessException):
    """参数校验失败"""

    def __init__(self, message: str = "参数校验失败", details: dict = None):
        super().__init__(message, "VALIDATION_ERROR", status.HTTP_400_BAD_REQUEST)
        self.details = details


# ==================== 系统异常 (不暴露给用户) ====================


class SystemException(Exception):
    """
    系统异常基类
    - 消息不展示给用户，统一返回"系统繁忙"
    - 用于服务不可用、配置错误等场景
    """

    # 对外展示的默认消息
    PUBLIC_MESSAGE = "系统繁忙，请稍后再试"
    PUBLIC_ERROR_CODE = "SYSTEM_ERROR"

    def __init__(
        self,
        message: str = "",
        error_code: str = "SYSTEM_ERROR",
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
    ):
        self.internal_message = message  # 内部日志用
        self.error_code = error_code
        self.status_code = status_code
        super().__init__(message)


class AIEngineConfigException(SystemException):
    """AI 引擎配置错误"""

    PUBLIC_MESSAGE = "服务暂时不可用，请联系管理员"
    PUBLIC_ERROR_CODE = "SERVICE_UNAVAILABLE"

    def __init__(self, message: str = "AI 引擎配置错误"):
        super().__init__(message, "AI_CONFIG_ERROR", status.HTTP_503_SERVICE_UNAVAILABLE)


class AIEngineException(SystemException):
    """AI 引擎调用失败"""

    PUBLIC_MESSAGE = "AI 服务暂时不可用，请稍后再试"
    PUBLIC_ERROR_CODE = "AI_SERVICE_ERROR"

    def __init__(self, message: str = "AI 引擎调用失败"):
        super().__init__(message, "AI_ENGINE_ERROR", status.HTTP_502_BAD_GATEWAY)


class OssException(SystemException):
    """OSS 存储异常"""

    PUBLIC_MESSAGE = "文件服务暂时不可用，请稍后再试"
    PUBLIC_ERROR_CODE = "STORAGE_ERROR"

    def __init__(self, message: str = "OSS 服务异常"):
        super().__init__(message, "OSS_ERROR", status.HTTP_500_INTERNAL_SERVER_ERROR)


class StorageException(SystemException):
    """存储服务异常（本地存储或 OSS）"""

    PUBLIC_MESSAGE = "文件服务暂时不可用，请稍后再试"
    PUBLIC_ERROR_CODE = "STORAGE_ERROR"

    def __init__(self, message: str = "存储服务异常"):
        super().__init__(message, "STORAGE_ERROR", status.HTTP_500_INTERNAL_SERVER_ERROR)


class DatabaseException(SystemException):
    """数据库异常"""

    PUBLIC_MESSAGE = "数据服务暂时不可用，请稍后再试"

    def __init__(self, message: str = "数据库异常"):
        super().__init__(message, "DATABASE_ERROR", status.HTTP_500_INTERNAL_SERVER_ERROR)


# ==================== 异常处理器 ====================


def custom_exception_handler(exc, context):
    """
    自定义异常处理器

    - BusinessException: 显示具体错误消息给用户
    - SystemException: 显示通用消息，记录详细日志
    - 未处理异常: 显示通用消息，记录详细日志
    """
    # 先调用 REST framework 默认异常处理器
    response = exception_handler(exc, context)

    # 获取请求上下文
    request = context.get("request") if context else None
    request_id = getattr(request, "request_id", "unknown") if request else "unknown"

    # 1. 处理业务异常 (显示给用户)
    if isinstance(exc, BusinessException):
        return ApiResponse.error(message=exc.message, error_code=exc.error_code, status_code=exc.status_code)

    # 2. 处理系统异常 (不显示细节)
    if isinstance(exc, SystemException):
        # 记录内部错误日志
        logger.error(
            f"[系统异常] {exc.__class__.__name__}: {exc.internal_message}",
            extra={"request_id": request_id, "error_code": exc.error_code},
        )
        # 返回通用消息给用户
        return ApiResponse.error(
            message=exc.PUBLIC_MESSAGE, error_code=exc.PUBLIC_ERROR_CODE, status_code=exc.status_code
        )

    # 3. 处理 AI 引擎配置错误 (来自 factory.py)
    try:
        from apps.tryon.ai_engines.factory import AIEngineConfigError

        if isinstance(exc, AIEngineConfigError):
            logger.error(f"[AI配置异常] {exc}", extra={"request_id": request_id})
            return ApiResponse.error(
                message="服务暂时不可用，请联系管理员",
                error_code="SERVICE_UNAVAILABLE",
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
    except ImportError:
        pass

    # 4. 处理 DRF 标准异常
    if response is not None:
        if response.status_code == 401:
            return ApiResponse.unauthorized(message="请先登录", error_code="AUTH_REQUIRED")
        elif response.status_code == 403:
            return ApiResponse.forbidden(message="无权限访问", error_code="FORBIDDEN")
        elif response.status_code == 404:
            return ApiResponse.not_found(message="请求的资源不存在", error_code="NOT_FOUND")
        elif response.status_code == 400:
            # 参数校验失败，可以显示具体信息
            return ApiResponse.validation_error(
                message=_extract_validation_error(response.data),
                details=response.data if isinstance(response.data, dict) else None,
            )
        elif response.status_code == 429:
            return ApiResponse.rate_limited(message="请求过于频繁，请稍后再试")

        # 其他 DRF 异常，不暴露细节
        if response.status_code >= 500:
            logger.error(f"[DRF异常] {response.status_code}: {response.data}", extra={"request_id": request_id})
            return ApiResponse.error(
                message="系统繁忙，请稍后再试",
                error_code="SYSTEM_ERROR",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return response

    # 5. 未处理的异常 - 记录日志，返回通用消息
    logger.exception(f"[未处理异常] {exc.__class__.__name__}: {exc}", extra={"request_id": request_id})
    return ApiResponse.error(
        message="系统繁忙，请稍后再试", error_code="SYSTEM_ERROR", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
    )


def _extract_validation_error(data):
    """提取参数校验错误信息"""
    if isinstance(data, str):
        return data
    if isinstance(data, dict):
        # 提取第一个错误
        if "detail" in data:
            return str(data["detail"])
        if "non_field_errors" in data:
            errors = data["non_field_errors"]
            return errors[0] if isinstance(errors, list) else str(errors)
        # 字段错误
        for field, errors in data.items():
            if isinstance(errors, list) and errors:
                return f"{field}: {errors[0]}"
            if isinstance(errors, str):
                return f"{field}: {errors}"
    return "参数校验失败"
