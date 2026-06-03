"""
Django Admin 配置
"""

from django.contrib import admin
from django.utils.html import format_html
from .models import Clothing


@admin.register(Clothing)
class ClothingAdmin(admin.ModelAdmin):
    """服装管理"""

    list_display = ["name", "preview_image", "merchant_id", "category", "subcategory", "color", "source", "is_active", "created_at"]
    list_filter = ["category", "source", "is_active", "created_at"]
    search_fields = ["name", "id", "merchant_id"]
    readonly_fields = ["id", "created_at", "updated_at", "preview_image"]
    ordering = ["-created_at"]
    fieldsets = (
        (None, {"fields": ("file", "preview_image", "name", "category", "subcategory", "color", "price", "sizes", "source", "is_active")}),
        ("时间信息", {"fields": ("created_at", "updated_at"), "classes": ("collapse",)}),
    )

    def preview_image(self, obj):
        if obj.file:
            return format_html(
                '<img src="/api/v1/file/{}/" width="150" height="150" style="object-fit: contain;"/>',
                obj.file.id
            )
        return "-"
    preview_image.short_description = "预览图"
