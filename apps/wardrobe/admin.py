"""
Django Admin 配置
"""
from django.contrib import admin
from .models import Clothing, PresetClothing


@admin.register(Clothing)
class ClothingAdmin(admin.ModelAdmin):
    """服装管理"""
    list_display = ['name', 'merchant_id', 'category', 'subcategory', 'color', 'source', 'is_active', 'created_at']
    list_filter = ['category', 'source', 'is_active', 'created_at']
    search_fields = ['name', 'uuid', 'merchant_id']
    readonly_fields = ['uuid', 'file_hash', 'created_at', 'updated_at']
    ordering = ['-created_at']


@admin.register(PresetClothing)
class PresetClothingAdmin(admin.ModelAdmin):
    """预设服装管理"""
    list_display = ['subcategory', 'category', 'color', 'sort_order', 'is_active', 'created_at']
    list_filter = ['category', 'is_active']
    search_fields = ['subcategory']
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['category', 'sort_order']
