"""
URL 校验中间件

自动校验请求中的URL参数，在非mock模式下触发。

配置说明：
1. 在 settings.py 的 MIDDLEWARE 中添加此中间件
2. 配置 URL_VALIDATION_ENABLED 控制是否启用
3. 配置 URL_VALIDATION_MOCK_MODE 控制是否为mock模式
4. 配置 URL_VALIDATION_FIELDS 指定需要校验的字段名列表
5. 配置 URL_VALIDATION_EXCLUDE_PATHS 指定排除校验的路径

配置示例：
URL_VALIDATION_ENABLED = True
URL_VALIDATION_MOCK_MODE = False  # 生产环境设置为False
URL_VALIDATION_FIELDS = ['url', 'image_url', 'callback_url', 'redirect_url']
URL_VALIDATION_EXCLUDE_PATHS = ['/api/v1/health/', '/admin/']
"""

import re
from django.http import HttpRequest, JsonResponse
from django.conf import settings

from apps.common.utils.url_validator import validate_url, URLValidationError


class URLValidationMiddleware:
    """
    URL 合法性校验中间件

    功能：
    1. 在非mock模式下自动校验请求中的URL参数
    2. 支持配置需要校验的字段名
    3. 支持配置排除路径
    4. 返回标准化的错误响应
    """

    def __init__(self, get_response):
        self.get_response = get_response

        # 从配置读取参数
        self.enabled = getattr(settings, "URL_VALIDATION_ENABLED", True)
        self.mock_mode = getattr(settings, "URL_VALIDATION_MOCK_MODE", False)
        self.validation_fields = getattr(
            settings, "URL_VALIDATION_FIELDS", ["url", "image_url", "callback_url", "redirect_url"]
        )
        self.exclude_paths = getattr(settings, "URL_VALIDATION_EXCLUDE_PATHS", ["/api/v1/health/"])

        # 编译排除路径正则
        self.exclude_patterns = [re.compile(path.replace("*", ".*")) for path in self.exclude_paths]

    def __call__(self, request: HttpRequest):
        # 如果未启用或处于mock模式，直接放行
        if not self.enabled or self.mock_mode:
            return self.get_response(request)

        # 检查是否需要排除
        if self._is_excluded(request.path):
            return self.get_response(request)

        # 校验URL参数
        validation_error = self._validate_request_urls(request)
        if validation_error:
            return self._build_error_response(validation_error)

        return self.get_response(request)

    def _is_excluded(self, path: str) -> bool:
        """
        检查路径是否在排除列表中

        Args:
            path: 请求路径

        Returns:
            是否排除
        """
        for pattern in self.exclude_patterns:
            if pattern.match(path):
                return True
        return False

    def _validate_request_urls(self, request: HttpRequest) -> Optional[URLValidationError]:
        """
        校验请求中的URL参数

        Args:
            request: HTTP请求对象

        Returns:
            URLValidationError或None
        """
        # 获取所有可能包含URL的参数
        url_params = self._extract_url_params(request)

        # 逐个校验
        for field_name, url_value in url_params.items():
            if url_value:
                try:
                    validate_url(url_value, field_name)
                except URLValidationError as e:
                    return e

        return None

    def _extract_url_params(self, request: HttpRequest) -> dict:
        """
        从请求中提取需要校验的URL参数

        Args:
            request: HTTP请求对象

        Returns:
            URL参数字典 {field_name: url_value}
        """
        url_params = {}

        # 从GET参数中提取
        for field in self.validation_fields:
            if field in request.GET:
                url_params[field] = request.GET[field]

        # 从POST数据中提取（JSON和表单）
        if request.method in ("POST", "PUT", "PATCH"):
            try:
                # 尝试解析JSON数据
                if request.content_type and "application/json" in request.content_type:
                    try:
                        body_data = request.json()
                        for field in self.validation_fields:
                            if field in body_data:
                                url_params[field] = body_data[field]
                    except AttributeError:
                        # 兼容旧版本Django
                        pass
            except Exception:
                pass

            # 从表单数据中提取
            for field in self.validation_fields:
                if field in request.POST:
                    url_params[field] = request.POST[field]

        return url_params

    def _build_error_response(self, error: URLValidationError) -> JsonResponse:
        """
        构建标准化的错误响应

        Args:
            error: URLValidationError实例

        Returns:
            JsonResponse: 标准化错误响应
        """
        response_data = {
            "success": False,
            "error_code": error.error_code,
            "message": error.message,
            "status_code": 400,
        }

        if error.suggestion:
            response_data["suggestion"] = error.suggestion

        if error.field:
            response_data["field"] = error.field

        return JsonResponse(response_data, status=400)


# 装饰器：用于跳过URL校验
def skip_url_validation(view_func):
    """
    装饰器：跳过URL校验

    用法：
    @skip_url_validation
    def my_view(request):
        pass
    """

    def wrapped_view(request, *args, **kwargs):
        # 在请求上标记跳过校验
        request._skip_url_validation = True
        return view_func(request, *args, **kwargs)

    return wrapped_view


# 装饰器：强制URL校验（即使在mock模式下）
def force_url_validation(view_func):
    """
    装饰器：强制URL校验

    用法：
    @force_url_validation
    def my_view(request):
        pass
    """

    def wrapped_view(request, *args, **kwargs):
        # 在请求上标记强制校验
        request._force_url_validation = True
        return view_func(request, *args, **kwargs)

    return wrapped_view
