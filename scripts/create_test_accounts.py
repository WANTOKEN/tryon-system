#!/usr/bin/env python
"""
创建测试账号的独立脚本

可以直接运行，无需通过 manage.py

用法:
    python scripts/create_test_accounts.py
    python scripts/create_test_accounts.py --reset
"""
import os
import sys
import django


def setup_django():
    """设置 Django 环境"""
    # 获取项目根目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    
    # 添加项目路径到 sys.path
    if project_root not in sys.path:
        sys.path.insert(0, project_root)
    
    # 设置 Django settings
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
    
    # 初始化 Django
    django.setup()


def create_test_accounts(reset=False):
    """创建测试账号"""
    from apps.accounts.models import Merchant

    # 预定义的测试账号
    test_accounts = [
        {
            'username': 'test_user',
            'phone': '13800138000',
            'password': 'Test@123456',
            'store_name': '测试店铺',
            'store_address': '测试地址',
            'quota_total': 1000,
            'is_staff': False,
            'is_superuser': False,
        },
        {
            'username': 'test_vip',
            'phone': '13800138001',
            'password': 'Test@123456',
            'store_name': 'VIP测试店铺',
            'store_address': 'VIP测试地址',
            'quota_total': 10000,
            'is_staff': False,
            'is_superuser': False,
        },
        {
            'username': 'test_admin',
            'phone': '13800138002',
            'password': 'Admin@123456',
            'store_name': '管理员测试店铺',
            'store_address': '管理员测试地址',
            'quota_total': 99999,
            'is_staff': True,
            'is_superuser': True,
        },
    ]

    created_count = 0
    updated_count = 0

    print('=' * 50)
    print('开始创建测试账号')
    print('=' * 50)

    for account_data in test_accounts:
        username = account_data['username']
        phone = account_data['phone']
        password = account_data['password']

        try:
            merchant = Merchant.objects.get(username=username)
            
            if reset:
                # 重置密码和更新信息
                merchant.set_password(password)
                merchant.phone = phone
                merchant.store_name = account_data['store_name']
                merchant.store_address = account_data['store_address']
                merchant.quota_total = account_data['quota_total']
                merchant.is_staff = account_data['is_staff']
                merchant.is_superuser = account_data['is_superuser']
                merchant.is_active = True
                merchant.status = Merchant.Status.NORMAL
                merchant.save()
                
                print(f'[更新] {username} - 密码已重置')
                updated_count += 1
            else:
                print(f'[跳过] {username} - 账号已存在 (使用 --reset 重置)')
                
        except Merchant.DoesNotExist:
            # 创建新账号
            merchant = Merchant.objects.create_user(
                username=username,
                phone=phone,
                password=password,
                store_name=account_data['store_name'],
                store_address=account_data['store_address'],
                quota_total=account_data['quota_total'],
                is_staff=account_data['is_staff'],
                is_superuser=account_data['is_superuser'],
                is_active=True,
                status=Merchant.Status.NORMAL,
            )
            
            print(f'[创建] {username} - 创建成功')
            created_count += 1

    # 打印汇总信息
    print()
    print('=' * 50)
    print('测试账号列表')
    print('=' * 50)
    
    for account_data in test_accounts:
        is_admin = account_data['is_superuser']
        role = '管理员' if is_admin else '普通用户'
        print(f"  用户名: {account_data['username']:<12} "
              f"密码: {account_data['password']:<12} "
              f"角色: {role}")

    print()
    print('=' * 50)
    print(f'完成! 创建: {created_count} 个, 更新: {updated_count} 个')


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='创建测试账号')
    parser.add_argument(
        '--reset',
        action='store_true',
        help='重置已存在的测试账号密码'
    )
    
    args = parser.parse_args()
    
    # 设置 Django 环境
    setup_django()
    
    # 创建测试账号
    create_test_accounts(reset=args.reset)


if __name__ == '__main__':
    main()
