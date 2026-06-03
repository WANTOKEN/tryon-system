# 存储架构优化实施方案

## 1. 问题分析

### 1.1 现状评估

基于对当前存储系统的分析，发现以下主要维护问题：

| 问题类别 | 具体问题 | 影响 | 严重程度 |
|---------|---------|------|---------|
| **代码重复** | `LocalStorageService` 和 `OSSService` 存在大量重复代码 | 维护成本高，容易产生不一致 | 高 |
| **单例模式** | 单例在多进程环境下不稳定 | 连接泄漏、状态不一致风险 | 高 |
| **生命周期** | 缺少文件过期自动清理机制 | 存储空间持续增长 | 高 |
| **配额管理** | 缺少租户级存储配额限制 | 单个租户可能耗尽资源 | 中 |
| **监控告警** | 缺少存储使用监控和告警 | 无法及时发现存储异常 | 中 |
| **扩展性** | 存储类型只能全局配置 | 无法满足混合存储场景 | 中 |

### 1.2 核心问题定位

**代码重复问题**：
- `LocalStorageService._validate_upload()` 与 `OSSService._validate_upload()` 逻辑完全相同
- `LocalStorageService._check_duplicate()` 与 `OSSService._check_duplicate()` 逻辑完全相同  
- `LocalStorageService._save_record()` 与 `OSSService._save_record()` 逻辑完全相同

**单例模式问题**：
- 当前单例无法在多进程（如 gunicorn worker）环境下正确工作
- OSS 客户端连接可能被多个进程共享导致状态混乱

---

## 2. 优化目标

| 目标 | 描述 |
|-----|------|
| **代码去重** | 抽取公共基类，消除重复代码 |
| **架构解耦** | 采用策略模式，支持灵活扩展 |
| **生命周期管理** | 实现文件自动过期清理 |
| **配额控制** | 实现租户级存储配额管理 |
| **监控告警** | 添加 Prometheus 指标和告警规则 |
| **可靠性** | 添加文件备份与恢复机制 |

---

## 3. 实施步骤

### 阶段一：架构重构（第1-2周）

#### 3.1 创建抽象接口层

**新建文件**: `apps/common/services/storage/base.py`

```python
from abc import ABC, abstractmethod
from typing import Optional, Tuple, BinaryIO, Dict, Any

class StorageBackend(ABC):
    """存储后端抽象接口"""
    
    @abstractmethod
    def upload_file(
        self,
        file_obj: BinaryIO,
        filename: str = 'image.png',
        folder: str = 'uploads',
        tenant_id: str = '',
        content_type: str = 'image/png',
        file_category: str = 'other',
        skip_duplicate: bool = True,
        ref_type: str = '',
        ref_id: str = '',
        source: str = '',
        client_ip: str = '',
        is_public: bool = False
    ) -> Tuple[str, str, bool, str]:
        pass
    
    @abstractmethod
    def get_url(self, key: str) -> str:
        pass
    
    @abstractmethod
    def get_signed_url(self, key: str, expires: int = 3600) -> str:
        pass
    
    @abstractmethod
    def delete_file(self, key: str) -> bool:
        pass
    
    @property
    @abstractmethod
    def storage_type(self) -> str:
        pass


class BaseStorageService(StorageBackend):
    """存储服务基类，提供通用功能"""
    
    def __init__(self):
        self._record_model = None
    
    def _validate_upload(self, content: bytes, filename: str, content_type: str) -> str:
        """统一文件验证逻辑"""
        from apps.common.constants import FileSizeLimit, ErrorMessage
        from apps.common.services.upload_config import UploadValidationError
        
        file_size = len(content)
        if file_size > FileSizeLimit.MAX_FILE_SIZE:
            raise UploadValidationError(
                f'{ErrorMessage.FILE_TOO_LARGE}（最大 {FileSizeLimit.MAX_FILE_SIZE // 1024 // 1024}MB，当前 {file_size // 1024 // 1024}MB）'
            )
        
        if file_size == 0:
            raise UploadValidationError(ErrorMessage.FILE_EMPTY)
        
        ext = self._get_extension(content_type, filename)
        return ext
    
    def _get_extension(self, content_type: str, filename: str) -> str:
        """获取文件扩展名"""
        from apps.common.constants import FileType, FileExtension
        
        if FileType.is_supported(content_type):
            return FileType.get_extension(content_type)
        
        ext = os.path.splitext(filename)[1].lower()
        if not FileExtension.is_supported(ext):
            from apps.common.services.upload_config import UploadValidationError
            raise UploadValidationError(
                f'{ErrorMessage.FILE_TYPE_NOT_SUPPORTED}，仅支持：{", ".join(FileExtension.ALL)}'
            )
        return ext
    
    def _check_duplicate(self, md5: str, tenant_id: str) -> Optional[Tuple[str, str]]:
        """检查重复文件（统一逻辑）"""
        try:
            FileUploadRecord = self._get_record_model()
            record = FileUploadRecord.get_by_md5(
                md5, 
                tenant_id=tenant_id, 
                storage_type=self.storage_type
            )
            if record:
                return record.storage_key, record.access_url
        except Exception as e:
            logger.warning(f"查询重复文件失败: {e}")
        return None
    
    def _save_record(self, **kwargs):
        """保存上传记录（统一逻辑）"""
        try:
            FileUploadRecord = self._get_record_model()
            kwargs['storage_type'] = self.storage_type
            FileUploadRecord.create_record(**kwargs)
        except Exception as e:
            logger.warning(f"保存记录失败: {e}")
    
    def _get_record_model(self):
        """延迟导入记录模型"""
        if not self._record_model:
            from apps.common.models import FileUploadRecord
            self._record_model = FileUploadRecord
        return self._record_model
```

**修改原因**：抽取公共逻辑，消除代码重复，提高可维护性。

---

#### 3.2 创建存储工厂

**新建文件**: `apps/common/services/storage/factory.py`

```python
from typing import Type
import threading
import os

class StorageFactory:
    """存储服务工厂"""
    
    _backends = {}
    
    @classmethod
    def register_backend(cls, storage_type: str, backend_class: Type[StorageBackend]):
        """注册存储后端"""
        cls._backends[storage_type] = backend_class
    
    @classmethod
    def create_backend(cls, storage_type: str, **kwargs) -> StorageBackend:
        """创建存储后端实例"""
        if storage_type not in cls._backends:
            raise ValueError(f"不支持的存储类型: {storage_type}")
        
        return cls._backends[storage_type](**kwargs)
    
    @classmethod
    def get_backend(cls, storage_type: str = None) -> StorageBackend:
        """获取存储后端（线程安全）"""
        if not storage_type:
            storage_type = os.getenv('STORAGE_TYPE', 'local').lower()
        
        thread_local = threading.local()
        cache_key = f"storage_backend_{storage_type}"
        
        if not hasattr(thread_local, cache_key):
            setattr(thread_local, cache_key, cls.create_backend(storage_type))
        
        return getattr(thread_local, cache_key)

# 注册后端
from apps.common.services.storage.base import StorageBackend
from apps.common.services.storage.local import LocalStorageBackend
from apps.common.services.storage.oss import OSSStorageBackend

StorageFactory.register_backend('local', LocalStorageBackend)
StorageFactory.register_backend('oss', OSSStorageBackend)
```

**修改原因**：解决单例模式在多进程环境下的问题，使用线程本地存储保证线程安全。

---

#### 3.3 重构本地存储服务

**新建文件**: `apps/common/services/storage/local.py`

```python
import os
import logging
from typing import Optional, Tuple, BinaryIO

from apps.common.services.storage.base import BaseStorageService
from apps.common.utils.content_key import ContentKey

logger = logging.getLogger('storage')


class LocalStorageBackend(BaseStorageService):
    """本地文件存储后端"""
    
    storage_type = 'local'
    
    def __init__(self):
        super().__init__()
        from django.conf import settings
        self.media_root = getattr(settings, 'MEDIA_ROOT', 'media')
        self.media_url = getattr(settings, 'MEDIA_URL', '/media/')
    
    def _ensure_dir(self, filepath: str):
        """确保目录存在"""
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
    
    def _generate_filename(self, folder: str, md5: str, ext: str = '.png') -> str:
        """基于 MD5 生成文件名"""
        return f"{folder}/{md5}{ext}"
    
    def upload_file(
        self,
        file_obj: BinaryIO,
        filename: str = 'image.png',
        folder: str = 'uploads',
        tenant_id: str = '',
        content_type: str = 'image/png',
        file_category: str = 'other',
        skip_duplicate: bool = True,
        ref_type: str = '',
        ref_id: str = '',
        source: str = '',
        client_ip: str = '',
        is_public: bool = False
    ) -> Tuple[str, str, bool, str]:
        
        if hasattr(file_obj, 'seek'):
            file_obj.seek(0)
        content = file_obj.read()
        
        ext = self._validate_upload(content, filename, content_type)
        md5 = hashlib.md5(content).hexdigest()
        
        if skip_duplicate and tenant_id:
            cached = self._check_duplicate(md5, tenant_id)
            if cached:
                content_key = ContentKey.from_md5(md5, 'local')
                return cached[0], cached[1], True, content_key
        
        relative_path = self._generate_filename(folder, md5, ext)
        full_path = os.path.join(self.media_root, relative_path)
        
        self._ensure_dir(full_path)
        
        with open(full_path, 'wb') as f:
            f.write(content)
        
        base_url = os.getenv('BACKEND_URL', 'http://localhost:8888')
        url = f"{base_url.rstrip('/')}{self.media_url}{relative_path.replace(os.sep, '/')}"
        
        if tenant_id:
            self._save_record(
                md5=md5,
                storage_key=relative_path,
                access_url=url,
                folder=folder,
                tenant_id=tenant_id,
                file_category=file_category,
                file_size=len(content),
                content_type=content_type,
                file_ext=ext,
                ref_type=ref_type,
                ref_id=ref_id,
                source=source,
                client_ip=client_ip,
                is_public=is_public,
            )
        
        content_key = ContentKey.from_md5(md5, 'local')
        return relative_path, url, False, content_key
    
    def get_url(self, key: str) -> str:
        return f"{self.media_url}{key.replace(os.sep, '/')}"
    
    def get_signed_url(self, key: str, expires: int = 3600) -> str:
        return self.get_url(key)
    
    def delete_file(self, key: str) -> bool:
        try:
            filepath = os.path.join(self.media_root, key)
            if os.path.exists(filepath):
                os.remove(filepath)
                return True
            return False
        except Exception as e:
            logger.error(f"删除文件失败: {key}, error={e}")
            return False
```

**修改原因**：继承基类，消除重复代码。

---

#### 3.4 重构 OSS 存储服务

**新建文件**: `apps/common/services/storage/oss.py`

```python
import os
import uuid
import logging
from typing import Optional, Tuple, BinaryIO

import oss2

from apps.common.services.storage.base import BaseStorageService
from apps.common.utils.content_key import ContentKey
from apps.common.exceptions import OssException

logger = logging.getLogger('oss')


class OSSStorageBackend(BaseStorageService):
    """阿里云 OSS 存储后端"""
    
    storage_type = 'oss'
    
    def __init__(self):
        super().__init__()
        self.access_key_id = os.getenv('OSS_ACCESS_KEY_ID', '')
        self.access_key_secret = os.getenv('OSS_ACCESS_KEY_SECRET', '')
        self.bucket_name = os.getenv('OSS_BUCKET_NAME', '')
        self.endpoint = os.getenv('OSS_ENDPOINT', 'oss-cn-shanghai.aliyuncs.com')
        self.domain = os.getenv('OSS_DOMAIN', '')
        self.public_read = os.getenv('OSS_PUBLIC_READ', 'false').lower() == 'true'
        
        self._auth = None
        self._bucket = None
        self.enabled = self._check_config()
        
        if self.enabled:
            self._init_client()
    
    def _check_config(self) -> bool:
        return all([self.access_key_id, self.access_key_secret, self.bucket_name])
    
    def _init_client(self):
        try:
            self._auth = oss2.Auth(self.access_key_id, self.access_key_secret)
            self._bucket = oss2.Bucket(self._auth, self.endpoint, self.bucket_name)
        except Exception as e:
            logger.error(f"OSS 初始化失败: {e}")
            self.enabled = False
    
    @property
    def bucket(self) -> oss2.Bucket:
        if not self.enabled:
            raise OssException('OSS 服务不可用')
        return self._bucket
    
    def _generate_file_key(self, folder: str, filename: str, md5: str) -> str:
        ext = os.path.splitext(filename)[1] or '.jpg'
        return f"{folder}/{md5}{ext}"
    
    def upload_file(
        self,
        file_obj: BinaryIO,
        filename: str = 'image.png',
        folder: str = 'uploads',
        tenant_id: str = '',
        content_type: str = 'image/png',
        file_category: str = 'other',
        skip_duplicate: bool = True,
        ref_type: str = '',
        ref_id: str = '',
        source: str = '',
        client_ip: str = '',
        is_public: bool = False
    ) -> Tuple[str, str, bool, str]:
        
        if not self.enabled:
            raise OssException('OSS 服务不可用')
        
        original_pos = file_obj.tell() if hasattr(file_obj, 'tell') else 0
        content = file_obj.read()
        
        self._validate_upload(content, filename, content_type)
        md5 = hashlib.md5(content).hexdigest()
        
        if skip_duplicate and tenant_id:
            cached = self._check_duplicate(md5, tenant_id)
            if cached:
                content_key = ContentKey.from_md5(md5, 'oss')
                return cached[0], cached[1], True, content_key
        
        oss_key = self._generate_file_key(folder, filename, md5)
        
        headers = {
            'x-oss-meta-md5': md5,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Expires': 'Thu, 31 Dec 2026 23:59:59 GMT',
        }
        if content_type:
            headers['Content-Type'] = content_type
        
        result = self.bucket.put_object(oss_key, content, headers=headers)
        if result.status != 200:
            raise OssException(f'OSS 上传失败: HTTP {result.status}')
        
        public_url = self.get_url(oss_key)
        
        if tenant_id:
            self._save_record(
                md5=md5,
                storage_key=oss_key,
                access_url=public_url,
                folder=folder,
                tenant_id=tenant_id,
                file_category=file_category,
                file_size=len(content),
                content_type=content_type,
                ref_type=ref_type,
                ref_id=ref_id,
                source=source,
                client_ip=client_ip,
                is_public=is_public,
            )
        
        content_key = ContentKey.from_md5(md5, 'oss')
        return oss_key, public_url, False, content_key
    
    def get_url(self, key: str) -> str:
        from urllib.parse import unquote
        key = unquote(key)
        
        if self.domain:
            return f"https://{self.domain}/{key}"
        else:
            return f"https://{self.bucket_name}.{self.endpoint}/{key}"
    
    def get_signed_url(self, key: str, expires: int = 3600) -> str:
        if not self.enabled:
            raise OssException('OSS 服务不可用')
        
        from urllib.parse import unquote
        key = unquote(key)
        
        if self.public_read:
            return self.get_url(key)
        
        url = self.bucket.sign_url('GET', key, expires)
        if url.startswith('http://'):
            url = 'https://' + url[7:]
        
        return url
    
    def delete_file(self, key: str) -> bool:
        if not self.enabled:
            return False
        
        try:
            self.bucket.delete_object(key)
            return True
        except oss2.exceptions.OssError as e:
            logger.error(f"OSS 删除失败: {key}, error={e}")
            return False
```

**修改原因**：继承基类，消除重复代码。

---

#### 3.5 更新统一存储服务

**修改文件**: `apps/common/services/storage_service.py`

```python
import os
import logging
from typing import Optional, Tuple, BinaryIO

from apps.common.services.storage.factory import StorageFactory

logger = logging.getLogger('storage')


class StorageService:
    """统一存储服务"""
    
    def __init__(self):
        storage_type = os.getenv('STORAGE_TYPE', 'local').lower()
        self._storage_type = storage_type
        self._backend = StorageFactory.get_backend(storage_type)
        self._is_oss = (storage_type == 'oss')
    
    @property
    def enabled(self) -> bool:
        return getattr(self._backend, 'enabled', True)
    
    @property
    def is_oss(self) -> bool:
        return self._is_oss
    
    def upload_file(self, **kwargs) -> Tuple[str, str, bool, str]:
        return self._backend.upload_file(**kwargs)
    
    def upload_from_base64(self, **kwargs) -> Tuple[str, str, bool, str]:
        return self._backend.upload_from_base64(**kwargs)
    
    def get_url(self, key: str) -> str:
        return self._backend.get_url(key)
    
    def get_signed_url(self, key: str, expires: int = 3600) -> str:
        return self._backend.get_signed_url(key, expires)
    
    def get_signed_url_from_url(self, url: str, expires: int = 3600) -> str:
        return self._backend.get_signed_url_from_url(url, expires)
    
    def delete_file(self, storage_key: str, storage_type: str = None) -> bool:
        if not storage_type:
            storage_type = self._storage_type
        
        backend = StorageFactory.get_backend(storage_type)
        return backend.delete_file(storage_key)


storage_service = StorageService()
```

**修改原因**：使用工厂模式获取后端，简化代码。

---

### 阶段二：资源管理（第1-2周）

#### 3.6 实现文件生命周期管理

**新建文件**: `apps/common/services/storage/lifecycle.py`

```python
from datetime import timedelta
from enum import Enum
import logging

from django.utils import timezone

logger = logging.getLogger('storage')


class FileLifecyclePolicy(Enum):
    """文件生命周期策略"""
    TEMPORARY = timedelta(hours=24)      # 临时文件，24小时后删除
    SHORT_TERM = timedelta(days=7)       # 短期存储，7天后删除
    MEDIUM_TERM = timedelta(days=30)     # 中期存储，30天后删除
    LONG_TERM = timedelta(days=365)      # 长期存储，1年后删除
    PERMANENT = None                     # 永久存储


class LifecycleManager:
    """文件生命周期管理器"""
    
    def __init__(self, storage_service):
        self.storage_service = storage_service
    
    def cleanup_expired_files(self, tenant_id: str = None):
        """清理过期文件"""
        from apps.common.models import FileUploadRecord
        
        records = FileUploadRecord.objects.filter(is_deleted=False)
        if tenant_id:
            records = records.filter(tenant_id=tenant_id)
        
        expired_records = []
        for record in records:
            policy = self._get_policy(record.file_category)
            if policy and record.created_at + policy < timezone.now():
                expired_records.append(record)
        
        for record in expired_records:
            try:
                self.storage_service.delete_file(
                    record.storage_key, 
                    record.storage_type
                )
                record.is_deleted = True
                record.deleted_at = timezone.now()
                record.save()
            except Exception as e:
                logger.error(f"清理文件失败: {record.storage_key}, error={e}")
    
    def _get_policy(self, file_category: str) -> timedelta:
        """根据文件类别获取生命周期策略"""
        policy_map = {
            'temp': FileLifecyclePolicy.TEMPORARY,
            'result': FileLifecyclePolicy.SHORT_TERM,
            'avatar': FileLifecyclePolicy.MEDIUM_TERM,
            'clothing': FileLifecyclePolicy.LONG_TERM,
        }
        return policy_map.get(file_category, FileLifecyclePolicy.MEDIUM_TERM)
```

**修改原因**：实现文件自动过期清理，控制存储空间增长。

---

#### 3.7 实现租户配额管理

**新建文件**: `apps/common/services/storage/quota.py`

```python
from decimal import Decimal
import logging

from django.db.models import Sum

logger = logging.getLogger('storage')


class StorageQuotaManager:
    """存储配额管理器"""
    
    def __init__(self):
        self.default_quota = Decimal('10737418240')  # 10GB
    
    def get_quota(self, tenant_id: str) -> Decimal:
        """获取租户配额"""
        from apps.accounts.models import Merchant
        try:
            merchant = Merchant.objects.get(id=tenant_id)
            return Decimal(merchant.storage_quota) if merchant.storage_quota else self.default_quota
        except Merchant.DoesNotExist:
            return self.default_quota
    
    def get_used(self, tenant_id: str) -> Decimal:
        """获取租户已使用空间"""
        from apps.common.models import FileUploadRecord
        
        result = FileUploadRecord.objects.filter(
            tenant_id=tenant_id,
            is_deleted=False
        ).aggregate(total_size=Sum('file_size'))
        
        return Decimal(result['total_size'] or 0)
    
    def can_upload(self, tenant_id: str, file_size: int) -> tuple:
        """检查是否可以上传"""
        quota = self.get_quota(tenant_id)
        used = self.get_used(tenant_id)
        
        if used + file_size > quota:
            remaining = quota - used
            return False, f"存储空间不足，剩余 {self._format_size(remaining)}"
        
        return True, ""
    
    def _format_size(self, bytes_size: Decimal) -> str:
        """格式化文件大小"""
        if bytes_size < 1024:
            return f"{bytes_size} B"
        elif bytes_size < 1024 * 1024:
            return f"{bytes_size / 1024:.2f} KB"
        elif bytes_size < 1024 * 1024 * 1024:
            return f"{bytes_size / (1024 * 1024):.2f} MB"
        else:
            return f"{bytes_size / (1024 * 1024 * 1024):.2f} GB"
```

**修改原因**：实现租户级存储配额限制，防止资源滥用。

---

#### 3.8 添加定时任务

**新建文件**: `apps/common/tasks.py`

```python
from celery import shared_task

from apps.common.services.storage.lifecycle import LifecycleManager
from apps.common.services.storage_service import storage_service


@shared_task
def cleanup_expired_files_task():
    """定时清理过期文件（每小时执行）"""
    manager = LifecycleManager(storage_service)
    manager.cleanup_expired_files()


@shared_task
def cleanup_expired_files_by_tenant_task(tenant_id: str):
    """清理指定租户的过期文件"""
    manager = LifecycleManager(storage_service)
    manager.cleanup_expired_files(tenant_id)
```

**修改文件**: `config/celery.py`

```python
from celery.schedules import crontab

app.conf.beat_schedule = {
    'cleanup-expired-files': {
        'task': 'apps.common.tasks.cleanup_expired_files_task',
        'schedule': crontab(hour='*'),
    },
}
```

**修改原因**：定期清理过期文件。

---

### 阶段三：监控告警（第1周）

#### 3.9 添加监控指标

**新建文件**: `apps/common/services/storage/monitoring.py`

```python
from prometheus_client import Counter, Gauge, Histogram
from datetime import datetime

# 指标定义
upload_counter = Counter(
    'storage_upload_total', 
    'Total number of file uploads',
    ['tenant_id', 'storage_type', 'file_category']
)

download_counter = Counter(
    'storage_download_total',
    'Total number of file downloads',
    ['tenant_id', 'storage_type']
)

storage_usage_gauge = Gauge(
    'storage_usage_bytes',
    'Storage usage by tenant',
    ['tenant_id']
)

upload_duration_histogram = Histogram(
    'storage_upload_duration_seconds',
    'Upload duration in seconds',
    ['storage_type']
)


class StorageMonitor:
    """存储监控器"""
    
    @classmethod
    def record_upload(cls, tenant_id: str, storage_type: str, file_category: str, duration: float):
        """记录上传事件"""
        upload_counter.labels(tenant_id, storage_type, file_category).inc()
        upload_duration_histogram.labels(storage_type).observe(duration)
    
    @classmethod
    def record_download(cls, tenant_id: str, storage_type: str):
        """记录下载事件"""
        download_counter.labels(tenant_id, storage_type).inc()
    
    @classmethod
    def update_storage_usage(cls, tenant_id: str, usage_bytes: int):
        """更新存储使用量"""
        storage_usage_gauge.labels(tenant_id).set(usage_bytes)
    
    @classmethod
    def check_usage_alerts(cls, tenant_id: str) -> list:
        """检查使用量告警"""
        from apps.common.services.storage.quota import StorageQuotaManager
        
        quota_manager = StorageQuotaManager()
        quota = quota_manager.get_quota(tenant_id)
        used = quota_manager.get_used(tenant_id)
        
        alerts = []
        usage_percent = (used / quota) * 100
        
        if usage_percent >= 95:
            alerts.append({
                'level': 'critical',
                'message': f"租户 {tenant_id} 存储使用率达到 {usage_percent:.1f}%",
                'timestamp': datetime.now().isoformat()
            })
        elif usage_percent >= 80:
            alerts.append({
                'level': 'warning',
                'message': f"租户 {tenant_id} 存储使用率达到 {usage_percent:.1f}%",
                'timestamp': datetime.now().isoformat()
            })
        
        return alerts
```

**修改原因**：添加 Prometheus 监控指标，支持监控告警。

---

### 阶段四：备份恢复（第1周）

#### 3.10 实现备份管理器

**新建文件**: `apps/common/services/storage/backup.py`

```python
from datetime import datetime
from pathlib import Path
import logging

logger = logging.getLogger('storage')


class BackupManager:
    """备份管理器"""
    
    def __init__(self, source_storage, backup_storage):
        self.source_storage = source_storage
        self.backup_storage = backup_storage
    
    def backup_file(self, storage_key: str, storage_type: str):
        """备份单个文件"""
        try:
            content = self._get_file_content(storage_key, storage_type)
            if not content:
                return False
            
            backup_key = f"backup/{datetime.now().strftime('%Y/%m/%d')}/{storage_key}"
            
            from io import BytesIO
            file_obj = BytesIO(content)
            self.backup_storage.upload_file(
                file_obj=file_obj,
                filename=Path(storage_key).name,
                folder='backup',
                tenant_id='system',
                is_public=False
            )
            return True
        except Exception as e:
            logger.error(f"备份文件失败: {storage_key}, error={e}")
            return False
    
    def batch_backup(self, tenant_id: str = None):
        """批量备份"""
        from apps.common.models import FileUploadRecord
        
        records = FileUploadRecord.objects.filter(is_deleted=False)
        if tenant_id:
            records = records.filter(tenant_id=tenant_id)
        
        success_count = 0
        fail_count = 0
        
        for record in records:
            if self.backup_file(record.storage_key, record.storage_type):
                success_count += 1
            else:
                fail_count += 1
        
        return {'success': success_count, 'failed': fail_count}
    
    def restore_file(self, backup_key: str, target_tenant_id: str):
        """从备份恢复文件"""
        try:
            content = self._get_file_content(backup_key, self.backup_storage.storage_type)
            if not content:
                return None
            
            from io import BytesIO
            file_obj = BytesIO(content)
            filename = Path(backup_key).name
            
            return self.source_storage.upload_file(
                file_obj=file_obj,
                filename=filename,
                folder='restored',
                tenant_id=target_tenant_id,
                is_public=False
            )
        except Exception as e:
            logger.error(f"恢复文件失败: {backup_key}, error={e}")
            return None
    
    def _get_file_content(self, storage_key: str, storage_type: str):
        """获取文件内容（需要根据存储类型实现）"""
        # 实现略，需根据实际存储后端获取文件内容
        return None
```

**修改原因**：实现文件备份与恢复机制，提高数据可靠性。

---

## 4. 文件变更清单

| 序号 | 文件路径 | 操作 | 说明 |
|-----|---------|------|------|
| 1 | `apps/common/services/storage/base.py` | 新建 | 抽象接口和基类 |
| 2 | `apps/common/services/storage/factory.py` | 新建 | 存储工厂 |
| 3 | `apps/common/services/storage/local.py` | 新建 | 本地存储后端 |
| 4 | `apps/common/services/storage/oss.py` | 新建 | OSS 存储后端 |
| 5 | `apps/common/services/storage/lifecycle.py` | 新建 | 生命周期管理 |
| 6 | `apps/common/services/storage/quota.py` | 新建 | 配额管理 |
| 7 | `apps/common/services/storage/monitoring.py` | 新建 | 监控指标 |
| 8 | `apps/common/services/storage/backup.py` | 新建 | 备份管理 |
| 9 | `apps/common/services/storage_service.py` | 修改 | 更新统一存储服务 |
| 10 | `apps/common/services/oss_service.py` | 删除 | 已迁移到新文件 |
| 11 | `apps/common/tasks.py` | 新建 | Celery 定时任务 |
| 12 | `config/celery.py` | 修改 | 添加定时任务配置 |

---

## 5. 测试验证

### 5.1 单元测试

**测试文件**: `tests/common/services/test_storage.py`

```python
import pytest
from io import BytesIO
from unittest.mock import Mock, patch


class TestStorageBackend:
    """存储后端测试"""
    
    def test_upload_file(self):
        """测试文件上传"""
        from apps.common.services.storage.factory import StorageFactory
        backend = StorageFactory.get_backend('local')
        
        content = b'test content'
        file_obj = BytesIO(content)
        
        result = backend.upload_file(
            file_obj=file_obj,
            filename='test.txt',
            folder='test',
            tenant_id='test_tenant',
            content_type='text/plain'
        )
        
        assert len(result) == 4
        assert result[0].startswith('test/')
        assert result[2] == False  # is_duplicate
    
    def test_duplicate_upload(self):
        """测试重复上传去重"""
        from apps.common.services.storage.factory import StorageFactory
        backend = StorageFactory.get_backend('local')
        
        content = b'duplicate content'
        file_obj1 = BytesIO(content)
        file_obj2 = BytesIO(content)
        
        result1 = backend.upload_file(
            file_obj=file_obj1,
            filename='test.txt',
            folder='test',
            tenant_id='test_tenant',
            content_type='text/plain'
        )
        
        result2 = backend.upload_file(
            file_obj=file_obj2,
            filename='test.txt',
            folder='test',
            tenant_id='test_tenant',
            content_type='text/plain'
        )
        
        assert result1[0] == result2[0]
        assert result2[2] == True  # is_duplicate
    
    def test_delete_file(self):
        """测试文件删除"""
        from apps.common.services.storage.factory import StorageFactory
        backend = StorageFactory.get_backend('local')
        
        content = b'test delete'
        file_obj = BytesIO(content)
        
        storage_key, _, _, _ = backend.upload_file(
            file_obj=file_obj,
            filename='test.txt',
            folder='test',
            tenant_id='test_tenant',
            content_type='text/plain'
        )
        
        result = backend.delete_file(storage_key)
        assert result == True


class TestLifecycleManager:
    """生命周期管理测试"""
    
    def test_cleanup_expired_files(self):
        """测试过期文件清理"""
        from apps.common.services.storage.lifecycle import LifecycleManager
        from apps.common.services.storage_service import storage_service
        
        manager = LifecycleManager(storage_service)
        # 测试清理逻辑
        result = manager.cleanup_expired_files()
        # 验证没有异常


class TestQuotaManager:
    """配额管理测试"""
    
    def test_can_upload(self):
        """测试上传权限检查"""
        from apps.common.services.storage.quota import StorageQuotaManager
        
        manager = StorageQuotaManager()
        can_upload, message = manager.can_upload('test_tenant', 1024)
        
        assert can_upload == True
        assert message == ""
```

### 5.2 集成测试

| 测试场景 | 测试步骤 | 预期结果 |
|---------|---------|---------|
| 文件上传 | 上传测试文件，验证返回值 | 返回正确的 storage_key、url、is_duplicate、content_key |
| 重复上传 | 上传相同内容的文件两次 | 第二次返回 is_duplicate=True |
| 文件删除 | 上传文件后删除 | 文件被成功删除 |
| 签名 URL | 获取私有文件的签名 URL | 返回有效的签名 URL |
| 配额检查 | 模拟超出配额 | 返回错误消息 |
| 生命周期 | 创建过期文件，执行清理任务 | 文件被标记为已删除 |

---

## 6. 部署与运维

### 6.1 配置更新

**环境变量配置**:

```bash
# 存储类型
STORAGE_TYPE=oss

# OSS 配置
OSS_ACCESS_KEY_ID=your-access-key
OSS_ACCESS_KEY_SECRET=your-secret
OSS_BUCKET_NAME=your-bucket
OSS_ENDPOINT=oss-cn-shanghai.aliyuncs.com
OSS_DOMAIN=cdn.your-domain.com
OSS_PUBLIC_READ=false

# 默认配额（可选）
DEFAULT_STORAGE_QUOTA=10737418240  # 10GB
```

### 6.2 监控告警配置

**Prometheus 规则**:

```yaml
groups:
  - name: storage_rules
    rules:
      - alert: StorageUsageCritical
        expr: storage_usage_bytes / 10737418240 > 0.95
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "租户存储使用率超过 95%"

      - alert: UploadFailureRateHigh
        expr: rate(storage_upload_failures_total[5m]) / rate(storage_upload_total[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "存储上传失败率超过 10%"
```

### 6.3 备份策略

| 策略类型 | 频率 | 保留周期 | 实现方式 |
|---------|------|---------|---------|
| 增量备份 | 每小时 | 7天 | Celery 定时任务 |
| 全量备份 | 每日 | 30天 | Celery 定时任务 |
| 异地备份 | 每周 | 90天 | 手动触发或定时任务 |

---

## 7. 回滚方案

### 7.1 回滚步骤

1. **停止 Celery 服务**：
   ```bash
   systemctl stop celery-worker
   systemctl stop celery-beat
   ```

2. **恢复旧代码**：
   ```bash
   git checkout apps/common/services/storage_service.py
   git checkout apps/common/services/oss_service.py
   ```

3. **删除新文件**：
   ```bash
   rm -rf apps/common/services/storage/
   rm apps/common/services/storage/quota.py
   rm apps/common/services/storage/lifecycle.py
   rm apps/common/services/storage/monitoring.py
   rm apps/common/services/storage/backup.py
   rm apps/common/tasks.py
   ```

4. **恢复配置**：
   ```bash
   git checkout config/celery.py
   ```

5. **重启服务**：
   ```bash
   systemctl restart gunicorn
   systemctl start celery-worker
   systemctl start celery-beat
   ```

### 7.2 回滚验证

- 验证文件上传功能正常
- 验证文件下载功能正常
- 验证签名 URL 生成正常
- 验证现有数据可正常访问

---

## 8. 实施时间计划

| 阶段 | 时间 | 任务 | 负责人 |
|-----|------|------|------|
| 阶段一 | 第1-2周 | 架构重构、抽象接口、工厂模式 | 后端开发 |
| 阶段二 | 第1-2周 | 配额管理、生命周期、定时任务 | 后端开发 |
| 阶段三 | 第1周 | 监控告警、指标集成 | 运维/后端 |
| 阶段四 | 第1周 | 备份恢复、测试验证 | 后端开发 |

---

## 附录

### A. 代码规范

- 所有新代码遵循 PEP 8 规范
- 使用类型注解
- 添加适当的日志记录
- 编写单元测试

### B. 依赖更新

需要新增的依赖：
- `prometheus-client`（监控指标）

```bash
pip install prometheus-client
```

### C. 数据库迁移

如需要新增字段（如配额字段），需创建迁移文件：

```bash
python manage.py makemigrations accounts
python manage.py migrate
```