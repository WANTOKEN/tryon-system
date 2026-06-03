"""
衣橱 URL 配置
"""

from django.urls import path
from .views import ClothingListView, ClothingUploadView, ClothingDetailView, ClothingCreateView, CategoriesView

urlpatterns = [
    path("clothing/", ClothingListView.as_view(), name="clothing-list"),
    path("clothing/upload/", ClothingUploadView.as_view(), name="clothing-upload"),
    path("clothing/create/", ClothingCreateView.as_view(), name="clothing-create"),
    path("clothing/<str:uuid>/", ClothingDetailView.as_view(), name="clothing-detail"),
    path("categories/", CategoriesView.as_view(), name="categories"),
]
