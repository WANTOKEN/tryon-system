"""
Django Admin 配置
"""
from django.contrib import admin
from .models import TryOnRecord, TryOnClothing


@admin.register(TryOnRecord)
class TryOnRecordAdmin(admin.ModelAdmin):
    """试穿记录管理"""
    list_display = ['uuid', 'merchant_id', 'session_id', 'status', 'ai_engine', 'is_saved', 'created_at']
    list_filter = ['status', 'ai_engine', 'is_saved', 'created_at']
    search_fields = ['uuid', 'task_id', 'merchant_id']
    readonly_fields = ['uuid', 'task_id', 'created_at', 'updated_at']
    ordering = ['-created_at']


@admin.register(TryOnClothing)
class TryOnClothingAdmin(admin.ModelAdmin):
    """试穿服装关联管理"""
    list_display = ['record_id', 'clothing_name', 'category', 'subcategory', 'created_at']
    list_filter = ['category', 'subcategory']
    search_fields = ['clothing_name', 'record_id']
    readonly_fields = ['created_at']
    ordering = ['-created_at']