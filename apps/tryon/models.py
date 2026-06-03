"""
试穿模型 - 重构版

核心设计原则：
1. 使用外键关联 FileRecord，不直接存储 URL
2. 移除冗余字段
3. 简化数据结构
"""

from django.db import models
from apps.common.utils.crypto import generate_tryon_uuid


class TryOnRecord(models.Model):
    """
    试穿记录

    简化设计：
    - 使用外键关联头像和结果文件
    - 移除 avatar_key, result_key（通过 FileRecord 管理）
    - 移除 result_original_url（通过日志追踪）
    """

    class Status(models.TextChoices):
        PENDING = "pending", "等待中"
        PROCESSING = "processing", "处理中"
        COMPLETED = "completed", "已完成"
        FAILED = "failed", "失败"

    class AIEngine(models.TextChoices):
        SEEDDANCE = "seeddance", "SeedDance"

    class AvatarSource(models.TextChoices):
        SYSTEM = "system", "系统模特"
        USER = "user", "用户上传"
        HISTORY = "history", "历史记录"

    id = models.BigAutoField(primary_key=True)
    uuid = models.CharField(max_length=42, unique=True, default=generate_tryon_uuid, editable=False)
    merchant_id = models.BigIntegerField(db_index=True)
    session_id = models.CharField(max_length=100, db_index=True)

    # 文件关联
    avatar_file = models.ForeignKey(
        "common.FileRecord",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tryon_avatar",
        verbose_name="头像文件",
    )
    result_file = models.ForeignKey(
        "common.FileRecord",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tryon_result",
        verbose_name="结果文件",
    )

    # 来源标识
    avatar_source = models.CharField(
        max_length=20, choices=AvatarSource.choices, default=AvatarSource.USER, verbose_name="头像来源"
    )

    # 状态
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    ai_engine = models.CharField(max_length=20, choices=AIEngine.choices, default=AIEngine.SEEDDANCE)
    task_id = models.CharField(max_length=100, default="")

    # 处理信息
    error_message = models.TextField(null=True, blank=True)
    processing_time = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    quota_deducted = models.BooleanField(default=False)

    # 收藏
    is_saved = models.BooleanField(default=False)

    # 设备信息
    ip_address = models.CharField(max_length=45, default="", blank=True)
    device_info = models.CharField(max_length=200, default="", blank=True)
    user_agent = models.CharField(max_length=500, default="")

    # 软删除
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    # 时间戳
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tryon_record"
        verbose_name = "试穿记录"
        verbose_name_plural = "试穿记录管理"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["merchant_id", "session_id", "created_at"]),
            models.Index(fields=["merchant_id", "status"]),
            models.Index(fields=["merchant_id", "is_saved", "created_at"]),
            models.Index(fields=["task_id"]),
            models.Index(fields=["session_id", "created_at"]),
        ]

    def __str__(self):
        return f"{self.uuid} ({self.status})"


class TryOnClothing(models.Model):
    """
    试穿-服装关联表

    简化设计：
    - 使用外键关联服装
    - 移除 clothing_key（通过 FileRecord 管理）
    """

    id = models.BigAutoField(primary_key=True)
    created_at = models.DateTimeField(auto_now_add=True)
    record = models.ForeignKey("TryOnRecord", on_delete=models.CASCADE, related_name="clothes", verbose_name="试穿记录")
    clothing = models.ForeignKey(
        "wardrobe.Clothing", on_delete=models.SET_NULL, null=True, blank=True, verbose_name="服装"
    )
    is_custom = models.BooleanField(default=False)  # 是否自定义服装
    category = models.CharField(max_length=30)
    subcategory = models.CharField(max_length=30)
    clothing_name = models.CharField(max_length=100)
    clothing_color = models.CharField(max_length=30, default="#000000")

    # 自定义服装的文件（当 is_custom=True 时使用）
    custom_file = models.ForeignKey(
        "common.FileRecord", on_delete=models.SET_NULL, null=True, blank=True, verbose_name="自定义服装文件"
    )

    class Meta:
        db_table = "tryon_clothing"
        verbose_name = "试穿服装关联"
        verbose_name_plural = "试穿服装关联管理"

    def __str__(self):
        return f"{self.record.uuid} - {self.clothing_name}"
