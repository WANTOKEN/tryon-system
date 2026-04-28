"""
认证 URL 配置
"""
from django.urls import path
from .views import (
    LoginView, SmsLoginView, SendSmsView,
    RefreshTokenView, LogoutView, MeView,
    RegisterView, SendResetSmsView, ResetPasswordView, AdminContactView
)

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('sms-login/', SmsLoginView.as_view(), name='sms-login'),
    path('send-sms/', SendSmsView.as_view(), name='send-sms'),
    path('refresh/', RefreshTokenView.as_view(), name='refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('me/', MeView.as_view(), name='me'),
    path('register/', RegisterView.as_view(), name='register'),
    path('send-reset-sms/', SendResetSmsView.as_view(), name='send-reset-sms'),
    path('reset-password/', ResetPasswordView.as_view(), name='reset-password'),
    path('admin-contact/', AdminContactView.as_view(), name='admin-contact'),
]
