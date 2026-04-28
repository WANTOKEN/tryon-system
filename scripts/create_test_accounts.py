#!/usr/bin/env python
"""创建测试账号脚本"""
import os
import sys
# python scripts/create_test_accounts.py
# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 设置 Django 环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

import django
django.setup()

from apps.accounts.models import Merchant
from django.contrib.auth.models import Group

def create_test_accounts():
    """创建测试账号"""
    
    # 创建超级管理员
    if not Merchant.objects.filter(username='admin').exists():
        super_admin = Merchant.objects.create_superuser(
            username='admin',
            phone='13800138000',
            password='admin123',
            store_name='系统管理'
        )
        print(f"✅ 创建超级管理员: {super_admin.username}")
    else:
        print("⚠️  超级管理员已存在")
    
    # 创建商家管理员
    if not Merchant.objects.filter(username='merchant1').exists():
        merchant_admin = Merchant.objects.create_user(
            username='merchant1',
            phone='13800138001',
            password='merchant123',
            store_name='测试商家',
            is_staff=True,
            role='merchant_admin'
        )
        
        # 分配权限组
        merchant_group = Group.objects.get(name='商家管理员')
        merchant_admin.groups.add(merchant_group)
        merchant_admin.save()
        
        print(f"✅ 创建商家管理员: {merchant_admin.username}")
    else:
        print("⚠️  商家管理员已存在")

    print("\n" + "="*50)
    print("测试账号信息:")
    print("="*50)
    print("超级管理员:")
    print("  用户名: admin")
    print("  密码: admin123")
    print("  权限: 所有权限")
    print("\n商家管理员:")
    print("  用户名: merchant1")
    print("  密码: merchant123")
    print("  权限: 查看试穿记录、管理服装、查看文件")
    print("="*50)

if __name__ == '__main__':
    create_test_accounts()
