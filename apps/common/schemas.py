"""
标准化 API 响应模型

使用 Pydantic 定义统一的响应格式，确保前后端数据结构一致性。
"""

from enum import Enum
from typing import Generic, Optional, TypeVar, List
from pydantic import BaseModel, Field

T = TypeVar("T")


class ErrorCode(str, Enum):
    """错误码枚举"""

    SUCCESS = "SUCCESS"
    AUTH_REQUIRED = "AUTH_REQUIRED"
    AUTH_TOKEN_EXPIRED = "AUTH_TOKEN_EXPIRED"
    AUTH_ERROR = "AUTH_ERROR"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    NOT_FOUND = "NOT_FOUND"
    FORBIDDEN = "FORBIDDEN"
    QUOTA_EXCEEDED = "QUOTA_EXCEEDED"
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"
    SYSTEM_ERROR = "SYSTEM_ERROR"
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"
    STORAGE_ERROR = "STORAGE_ERROR"
    AI_SERVICE_ERROR = "AI_SERVICE_ERROR"


class ApiResponse(BaseModel, Generic[T]):
    """
    标准化 API 响应模型

    所有 API 响应都应遵循此格式，确保前后端数据结构一致。

    Attributes:
        success: 请求是否成功
        data: 响应数据
        message: 提示信息（可选）
        error_code: 错误码（失败时必填）
        status_code: HTTP 状态码
    """

    success: bool = Field(..., description="请求是否成功")
    data: Optional[T] = Field(None, description="响应数据")
    message: Optional[str] = Field(None, description="提示信息")
    error_code: Optional[str] = Field(None, description="错误码")
    status_code: int = Field(..., description="HTTP 状态码")

    class Config:
        from_attributes = True
        json_schema_extra = {
            "examples": [
                {
                    "success": True,
                    "data": {"user_id": 1, "username": "test"},
                    "message": "操作成功",
                    "error_code": None,
                    "status_code": 200,
                },
                {
                    "success": False,
                    "data": None,
                    "message": "参数校验失败",
                    "error_code": "VALIDATION_ERROR",
                    "status_code": 400,
                },
            ]
        }


class PaginatedResponse(BaseModel, Generic[T]):
    """
    标准化分页响应模型

    Attributes:
        success: 请求是否成功
        data: 分页数据
        message: 提示信息（可选）
        error_code: 错误码（失败时必填）
        status_code: HTTP 状态码
    """

    success: bool = Field(..., description="请求是否成功")
    data: Optional["PaginatedData[T]"] = Field(None, description="分页数据")
    message: Optional[str] = Field(None, description="提示信息")
    error_code: Optional[str] = Field(None, description="错误码")
    status_code: int = Field(..., description="HTTP 状态码")

    class Config:
        from_attributes = True


class PaginatedData(BaseModel, Generic[T]):
    """分页数据结构"""

    items: List[T] = Field(..., description="数据列表")
    total: int = Field(..., description="总记录数")
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页大小")
    total_pages: int = Field(..., description="总页数")


class ErrorDetail(BaseModel):
    """错误详情模型"""

    field: Optional[str] = Field(None, description="字段名")
    message: str = Field(..., description="错误信息")
    code: Optional[str] = Field(None, description="错误代码")


class ValidationErrorResponse(ApiResponse):
    """参数校验错误响应"""

    error_code: str = "VALIDATION_ERROR"
    data: Optional[List[ErrorDetail]] = Field(None, description="错误详情列表")


# 更新引用
PaginatedResponse.update_forward_refs()
