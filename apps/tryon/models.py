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
        SEEDDANCE = 'seeddance', 'SeedDance'

    class AvatarSource(models.TextChoices):
        SYSTEM = 'system', '系统模特'
        USER = 'user', '用户上传'
        HISTORY = 'history', '历史记录'

    id = models.BigAutoField(primary_key=True)
    uuid = models.CharField(max_length=42, unique=True, default=generate_tryon_uuid, editable=False)
    merchant_id = models.BigIntegerField(db_index=True)
    session_id = models.CharField(max_length=100, db_index=True)

    # 图片
    avatar_url = models.URLField(max_length=500)
    avatar_key = models.CharField(max_length=255, default='', blank=True)  # OSS key，用于复用
    avatar_source = models.CharField(
        max_length=20,
        choices=AvatarSource.choices,
        default=AvatarSource.USER,
        help_text='头像来源：system-系统模特, user-用户上传, history-历史记录'
    )
    result_url = models.URLField(max_length=500, default='')  # 存储后的结果图 URL（本地或 OSS）
    result_key = models.CharField(max_length=255, default='', blank=True)  # 结果图存储 key
    result_original_url = models.URLField(max_length=1000, default='', blank=True)  # AI 原始返回的 URL（如火山引擎 TOS）
    result_thumb_url = models.URLField(max_length=500, default='')

    # 状态
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    ai_engine = models.CharField(max_length=20, choices=AIEngine.choices, default=AIEngine.SEEDDANCE)
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
    clothing_key = models.CharField(max_length=255, default='', blank=True)  # 存储 key 供复用
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
