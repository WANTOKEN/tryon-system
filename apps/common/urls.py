"""
Common app URL configuration
"""
from django.urls import path
from .views import ModelPhotosView, SignedUrlView

urlpatterns = [
    path('model-photos/', ModelPhotosView.as_view(), name='model-photos'),
    path('signed-url/', SignedUrlView.as_view(), name='signed-url'),
]
