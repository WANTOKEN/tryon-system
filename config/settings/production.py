from .base import *

DEBUG = False

CORS_ALLOW_ALL_ORIGINS = False

SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = 'DENY'

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

if not os.getenv('SECRET_KEY') or os.getenv('SECRET_KEY') == 'django-insecure-change-me-in-production':
    raise ValueError(
        "生产环境必须设置 SECRET_KEY 环境变量，且不能使用默认值。"
        "请生成一个安全的密钥：python -c \"import secrets; print(secrets.token_urlsafe(50))\""
    )

ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', '').split(',')
if not ALLOWED_HOSTS or ALLOWED_HOSTS == ['']:
    raise ValueError("生产环境必须设置 ALLOWED_HOSTS 环境变量")

CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS', '').split(',')
if not CORS_ALLOWED_ORIGINS or CORS_ALLOWED_ORIGINS == ['']:
    raise ValueError("生产环境必须设置 CORS_ALLOWED_ORIGINS 环境变量")
