"""
Tryon 应用配置
"""

from django.apps import AppConfig


class TryonConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.tryon"
    verbose_name = "虚拟试穿"
