from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from apps.accounts.models import Merchant
from apps.tryon.models import TryOnRecord
from apps.wardrobe.models import Clothing


class Command(BaseCommand):
    help = "设置权限组和权限"

    def handle(self, *args, **options):
        self.stdout.write("开始设置权限组和权限...")

        # 1. 创建权限组
        merchant_admin_group, created = Group.objects.get_or_create(name="商家管理员")
        if created:
            self.stdout.write(self.style.SUCCESS(f"创建权限组: {merchant_admin_group.name}"))
        else:
            self.stdout.write(f"权限组已存在: {merchant_admin_group.name}")

        # 2. 获取内容类型
        merchant_ct = ContentType.objects.get_for_model(Merchant)
        tryon_ct = ContentType.objects.get_for_model(TryOnRecord)
        clothing_ct = ContentType.objects.get_for_model(Clothing)

        # 3. 创建自定义权限
        permissions_data = [
            # 商家管理权限
            ("merchant_view", "查看商家", merchant_ct),
            ("merchant_manage", "管理商家", merchant_ct),
            # 试穿记录权限
            ("tryon_view", "查看试穿记录", tryon_ct),
            ("tryon_manage", "管理试穿记录", tryon_ct),
            # 服装管理权限
            ("clothing_view", "查看服装", clothing_ct),
            ("clothing_manage", "管理服装", clothing_ct),
            # 文件管理权限
            ("file_view", "查看文件", merchant_ct),
            ("file_manage", "管理文件", merchant_ct),
            # 系统权限
            ("system_settings", "系统设置", merchant_ct),
            ("admin_view", "查看管理员", merchant_ct),
            ("admin_manage", "管理管理员", merchant_ct),
            ("log_view", "查看操作日志", merchant_ct),
        ]

        created_permissions = []
        for codename, name, content_type in permissions_data:
            permission, created = Permission.objects.get_or_create(
                codename=codename, content_type=content_type, defaults={"name": name}
            )
            if created:
                created_permissions.append(codename)
                self.stdout.write(self.style.SUCCESS(f"创建权限: {codename}"))

        # 4. 分配权限给商家管理员组
        merchant_admin_permissions = Permission.objects.filter(
            codename__in=["tryon_view", "clothing_view", "clothing_manage", "file_view"]
        )
        merchant_admin_group.permissions.set(merchant_admin_permissions)
        self.stdout.write(
            self.style.SUCCESS(f"为 {merchant_admin_group.name} 分配了 {merchant_admin_permissions.count()} 个权限")
        )

        # 5. 更新现有用户的角色
        updated_count = Merchant.objects.filter(is_staff=True, is_superuser=False).update(
            role=Merchant.Role.MERCHANT_ADMIN
        )

        self.stdout.write(self.style.SUCCESS(f"更新了 {updated_count} 个商家管理员角色"))

        self.stdout.write(self.style.SUCCESS("权限设置完成!"))
