"""
试穿 URL 配置
"""
from django.urls import path
from .views import (
    TryOnGenerateView, TryOnStatusView,
    TryOnRecordListView, TryOnSaveView, TryOnDeleteView, TryOnClearHistoryView
)
from .upload_views import UploadAvatarView, UploadClothingView

urlpatterns = [
    path('upload/avatar/', UploadAvatarView.as_view(), name='upload-avatar'),
    path('upload/clothing/', UploadClothingView.as_view(), name='upload-clothing'),
    path('generate/', TryOnGenerateView.as_view(), name='tryon-generate'),
    path('records/', TryOnRecordListView.as_view(), name='tryon-list'),
    path('records/clear/', TryOnClearHistoryView.as_view(), name='tryon-clear'),
    path('records/<str:uuid>/status/', TryOnStatusView.as_view(), name='tryon-status'),
    path('records/<str:uuid>/save/', TryOnSaveView.as_view(), name='tryon-save'),
    path('records/<str:uuid>/', TryOnDeleteView.as_view(), name='tryon-delete'),
]
