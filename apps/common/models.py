"""
公共模型
"""
import uuid
from django.db import models
from django.utils import timezone


class TimeStampedModel(models.Model):
    """带时间戳的基础模型"""
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        abstract = True


class UUIDModel(models.Model):
    """UUID 主键模型"""
    uuid = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        verbose_name='UUID'
    )

    class Meta:
        abstract = True


class FileUploadRecord(TimeStampedModel):
    """
    统一文件上传记录表
    
    用于:
    - MD5 去重（避免重复上传相同内容的文件）
    - 记录存储类型（local/oss）
    - 租户隔离（不同商户的文件分开管理）
    - 支持跨进程、跨服务共享去重信息
    - 统计和监控
    """
    
    # 存储类型选择
    class StorageType(models.TextChoices):
        LOCAL = 'local', '本地存储'
        OSS = 'oss', '阿里云 OSS'
    
    # 文件用途分类
    class FileCategory(models.TextChoices):
        AVATAR = 'avatar', '人物照片'
        CLOTHING = 'clothing', '服装图片'
        RESULT = 'result', '试穿结果'
        OTHER = 'other', '其他'
    
    # ========== 核心字段 ==========
    md5_hash = models.CharField(
        max_length=32,
        db_index=True,
        verbose_name='文件 MD5',
        help_text='用于去重，相同 MD5 复用已有文件'
    )
    storage_type = models.CharField(
        max_length=10,
        choices=StorageType.choices,
        default=StorageType.LOCAL,
        verbose_name='存储类型'
    )
    storage_key = models.CharField(
        max_length=500,
        verbose_name='存储路径',
        help_text='本地: 相对路径; OSS: object key'
    )
    access_url = models.CharField(
        max_length=1000,
        verbose_name='访问 URL',
        help_text='本地: /media/xxx; OSS: 公网 URL'
    )
    
    # ========== 租户字段 ==========
    tenant_id = models.CharField(
        max_length=50,
        db_index=True,
        verbose_name='租户 ID',
        help_text='商户/用户标识，用于隔离'
    )
    
    # ========== 分类字段 ==========
    folder = models.CharField(
        max_length=100,
        db_index=True,
        verbose_name='存储文件夹',
        help_text='如 avatars, clothes, results'
    )
    file_category = models.CharField(
        max_length=20,
        choices=FileCategory.choices,
        default=FileCategory.OTHER,
        verbose_name='文件用途'
    )
    
    # ========== 文件属性 ==========
    file_size = models.PositiveIntegerField(
        default=0,
        verbose_name='文件大小(字节)'
    )
    content_type = models.CharField(
        max_length=100,
        blank=True,
        default='',
        verbose_name='文件类型'
    )
    file_ext = models.CharField(
        max_length=10,
        blank=True,
        default='',
        verbose_name='文件扩展名',
        help_text='如 .png, .jpg, .webp'
    )
    width = models.PositiveIntegerField(
        default=0,
        verbose_name='图片宽度',
        help_text='仅图片类型有效'
    )
    height = models.PositiveIntegerField(
        default=0,
        verbose_name='图片高度',
        help_text='仅图片类型有效'
    )
    
    # ========== 统计字段 ==========
    hit_count = models.PositiveIntegerField(
        default=0,
        verbose_name='命中次数',
        help_text='相同 MD5 的重复上传次数'
    )
    last_accessed_at = models.DateTimeField(
        auto_now=True,
        verbose_name='最后访问时间'
    )
    
    # ========== 业务关联 ==========
    # 关联的业务对象 ID（如试穿记录 UUID、服装 UUID 等）
    ref_type = models.CharField(
        max_length=30,
        blank=True,
        default='',
        verbose_name='关联类型',
        help_text='如 tryon_record, clothing'
    )
    ref_id = models.CharField(
        max_length=50,
        blank=True,
        default='',
        verbose_name='关联 ID',
        help_text='关联对象的 UUID 或 ID'
    )
    
    # ========== 来源追踪 ==========
    source = models.CharField(
        max_length=30,
        blank=True,
        default='',
        verbose_name='上传来源',
        help_text='如 web, api, import'
    )
    client_ip = models.CharField(
        max_length=45,
        blank=True,
        default='',
        verbose_name='客户端 IP'
    )

    class Meta:
        db_table = 'common_file_upload_record'
        verbose_name = '文件上传记录'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']
        indexes = [
            # 核心查询：租户 + MD5（去重查询）
            models.Index(fields=['tenant_id', 'md5_hash'], name='idx_tenant_md5'),
            # 租户隔离查询
            models.Index(fields=['tenant_id', 'folder'], name='idx_tenant_folder'),
            models.Index(fields=['tenant_id', 'file_category'], name='idx_tenant_category'),
            # 存储类型统计
            models.Index(fields=['storage_type', 'folder'], name='idx_storage_folder'),
            # 时间范围查询（清理、统计）
            models.Index(fields=['-last_accessed_at'], name='idx_last_access'),
            models.Index(fields=['-created_at'], name='idx_created'),
            # 业务关联查询
            models.Index(fields=['ref_type', 'ref_id'], name='idx_ref'),
        ]
        # 联合唯一约束：同一租户同一 MD5 同一存储类型只有一条记录
        # 允许相同内容分别存储到本地和 OSS
        constraints = [
            models.UniqueConstraint(
                fields=['tenant_id', 'md5_hash', 'storage_type'],
                name='uq_tenant_md5_storage'
            ),
        ]

    def __str__(self):
        return f"[{self.tenant_id}] {self.md5_hash} -> {self.storage_key}"

    @classmethod
    def get_by_md5(cls, md5: str, tenant_id: str, storage_type: str = None):
        """
        根据 MD5 和租户获取记录
        
        Args:
            md5: 文件 MD5 哈希
            tenant_id: 租户 ID
            storage_type: 可选，指定存储类型
            
        Returns:
            FileUploadRecord 或 None
        """
        try:
            query = {'md5_hash': md5, 'tenant_id': tenant_id}
            if storage_type:
                query['storage_type'] = storage_type
            record = cls.objects.get(**query)
            # 更新命中计数
            record.hit_count += 1
            record.save(update_fields=['hit_count', 'last_accessed_at'])
            return record
        except cls.DoesNotExist:
            return None

    @classmethod
    def create_record(
        cls,
        md5: str,
        storage_type: str,
        storage_key: str,
        access_url: str,
        folder: str,
        tenant_id: str,
        file_category: str = 'other',
        file_size: int = 0,
        content_type: str = '',
        file_ext: str = '',
        width: int = 0,
        height: int = 0,
        ref_type: str = '',
        ref_id: str = '',
        source: str = '',
        client_ip: str = ''
    ):
        """
        创建上传记录
        
        Args:
            md5: 文件 MD5 哈希
            storage_type: 存储类型 (local/oss)
            storage_key: 存储路径
            access_url: 访问 URL
            folder: 存储文件夹
            tenant_id: 租户 ID
            file_category: 文件用途
            file_size: 文件大小
            content_type: 文件类型
            file_ext: 文件扩展名
            width: 图片宽度
            height: 图片高度
            ref_type: 关联类型
            ref_id: 关联 ID
            source: 上传来源
            client_ip: 客户端 IP
        """
        return cls.objects.create(
            md5_hash=md5,
            storage_type=storage_type,
            storage_key=storage_key,
            access_url=access_url,
            folder=folder,
            tenant_id=tenant_id,
            file_category=file_category,
            file_size=file_size,
            content_type=content_type,
            file_ext=file_ext,
            width=width,
            height=height,
            ref_type=ref_type,
            ref_id=ref_id,
            source=source,
            client_ip=client_ip,
        )

    @classmethod
    def cleanup_old_records(cls, days: int = 30, tenant_id: str = None):
        """
        清理旧记录
        
        Args:
            days: 保留天数
            tenant_id: 可选，指定租户
        """
        from django.utils import timezone
        cutoff = timezone.now() - timezone.timedelta(days=days)
        query = cls.objects.filter(last_accessed_at__lt=cutoff)
        if tenant_id:
            query = query.filter(tenant_id=tenant_id)
        return query.delete()
    
    @classmethod
    def get_stats_by_tenant(cls, tenant_id: str):
        """
        获取租户的文件统计
        
        Args:
            tenant_id: 租户 ID
            
        Returns:
            dict: 统计信息
        """
        from django.db.models import Sum, Count
        
        stats = cls.objects.filter(tenant_id=tenant_id).aggregate(
            total_files=Count('id'),
            total_size=Sum('file_size'),
            total_hits=Sum('hit_count'),
        )
        return {
            'total_files': stats['total_files'] or 0,
            'total_size': stats['total_size'] or 0,
            'total_hits': stats['total_hits'] or 0,
        }


# 兼容旧代码的别名
OSSFileCache = FileUploadRecord
