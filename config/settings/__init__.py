"""
Django 设置模块
根据环境变量选择配置
"""
import os
from dotenv import load_dotenv

load_dotenv()

ENV = os.getenv('DJANGO_ENV', 'development')

if ENV == 'production':
    from .production import *
elif ENV == 'testing':
    from .testing import *
else:
    from .development import *
