"""
Common app URL configuration
"""

from django.urls import path
from .views import ModelPhotosView, SignedUrlView
from .views_file import (
    FileAccessView,
    FileInfoView,
    FileByKeyView,
    FileListView,
    FileSecureUrlView,
    FileBulkSecureUrlView,
)
from .views_upload import UploadView

urlpatterns = [
    path("model-photos/", ModelPhotosView.as_view(), name="model-photos"),
    path("signed-url/", SignedUrlView.as_view(), name="signed-url"),
    path("upload/", UploadView.as_view(), name="upload"),
    path("file/<uuid:file_id>/", FileAccessView.as_view(), name="file-access"),
    path("file/<uuid:file_id>/info/", FileInfoView.as_view(), name="file-info"),
    path("file/by-key/<path:storage_key>/", FileByKeyView.as_view(), name="file-by-key"),
    path("file/list/", FileListView.as_view(), name="file-list"),
    path("file/secure-url/", FileSecureUrlView.as_view(), name="file-secure-url"),
    path("file/bulk-secure-url/", FileBulkSecureUrlView.as_view(), name="file-bulk-secure-url"),
]
