"""
试穿模型
"""
from django.db import models
from apps.common.utils.crypto import generate_tryon_uuid


class TryOnRecord(models.Model):
    """试穿记录表"""

    class Status(models.TextChoices):
        PENDING = 'pending', '等待中'
        PROCESSING = 'processing', '处理中'
        COMPLETED = 'completed', '已完成'
        FAILED = 'failed', '失败'

    class AIEngine(models.TextChoices):
        ALIYUN = 'aliyun', '阿里云'
        TENCENT = 'tencent', '腾讯云'
        SEEDDANCE = 'seeddance', 'SeedDance'

    id = models.BigAutoField(primary_key=True)
    uuid = models.CharField(max_length=42, unique=True, default=generate_tryon_uuid, editable=False)
    merchant_id = models.BigIntegerField(db_index=True)
    session_id = models.CharField(max_length=100, db_index=True)

    # 图片
    avatar_url = models.URLField(max_length=500)
    result_url = models.URLField(max_length=500, default='')
    result_thumb_url = models.URLField(max_length=500, default='')

    # 状态
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    ai_engine = models.CharField(max_length=20, choices=AIEngine.choices, default=AIEngine.ALIYUN)
    task_id = models.CharField(max_length=100, default='')

    # 处理信息
    error_message = models.TextField(null=True, blank=True)
    processing_time = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    quota_deducted = models.BooleanField(default=False)

    # 收藏
    is_saved = models.BooleanField(default=False)

    # 设备信息
    ip_address = models.CharField(max_length=45, default='', blank=True)
    device_info = models.CharField(max_length=200, default='', blank=True)
    user_agent = models.CharField(max_length=500, default='')

    # 软删除
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    # 时间戳
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tryon_record'
        verbose_name = '试穿记录'
        verbose_name_plural = '试穿记录管理'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['merchant_id', 'session_id', 'created_at']),
            models.Index(fields=['merchant_id', 'status']),
            models.Index(fields=['merchant_id', 'is_saved', 'created_at']),
            models.Index(fields=['task_id']),
            models.Index(fields=['session_id', 'created_at']),
        ]

    def __str__(self):
        return f"{self.uuid} ({self.status})"


class TryOnClothing(models.Model):
    """试穿-服装关联表"""
    id = models.BigAutoField(primary_key=True)
    record_id = models.BigIntegerField(db_index=True)
    clothing_id = models.CharField(max_length=100)  # 服装ID（支持UUID和自定义ID）
    is_custom = models.BooleanField(default=False)  # 是否自定义服装
    category = models.CharField(max_length=30)
    subcategory = models.CharField(max_length=30)
    clothing_name = models.CharField(max_length=100)
    clothing_color = models.CharField(max_length=30, default='#000000')
    clothing_image = models.URLField(max_length=500, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'tryon_clothing'
        verbose_name = '试穿服装关联'
        verbose_name_plural = '试穿服装关联管理'
        indexes = [
            models.Index(fields=['record_id']),
            models.Index(fields=['clothing_id']),
        ]

    def __str__(self):
        return f"{self.record_id} - {self.clothing_name}"
