"""
衣橱 URL 配置
"""
from django.urls import path
from .views import ClothingListView, ClothingUploadView, ClothingDeleteView, CategoriesView

urlpatterns = [
    path('clothing/', ClothingListView.as_view(), name='clothing-list'),
    path('clothing/upload/', ClothingUploadView.as_view(), name='clothing-upload'),
    path('clothing/<str:uuid>/', ClothingDeleteView.as_view(), name='clothing-delete'),
    path('categories/', CategoriesView.as_view(), name='categories'),
]
