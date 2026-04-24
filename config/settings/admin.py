"""
管理后台 Django 配置
基于 development 配置，添加管理后台特定设置
"""
from .development import *

# 管理后台特定配置
REST_FRAMEWORK['DEFAULT_AUTHENTICATION_CLASSES'] = [
    'rest_framework.authentication.SessionAuthentication',
    'rest_framework.authentication.BasicAuthentication',
]

# 允许前端开发服务器访问
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
]
CORS_ALLOW_ALL_ORIGINS = False

# 管理后台 JWT 配置
SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'] = timedelta(hours=8)  # 管理员登录8小时有效
