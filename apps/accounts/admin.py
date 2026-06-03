"""
Django Admin 配置
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Merchant, SmsLog


@admin.register(Merchant)
class MerchantAdmin(UserAdmin):
    """商家管理"""

    list_display = ["username", "phone", "store_name", "status", "quota_total", "quota_used", "last_login_at"]
    list_filter = ["status", "is_active", "created_at"]
    search_fields = ["username", "phone", "store_name"]
    readonly_fields = ["uuid", "created_at", "updated_at", "last_login_at"]
    ordering = ["-created_at"]

    fieldsets = (
        (None, {"fields": ("username", "password")}),
        ("基本信息", {"fields": ("uuid", "phone", "store_name", "store_address", "avatar_url")}),
        ("配额", {"fields": ("quota_total", "quota_used", "quota_reset_at")}),
        ("状态", {"fields": ("status", "is_active", "last_login_at", "last_login_ip")}),
        ("时间", {"fields": ("created_at", "updated_at")}),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("username", "phone", "password1", "password2", "store_name"),
            },
        ),
    )


@admin.register(SmsLog)
class SmsLogAdmin(admin.ModelAdmin):
    """短信验证码日志"""

    list_display = ["phone", "code", "purpose", "is_used", "ip_address", "created_at", "expired_at"]
    list_filter = ["purpose", "is_used", "created_at"]
    search_fields = ["phone", "code"]
    readonly_fields = ["created_at"]
    ordering = ["-created_at"]
