"""
API v1 Root Router
"""
from django.urls import path, include

urlpatterns = [
    path('auth/', include('apps.accounts.urls')),
    path('wardrobe/', include('apps.wardrobe.urls')),
    path('tryon/', include('apps.tryon.urls')),
]
