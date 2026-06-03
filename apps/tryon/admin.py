"""
Django Admin 配置
"""

from django.contrib import admin
from django.utils.html import format_html
from .models import TryOnRecord, TryOnClothing


@admin.register(TryOnRecord)
class TryOnRecordAdmin(admin.ModelAdmin):
    """试穿记录管理"""

    list_display = ["uuid", "avatar_preview", "result_preview", "merchant_id", "status", "ai_engine", "is_saved", "created_at"]
    list_filter = ["status", "ai_engine", "is_saved", "created_at"]
    search_fields = ["uuid", "task_id", "merchant_id"]
    readonly_fields = ["uuid", "task_id", "created_at", "updated_at", "avatar_preview", "result_preview"]
    ordering = ["-created_at"]
    fieldsets = (
        (None, {"fields": ("avatar_file", "avatar_preview", "result_file", "result_preview", "status", "ai_engine", "is_saved")}),
        ("任务信息", {"fields": ("task_id", "error_message", "processing_time")}),
        ("时间信息", {"fields": ("created_at", "updated_at"), "classes": ("collapse",)}),
    )

    def avatar_preview(self, obj):
        if obj.avatar_file:
            return format_html(
                '<img src="/api/v1/file/{}/" width="150" height="150" style="object-fit: contain;"/>',
                obj.avatar_file.id
            )
        return "-"
    avatar_preview.short_description = "头像预览"

    def result_preview(self, obj):
        if obj.result_file:
            return format_html(
                '<img src="/api/v1/file/{}/" width="150" height="150" style="object-fit: contain;"/>',
                obj.result_file.id
            )
        return "-"
    result_preview.short_description = "结果预览"


@admin.register(TryOnClothing)
class TryOnClothingAdmin(admin.ModelAdmin):
    """试穿服装关联管理"""

    list_display = ["record_id", "clothing_name", "category", "subcategory", "created_at"]
    list_filter = ["category", "subcategory"]
    search_fields = ["clothing_name", "record_id"]
    readonly_fields = ["created_at"]
    ordering = ["-created_at"]
