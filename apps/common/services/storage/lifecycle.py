from datetime import timedelta
from enum import Enum
import logging

from django.utils import timezone

logger = logging.getLogger("storage")


class FileLifecyclePolicy(Enum):
    """文件生命周期策略"""

    TEMPORARY = timedelta(hours=24)  # 临时文件，24小时后删除
    SHORT_TERM = timedelta(days=7)  # 短期存储，7天后删除
    MEDIUM_TERM = timedelta(days=30)  # 中期存储，30天后删除
    LONG_TERM = timedelta(days=365)  # 长期存储，1年后删除
    PERMANENT = None  # 永久存储


class LifecycleManager:
    """文件生命周期管理器"""

    def __init__(self, storage_service):
        self.storage_service = storage_service

    def cleanup_expired_files(self, tenant_id: str = None):
        """清理过期文件"""
        from apps.common.models import FileRecord

        records = FileRecord.objects.filter(is_deleted=False)
        if tenant_id:
            records = records.filter(tenant_id=tenant_id)

        expired_records = []
        for record in records:
            policy = self._get_policy(record.file_category)
            if policy and record.created_at + policy < timezone.now():
                expired_records.append(record)

        for record in expired_records:
            try:
                self.storage_service.delete_file(record.storage_key, record.storage_type)
                record.is_deleted = True
                record.deleted_at = timezone.now()
                record.save()
                logger.info(f"[Lifecycle] 已清理过期文件: {record.storage_key}")
            except Exception as e:
                logger.error(f"[Lifecycle] 清理文件失败: {record.storage_key}, error: {e}")

    def _get_policy(self, file_category: str) -> timedelta:
        """根据文件分类获取生命周期策略"""
        policy_map = {
            "avatar": FileLifecyclePolicy.SHORT_TERM,
            "clothing": FileLifecyclePolicy.LONG_TERM,
            "result": FileLifecyclePolicy.MEDIUM_TERM,
            "model": FileLifecyclePolicy.PERMANENT,
        }
        return policy_map.get(file_category, FileLifecyclePolicy.MEDIUM_TERM)
