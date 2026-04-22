"""
Wardrobe 应用配置
"""
from django.apps import AppConfig


class WardrobeConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.wardrobe'
    verbose_name = '衣橱管理'
