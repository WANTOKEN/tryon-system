#!/usr/bin/env python
"""系统初始化脚本 - 创建权限组和管理员账户"""
import os
import sys

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 设置 Django 环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

import django
django.setup()

from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from apps.accounts.models import Merchant
from apps.tryon.models import TryOnRecord
from apps.wardrobe.models import Clothing
from apps.common.models import FileRecord, ModelPhoto


def setup_permissions():
    """设置权限组和权限"""
    print("开始设置权限组和权限...")

    # 1. 创建权限组
    merchant_admin_group, created = Group.objects.get_or_create(name="商家管理员")
    if created:
        print(f"✅ 创建权限组: {merchant_admin_group.name}")
    else:
        print(f"⚠️  权限组已存在: {merchant_admin_group.name}")

    # 2. 获取内容类型
    try:
        merchant_ct = ContentType.objects.get_for_model(Merchant)
    except ContentType.DoesNotExist:
        print("⚠️  Merchant 模型的 ContentType 不存在")
        merchant_ct = None
    
    try:
        tryon_ct = ContentType.objects.get_for_model(TryOnRecord)
    except ContentType.DoesNotExist:
        print("⚠️  TryOnRecord 模型的 ContentType 不存在")
        tryon_ct = None
    
    try:
        clothing_ct = ContentType.objects.get_for_model(Clothing)
    except ContentType.DoesNotExist:
        print("⚠️  Clothing 模型的 ContentType 不存在")
        clothing_ct = None

    if merchant_ct:
        # 3. 创建自定义权限
        permissions_data = [
            # 商家管理权限
            ("merchant_view", "查看商家", merchant_ct),
            ("merchant_manage", "管理商家", merchant_ct),
            # 试穿记录权限
            ("tryon_view", "查看试穿记录", merchant_ct),
            ("tryon_manage", "管理试穿记录", merchant_ct),
            # 服装管理权限
            ("clothing_view", "查看服装", merchant_ct),
            ("clothing_manage", "管理服装", merchant_ct),
            # 文件管理权限
            ("file_view", "查看文件", merchant_ct),
            ("file_manage", "管理文件", merchant_ct),
            # 系统权限
            ("system_settings", "系统设置", merchant_ct),
            ("admin_view", "查看管理员", merchant_ct),
            ("admin_manage", "管理管理员", merchant_ct),
            ("log_view", "查看操作日志", merchant_ct),
        ]

        for codename, name, content_type in permissions_data:
            permission, created = Permission.objects.get_or_create(
                codename=codename, content_type=content_type, defaults={"name": name}
            )
            if created:
                print(f"✅ 创建权限: {codename}")

        # 4. 分配权限给商家管理员组
        merchant_admin_permissions = Permission.objects.filter(
            codename__in=["tryon_view", "clothing_view", "clothing_manage", "file_view"]
        )
        merchant_admin_group.permissions.set(merchant_admin_permissions)
        print(f"✅ 为 {merchant_admin_group.name} 分配了 {merchant_admin_permissions.count()} 个权限")

    print("权限设置完成!")


def create_admin_accounts():
    """创建管理员账户"""
    print("\n开始创建管理员账户...")

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
        try:
            merchant_group = Group.objects.get(name='商家管理员')
            merchant_admin.groups.add(merchant_group)
            merchant_admin.save()
            print(f"✅ 创建商家管理员: {merchant_admin.username}")
        except Group.DoesNotExist:
            print(f"⚠️  商家管理员组不存在，跳过权限分配")
    else:
        print("⚠️  商家管理员已存在")


def show_account_info():
    """显示账户信息"""
    print("\n" + "="*50)
    print("系统初始化完成!")
    print("="*50)
    print("账户信息:")
    print("-"*50)
    print("超级管理员:")
    print("  用户名: admin")
    print("  密码: admin123")
    print("  手机: 13800138000")
    print("  权限: 所有权限")
    print("\n商家管理员:")
    print("  用户名: merchant1")
    print("  密码: merchant123")
    print("  手机: 13800138001")
    print("  权限: 查看试穿记录、管理服装、查看文件")
    print("="*50)
    print("\n登录地址: http://localhost:8000/admin/")


if __name__ == '__main__':
    setup_permissions()
    create_admin_accounts()
    show_account_info()