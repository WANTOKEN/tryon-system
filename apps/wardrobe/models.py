"""
服装模型 - 重构版

核心设计原则：
1. 使用外键关联 FileRecord，不直接存储 URL
2. 移除冗余字段
3. 简化分类结构
"""

import uuid
from django.db import models


class Clothing(models.Model):
    """
    服装商品

    简化设计：
    - 移除 file_hash（通过 FileRecord 管理）
    - 移除 file_id（使用外键关联）
    - 使用外键关联文件记录
    """

    class Source(models.TextChoices):
        WARDROBE = "wardrobe", "衣橱"
        UPLOAD = "upload", "临时上传"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    merchant_id = models.BigIntegerField(db_index=True, verbose_name="商家ID")

    # 基本信息
    name = models.CharField(max_length=200, verbose_name="服装名称")
    category = models.CharField(max_length=50, verbose_name="分类")
    subcategory = models.CharField(max_length=50, verbose_name="子分类")
    color = models.CharField(max_length=50, default="#000000", verbose_name="颜色")
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="价格")
    sizes = models.JSONField(default=list, verbose_name="尺码列表")

    # 文件关联
    file = models.ForeignKey(
        "common.FileRecord", on_delete=models.SET_NULL, null=True, blank=True, verbose_name="关联文件"
    )

    # 来源标识
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.WARDROBE, verbose_name="来源")

    # 状态
    is_active = models.BooleanField(default=True, verbose_name="是否启用")
    is_deleted = models.BooleanField(default=False, verbose_name="是否删除")
    deleted_at = models.DateTimeField(null=True, blank=True, verbose_name="删除时间")

    # 时间戳
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "wardrobe_clothing"
        verbose_name = "服装"
        verbose_name_plural = "服装管理"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["merchant_id", "category"]),
            models.Index(fields=["merchant_id", "is_active"]),
        ]

    def __str__(self):
        return f"Clothing({self.id} - {self.name})"
