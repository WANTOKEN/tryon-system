"""
URL Configuration
AI 虚拟试衣系统
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

# 文件接口单独配置（更简洁的路径）
from apps.common.views_file import (
    FileAccessView,
    FileInfoView,
    FileByKeyView,
    FileListView,
    FileSecureUrlView,
    FileBulkSecureUrlView,
)
from apps.common.views_upload import UploadView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include('apps.api_root')),
    path('api/admin/', include('apps.admin_api.urls')),  # 管理后台 API
    # 文件接口（简洁路径）
    # 使用 str 类型以支持带存储类型后缀的 file_id 格式（如 xxx-01, xxx-02）
    path('api/v1/file/<str:file_id>/', FileAccessView.as_view(), name="file-access"),
    path('api/v1/file/<str:file_id>/info/', FileInfoView.as_view(), name="file-info"),
    path('api/v1/file/by-key/<path:storage_key>/', FileByKeyView.as_view(), name="file-by-key"),
    path('api/v1/file/list/', FileListView.as_view(), name="file-list"),
    path('api/v1/file/secure-url/', FileSecureUrlView.as_view(), name="file-secure-url"),
    path('api/v1/file/bulk-secure-url/', FileBulkSecureUrlView.as_view(), name="file-bulk-secure-url"),
    path('api/v1/file/upload/', UploadView.as_view(), name="upload"),
]

# 开发环境媒体文件服务
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
