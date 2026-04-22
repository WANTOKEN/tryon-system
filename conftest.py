"""
Pytest 配置
"""
import os
import sys
import django
from django.conf import settings

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 设置 Django 环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
os.environ.setdefault('DJANGO_ENV', 'testing')


def pytest_configure():
    """Pytest 配置"""
    # 使用 SQLite 进行测试
    settings.DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': ':memory:',
        }
    }
    django.setup()
