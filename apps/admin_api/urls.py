from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

app_name = "admin_api"

urlpatterns = [
    # 认证相关
    path("auth/public-key/", views.get_public_key, name="public-key"),
    path("auth/login/", views.admin_login, name="admin-login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    # 系统信息
    path("system/info/", views.system_info, name="system-info"),
    path("system/stats/", views.system_stats, name="system-stats"),
    # 资源管理
    path("", include(views.router.urls)),
]
