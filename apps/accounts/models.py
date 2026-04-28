"""
商家模型
"""
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from apps.common.utils.crypto import generate_merchant_uuid


class MerchantManager(BaseUserManager):
    """商家管理器"""

    def create_user(self, username, phone, password=None, **extra_fields):
        """创建商家"""
        if not username:
            raise ValueError('用户名不能为空')
        if not phone:
            raise ValueError('手机号不能为空')

        merchant = self.model(username=username, phone=phone, **extra_fields)
        merchant.set_password(password)
        merchant.save(using=self._db)
        return merchant

    def create_superuser(self, username, phone, password=None, **extra_fields):
        """创建超级管理员"""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(username, phone, password, **extra_fields)


class Merchant(AbstractBaseUser, PermissionsMixin):
    """商家表"""

    class Status(models.IntegerChoices):
        DISABLED = 0, '禁用'
        NORMAL = 1, '正常'
        EXPIRED = 2, '过期'
        PENDING = 3, '待审核'

    class Role(models.TextChoices):
        MERCHANT = 'merchant', '普通商家'
        MERCHANT_ADMIN = 'merchant_admin', '商家管理员'

    id = models.BigAutoField(primary_key=True)
    uuid = models.CharField(max_length=42, unique=True, default=generate_merchant_uuid, editable=False)
    username = models.CharField(max_length=50, unique=True, db_index=True)
    phone = models.CharField(max_length=20, db_index=True)
    phone_encrypted = models.CharField(max_length=255, default='')
    store_name = models.CharField(max_length=100, default='')
    store_address = models.CharField(max_length=255, default='')
    avatar_url = models.URLField(max_length=500, default='')

    # 配额管理
    quota_total = models.PositiveIntegerField(default=100, verbose_name='总配额')
    quota_used = models.PositiveIntegerField(default=0, verbose_name='已用配额')
    quota_reset_at = models.DateField(null=True, blank=True, verbose_name='配额重置日期')

    # 角色和状态
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.MERCHANT,
        verbose_name='用户角色'
    )
    status = models.PositiveSmallIntegerField(choices=Status.choices, default=Status.NORMAL)
    last_login_at = models.DateTimeField(null=True, blank=True)
    last_login_ip = models.CharField(max_length=45, default='', blank=True)  # 支持 IPv6

    # Django 认证字段
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = MerchantManager()

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['phone']

    class Meta:
        db_table = 'merchant'
        verbose_name = '商家'
        verbose_name_plural = '商家管理'

    def __str__(self):
        return f"{self.username} ({self.store_name})"

    @property
    def quota_remaining(self):
        """剩余配额"""
        return max(0, self.quota_total - self.quota_used)

    @property
    def is_merchant_admin(self):
        """是否是商家管理员"""
        return self.role == self.Role.MERCHANT_ADMIN

    @property
    def is_super_admin(self):
        """是否是超级管理员"""
        return self.is_superuser

    def deduct_quota(self, count: int = 1):
        """扣减配额"""
        self.quota_used = min(self.quota_total, self.quota_used + count)

    def reset_quota(self):
        """重置配额"""
        self.quota_used = 0
        from datetime import date
        from dateutil.relativedelta import relativedelta
        self.quota_reset_at = date.today() + relativedelta(months=1)


class SmsLog(models.Model):
    """短信验证码日志"""

    class Purpose(models.TextChoices):
        LOGIN = 'login', '登录'
        BIND_PHONE = 'bind_phone', '绑定手机'
        RESET_PASSWORD = 'reset_password', '重置密码'

    id = models.BigAutoField(primary_key=True)
    merchant = models.ForeignKey(Merchant, on_delete=models.CASCADE, null=True, related_name='sms_logs')
    phone = models.CharField(max_length=20, db_index=True)
    code = models.CharField(max_length=6)
    purpose = models.CharField(max_length=20, choices=Purpose.choices, default=Purpose.LOGIN)
    is_used = models.BooleanField(default=False)
    ip_address = models.CharField(max_length=45, default='', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expired_at = models.DateTimeField()

    class Meta:
        db_table = 'sms_log'
        verbose_name = '短信验证码'
        indexes = [
            models.Index(fields=['phone', 'code', 'is_used']),
            models.Index(fields=['expired_at']),
        ]

    def __str__(self):
        return f"{self.phone} - {self.code} ({self.purpose})"

    @property
    def is_expired(self):
        """是否过期"""
        from django.utils import timezone
        return timezone.now() > self.expired_at
