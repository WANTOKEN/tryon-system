#!/usr/bin/env python
"""创建测试账号脚本 - 已迁移到 init_system.py"""
import os
import sys

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 设置 Django 环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

import django
django.setup()

from scripts.init_system import setup_permissions, create_admin_accounts, show_account_info


def create_test_accounts():
    """创建测试账号 - 调用统一初始化脚本"""
    setup_permissions()
    create_admin_accounts()
    show_account_info()


if __name__ == '__main__':
    create_test_accounts()