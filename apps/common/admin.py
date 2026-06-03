"""
Common app admin configuration
"""

from django.contrib import admin
from django.utils.html import format_html
from .models import ModelPhoto, FileRecord


@admin.register(FileRecord)
class FileRecordAdmin(admin.ModelAdmin):
    """
    文件记录管理
    """

    list_display = ("id", "file_category", "storage_type", "file_size", "is_public", "created_at")
    list_filter = ("storage_type", "file_category", "is_public")
    search_fields = ("id", "storage_key", "md5_hash")
    readonly_fields = ("id", "md5_hash", "created_at", "updated_at", "preview_image")
    ordering = ("-created_at",)

    def preview_image(self, obj):
        if obj.id:
            return format_html(
                '<img src="/api/v1/file/{}/" width="150" height="150" style="object-fit: contain;"/>',
                obj.id
            )
        return "-"
    preview_image.short_description = "预览图"


@admin.register(ModelPhoto)
class ModelPhotoAdmin(admin.ModelAdmin):
    """
    模特照片管理
    """

    list_display = ("id", "preview_image", "is_active", "sort_order", "created_at")
    list_filter = ("is_active",)
    ordering = ("sort_order", "id")
    list_editable = ("is_active", "sort_order")
    fieldsets = (
        (None, {"fields": ("file", "preview_image", "sort_order", "is_active")}),
        ("时间信息", {"fields": ("created_at", "updated_at"), "classes": ("collapse",)}),
    )
    readonly_fields = ("preview_image", "created_at", "updated_at")

    def preview_image(self, obj):
        if obj.file:
            return format_html(
                '<img src="/api/v1/file/{}/" width="150" height="150" style="object-fit: contain;"/>',
                obj.file.id
            )
        return "-"
    preview_image.short_description = "预览图"
