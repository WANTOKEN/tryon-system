"""
创建测试账号管理命令

用法:
    python manage.py create_test_accounts
    python manage.py create_test_accounts --reset  # 重置已存在的测试账号密码
"""
from django.core.management.base import BaseCommand
from apps.accounts.models import Merchant


class Command(BaseCommand):
    help = '创建测试账号'

    # 预定义的测试账号
    TEST_ACCOUNTS = [
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

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='重置已存在的测试账号密码'
        )

    def handle(self, *args, **options):
        reset = options['reset']
        created_count = 0
        updated_count = 0

        self.stdout.write(self.style.HTTP_INFO('=' * 50))
        self.stdout.write(self.style.HTTP_INFO('开始创建测试账号'))
        self.stdout.write(self.style.HTTP_INFO('=' * 50))

        for account_data in self.TEST_ACCOUNTS:
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
                    
                    self.stdout.write(
                        self.style.WARNING(f'[更新] {username} - 密码已重置')
                    )
                    updated_count += 1
                else:
                    self.stdout.write(
                        self.style.WARNING(f'[跳过] {username} - 账号已存在 (使用 --reset 重置)')
                    )
                    
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
                
                self.stdout.write(
                    self.style.SUCCESS(f'[创建] {username} - 创建成功')
                )
                created_count += 1

        # 打印汇总信息
        self.stdout.write('')
        self.stdout.write(self.style.HTTP_INFO('=' * 50))
        self.stdout.write(self.style.HTTP_INFO('测试账号列表'))
        self.stdout.write(self.style.HTTP_INFO('=' * 50))
        
        for account_data in self.TEST_ACCOUNTS:
            is_admin = account_data['is_superuser']
            role = '管理员' if is_admin else '普通用户'
            self.stdout.write(
                f"  用户名: {account_data['username']:<12} "
                f"密码: {account_data['password']:<12} "
                f"角色: {role}"
            )

        self.stdout.write('')
        self.stdout.write(self.style.HTTP_INFO('=' * 50))
        self.stdout.write(
            self.style.SUCCESS(
                f'完成! 创建: {created_count} 个, 更新: {updated_count} 个'
            )
        )
