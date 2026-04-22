"""
衣橱模型
"""
from django.db import models
from apps.common.utils.crypto import generate_clothing_uuid


class Clothing(models.Model):
    """服装表"""

    class Category(models.TextChoices):
        TOPS = 'tops', '上装'
        BOTTOMS = 'bottoms', '下装'
        DRESSES = 'dresses', '连衣裙'
        OUTERWEAR = 'outerwear', '外套'
        SHOES = 'shoes', '鞋'
        ACCESSORIES = 'accessories', '配饰'

    class Source(models.TextChoices):
        PRESET = 'preset', '预设'
        CUSTOM = 'custom', '自定义'
        WARDROBE = 'wardrobe', '衣橱上传'

    id = models.BigAutoField(primary_key=True)
    uuid = models.CharField(max_length=42, unique=True, default=generate_clothing_uuid, editable=False)
    merchant_id = models.BigIntegerField(db_index=True)
    category = models.CharField(max_length=30, choices=Category.choices)
    subcategory = models.CharField(max_length=30)
    name = models.CharField(max_length=100)
    color = models.CharField(max_length=30, default='#000000')
    image_url = models.URLField(max_length=500, default='')
    image_thumb_url = models.URLField(max_length=500, default='')
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.PRESET)
    file_hash = models.CharField(max_length=64, default='')
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'clothing'
        verbose_name = '服装'
        verbose_name_plural = '服装管理'
        ordering = ['-sort_order', '-created_at']
        indexes = [
            models.Index(fields=['merchant_id', 'category', 'is_active']),
            models.Index(fields=['merchant_id', 'category', 'subcategory', 'is_active']),
            models.Index(fields=['merchant_id', 'sort_order']),
        ]

    def __str__(self):
        return f"{self.name} ({self.category})"


class PresetClothing(models.Model):
    """预设服装模板"""

    class Category(models.TextChoices):
        TOPS = 'tops', '上装'
        BOTTOMS = 'bottoms', '下装'
        DRESSES = 'dresses', '连衣裙'
        OUTERWEAR = 'outerwear', '外套'
        SHOES = 'shoes', '鞋'
        ACCESSORIES = 'accessories', '配饰'

    id = models.BigAutoField(primary_key=True)
    category = models.CharField(max_length=30, choices=Category.choices)
    subcategory = models.CharField(max_length=30)
    name_i18n = models.JSONField(default=dict)  # {"zh-CN": "T恤", "zh-TW": "T恤", "en": "T-Shirts"}
    color = models.CharField(max_length=30, default='#000000')
    image_url = models.URLField(max_length=500, default='')
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'preset_clothing'
        verbose_name = '预设服装'
        verbose_name_plural = '预设服装管理'
        ordering = ['category', 'sort_order']

    def __str__(self):
        return f"{self.subcategory} ({self.category})"

    def get_name(self, lang: str = 'zh-CN') -> str:
        """获取指定语言的名称"""
        return self.name_i18n.get(lang, self.name_i18n.get('zh-CN', self.subcategory))
