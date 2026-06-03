"""
公共模型 - 重构版

核心设计原则：
1. 文件统一管理：所有文件通过 FileRecord 管理，不直接存储 URL
2. 简化字段：移除冗余的统计和追踪字段
3. 使用外键关联：替代字符串引用
4. 租户隔离：通过 tenant_id 实现
"""

import uuid
from django.db import models


class TimeStampedModel(models.Model):
    """带时间戳的基础模型"""

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        abstract = True


class FileRecord(TimeStampedModel):
    """
    统一文件记录

    核心职责：
    - 管理所有上传文件
    - MD5 去重
    - 存储类型标识（local/oss）
    - 提供统一的文件访问入口

    简化设计：
    - 移除 hit_count（通过日志统计）
    - 移除 signed_url 缓存（运行时生成）
    - 移除 source, client_ip（通过日志追踪）
    """

    class StorageType(models.TextChoices):
        LOCAL = "local", "本地存储"
        OSS = "oss", "阿里云 OSS"

    class FileCategory(models.TextChoices):
        AVATAR = "avatar", "人物照片"
        CLOTHING = "clothing", "服装图片"
        RESULT = "result", "试穿结果"
        OTHER = "other", "其他"

    # 主键使用字符串，支持带存储类型后缀的格式（如 {UUID}-01, {UUID}-02）
    id = models.CharField(
        max_length=40,
        primary_key=True,
        editable=False,
        verbose_name="文件ID",
        help_text="格式: {UUID}-{storage_type}, 如 xxx-01(本地), xxx-02(OSS)"
    )

    # 去重核心
    md5_hash = models.CharField(
        max_length=32, db_index=True, verbose_name="文件MD5", help_text="用于去重，相同MD5复用已有文件"
    )

    # 存储信息
    storage_type = models.CharField(
        max_length=10, choices=StorageType.choices, default=StorageType.LOCAL, verbose_name="存储类型"
    )
    storage_key = models.CharField(max_length=500, verbose_name="存储路径", help_text="本地: 相对路径; OSS: object key")
    access_url = models.CharField(
        max_length=1000, verbose_name="原始访问URL", help_text="本地: /media/xxx; OSS: 公网URL"
    )

    # 租户隔离
    tenant_id = models.CharField(
        max_length=50,
        db_index=True,
        blank=True,
        default="",
        verbose_name="租户ID",
        help_text="商户/用户标识，空表示公共文件",
    )

    # 分类
    folder = models.CharField(max_length=100, db_index=True, default="uploads", verbose_name="存储文件夹")
    file_category = models.CharField(
        max_length=20, choices=FileCategory.choices, default=FileCategory.OTHER, verbose_name="文件用途"
    )
    is_public = models.BooleanField(default=False, verbose_name="是否公开", help_text="公开文件不需要签名URL")

    # 文件属性
    file_size = models.PositiveIntegerField(default=0, verbose_name="文件大小(字节)")
    content_type = models.CharField(max_length=100, blank=True, default="", verbose_name="文件类型")
    file_ext = models.CharField(max_length=10, blank=True, default="", verbose_name="文件扩展名")
    width = models.PositiveIntegerField(default=0, verbose_name="图片宽度")
    height = models.PositiveIntegerField(default=0, verbose_name="图片高度")

    # 软删除
    is_deleted = models.BooleanField(default=False, verbose_name="是否已删除")
    deleted_at = models.DateTimeField(null=True, blank=True, verbose_name="删除时间")

    class Meta:
        db_table = "common_file_record"
        verbose_name = "文件记录"
        verbose_name_plural = verbose_name
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["tenant_id", "md5_hash"], name="idx_tenant_md5"),
            models.Index(fields=["tenant_id", "folder"], name="idx_tenant_folder"),
            models.Index(fields=["storage_type"], name="idx_storage_type"),
        ]
        constraints = [
            models.UniqueConstraint(fields=["tenant_id", "md5_hash", "storage_type"], name="uq_tenant_md5_storage"),
        ]

    def __str__(self):
        return f"FileRecord({self.id} - {self.folder}/{self.storage_key})"

    @classmethod
    def get_by_md5(cls, md5: str, tenant_id: str = "", storage_type: str = None):
        """根据MD5获取记录"""
        try:
            query = {"md5_hash": md5}
            if tenant_id:
                query["tenant_id"] = tenant_id
            if storage_type:
                query["storage_type"] = storage_type
            return cls.objects.get(**query)
        except cls.DoesNotExist:
            return None


class ModelPhoto(models.Model):
    """
    模特照片

    简化设计：
    - 直接关联 FileRecord，不存储 URL
    - 移除冗余字段
    """

    id = models.BigAutoField(primary_key=True)
    file = models.ForeignKey("FileRecord", on_delete=models.SET_NULL, null=True, blank=True, verbose_name="关联文件")
    sort_order = models.IntegerField(default=0, verbose_name="排序")
    is_active = models.BooleanField(default=True, verbose_name="是否启用")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "common_model_photo"
        verbose_name = "模特照片"
        verbose_name_plural = "模特照片管理"
        ordering = ["sort_order", "id"]

    def __str__(self):
        return f"ModelPhoto({self.id})"
