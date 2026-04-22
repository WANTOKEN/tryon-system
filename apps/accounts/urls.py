"""
认证 URL 配置
"""
from django.urls import path
from .views import (
    LoginView, SmsLoginView, SendSmsView,
    RefreshTokenView, LogoutView, MeView
)

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('sms-login/', SmsLoginView.as_view(), name='sms-login'),
    path('send-sms/', SendSmsView.as_view(), name='send-sms'),
    path('refresh/', RefreshTokenView.as_view(), name='refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('me/', MeView.as_view(), name='me'),
]
