"""
Common app admin configuration
"""
from django.contrib import admin
from .models import ModelPhoto


@admin.register(ModelPhoto)
class ModelPhotoAdmin(admin.ModelAdmin):
    """
    模特照片管理
    """
    list_display = ('id', 'is_active', 'sort_order', 'created_at')
    list_filter = ('is_active',)
    ordering = ('sort_order', 'id')
    list_editable = ('is_active', 'sort_order')
    fieldsets = (
        (None, {
            'fields': ('image_key', 'sort_order', 'is_active')
        }),
        ('图片信息', {
            'fields': ('image_url', 'image_thumb_url'),
            'classes': ('collapse',)
        }),
        ('时间信息', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    readonly_fields = ('created_at', 'updated_at')
