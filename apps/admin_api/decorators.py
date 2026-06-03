from functools import wraps
from django.http import JsonResponse


def super_admin_required(view_func):
    """超管权限装饰器"""

    @wraps(view_func)
    def wrapper(view, request, *args, **kwargs):
        if not request.user.is_superuser:
            return JsonResponse({"message": "需要超级管理员权限"}, status=403)
        return view_func(view, request, *args, **kwargs)

    return wrapper


def merchant_data_access(view_func):
    """商家数据访问控制"""

    @wraps(view_func)
    def wrapper(view, request, *args, **kwargs):
        merchant_id = kwargs.get("pk") or request.data.get("merchant_id")

        if request.user.is_superuser:
            return view_func(view, request, *args, **kwargs)

        if str(request.user.id) != str(merchant_id):
            return JsonResponse({"message": "无权访问其他商家数据"}, status=403)

        return view_func(view, request, *args, **kwargs)

    return wrapper


def permission_required(permission_codename):
    """权限检查装饰器"""

    def decorator(view_func):
        @wraps(view_func)
        def wrapper(view, request, *args, **kwargs):
            if request.user.is_superuser:
                return view_func(view, request, *args, **kwargs)

            if not request.user.has_perm(permission_codename):
                return JsonResponse({"message": f"需要 {permission_codename} 权限"}, status=403)

            return view_func(view, request, *args, **kwargs)

        return wrapper

    return decorator
