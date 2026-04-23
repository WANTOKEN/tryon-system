"""
内容寻址 Key 工具

基于文件内容 MD5 生成唯一 Key，实现：
- 相同内容 = 相同 Key = 只存一份（真正去重）
- Key 带存储类型前缀，精确查找
- 通用工具，支持任意模块复用

Key 格式: "{storage_type}:{md5}"
- local:a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
- oss:a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
"""
import os
import hashlib
import logging
from typing import Optional, Tuple

from apps.common.constants import (
    ContentKeyPrefix,
    ContentKeyFormat,
    StorageType,
    ErrorMessage,
    DefaultValue,
)

logger = logging.getLogger('common')


class ContentKey:
    """
    内容寻址 Key 工具类
    
    用法:
        # 生成 Key
        key = ContentKey.from_content(file_content, storage_type='local')
        # -> "local:a1b2c3d4..."
        
        # 解析 Key
        storage_type, md5 = ContentKey.parse(key)
        # -> ('local', 'a1b2c3d4...')
        
        # 验证 Key
        if ContentKey.is_valid(key):
            ...
        
        # 解析为 URL
        url = ContentKey.resolve_to_url(key, tenant_id='xxx')
    """
    
    # 使用常量
    STORAGE_TYPES = ContentKeyPrefix.ALL
    SEPARATOR = ContentKeyPrefix.SEPARATOR
    MD5_LENGTH = ContentKeyFormat.MD5_LENGTH
    
    @classmethod
    def from_content(cls, content: bytes, storage_type: str = None) -> str:
        """
        基于文件内容生成 Key
        
        Args:
            content: 文件内容（字节）
            storage_type: 存储类型，默认从环境变量读取
            
        Returns:
            带前缀的 Key，如 "local:a1b2c3d4..."
        """
        if not content:
            return ''
        
        # 计算MD5
        md5 = hashlib.md5(content).hexdigest()
        
        # 获取存储类型
        if not storage_type:
            storage_type = os.getenv('STORAGE_TYPE', DefaultValue.STORAGE_TYPE).lower()
        
        return f"{storage_type}{cls.SEPARATOR}{md5}"
    
    @classmethod
    def from_md5(cls, md5: str, storage_type: str = None) -> str:
        """
        基于已有 MD5 生成 Key
        
        Args:
            md5: MD5 哈希值（32位）
            storage_type: 存储类型
            
        Returns:
            带前缀的 Key
        """
        if not md5 or len(md5) != cls.MD5_LENGTH:
            return ''
        
        if not storage_type:
            storage_type = os.getenv('STORAGE_TYPE', DefaultValue.STORAGE_TYPE).lower()
        
        return f"{storage_type}{cls.SEPARATOR}{md5}"
    
    @classmethod
    def parse(cls, key: str) -> Tuple[Optional[str], Optional[str]]:
        """
        解析 Key，提取存储类型和 MD5
        
        Args:
            key: 带前缀的 Key
            
        Returns:
            (storage_type, md5)，无效返回 (None, None)
        """
        if not key or cls.SEPARATOR not in key:
            return None, None
        
        parts = key.split(cls.SEPARATOR, 1)
        if len(parts) != 2:
            return None, None
        
        storage_type, md5 = parts
        
        # 验证存储类型
        if not ContentKeyPrefix.is_valid(storage_type):
            return None, None
        
        # 验证 MD5 格式
        if not ContentKeyFormat.is_valid_md5(md5):
            return None, None
        
        return storage_type, md5.lower()
    
    @classmethod
    def is_valid(cls, key: str) -> bool:
        """
        验证 Key 格式是否有效
        
        Args:
            key: 待验证的 Key
            
        Returns:
            是否有效
        """
        storage_type, md5 = cls.parse(key)
        return storage_type is not None and md5 is not None
    
    @classmethod
    def get_storage_type(cls, key: str) -> Optional[str]:
        """获取 Key 的存储类型"""
        storage_type, _ = cls.parse(key)
        return storage_type
    
    @classmethod
    def get_md5(cls, key: str) -> Optional[str]:
        """获取 Key 的 MD5 部分"""
        _, md5 = cls.parse(key)
        return md5
    
    @classmethod
    def resolve_to_url(cls, key: str, tenant_id: str = None) -> Optional[str]:
        """
        解析 Key 为可访问的 URL
        
        支持跨存储类型查找：
        - 如果 key 是 local:xxx，但系统配置为 OSS，会尝试迁移
        - 如果精确查找失败，会尝试另一种存储类型
        
        Args:
            key: 带前缀的 Key
            tenant_id: 租户 ID
            
        Returns:
            可访问的 URL，找不到返回 None
        """
        storage_type, md5 = cls.parse(key)
        if not storage_type or not md5:
            return None
        
        if not tenant_id:
            return None
        
        try:
            from apps.common.models import FileUploadRecord
            from apps.common.utils.url_utils import get_full_url
            import os
            
            current_storage = os.getenv('STORAGE_TYPE', 'local').lower()
            
            print(f"[ContentKey] 查询参数: md5={md5}, tenant_id={tenant_id}, storage_type={storage_type}, current_storage={current_storage}")
            
            # 1. 精确查找
            record = FileUploadRecord.get_by_md5(
                md5,
                tenant_id=tenant_id,
                storage_type=storage_type
            )
            
            print(f"[ContentKey] 精确查找结果: record={record}")
            
            if record:
                # 找到记录，调用 get_full_url（会自动处理迁移）
                return get_full_url(record.access_url)
            
            # 2. 精确查找失败，尝试另一种存储类型（可能已迁移）
            other_storage = 'oss' if storage_type == 'local' else 'local'
            record = FileUploadRecord.get_by_md5(
                md5,
                tenant_id=tenant_id,
                storage_type=other_storage
            )
            
            print(f"[ContentKey] 备选查找结果 (storage={other_storage}): record={record}")
            
            if record:
                # 找到记录，调用 get_full_url
                return get_full_url(record.access_url)
            
            # 3. 都找不到，返回 None
            print(f"[ContentKey] 未找到记录: md5={md5}")
            return None
                
        except Exception as e:
            logger.warning(f"[ContentKey] 解析失败: key={key}, error={e}")
            print(f"[ContentKey] 解析失败详情: key={key}, error={e}")
        
        return None
    
    @classmethod
    def resolve_or_raise(cls, key: str, tenant_id: str = None, resource_name: str = '资源') -> str:
        """
        解析 Key 为 URL，找不到时抛出异常
        
        Args:
            key: 带前缀的 Key
            tenant_id: 租户 ID
            resource_name: 资源名称（用于错误信息）
            
        Returns:
            可访问的 URL
            
        Raises:
            ResourceNotFoundException: 找不到资源
        """
        url = cls.resolve_to_url(key, tenant_id)
        
        if not url:
            from apps.common.exceptions import ResourceNotFoundException
            raise ResourceNotFoundException(f'{resource_name}（Key 未找到，请重新上传）')
        
        return url


# 便捷函数
def make_content_key(content: bytes, storage_type: str = None) -> str:
    """生成内容 Key"""
    return ContentKey.from_content(content, storage_type)


def make_md5_key(md5: str, storage_type: str = None) -> str:
    """基于 MD5 生成 Key"""
    return ContentKey.from_md5(md5, storage_type)


def parse_content_key(key: str) -> Tuple[Optional[str], Optional[str]]:
    """解析内容 Key"""
    return ContentKey.parse(key)


def is_valid_content_key(key: str) -> bool:
    """验证内容 Key"""
    return ContentKey.is_valid(key)


def resolve_content_key(key: str, tenant_id: str = None) -> Optional[str]:
    """解析内容 Key 为 URL"""
    return ContentKey.resolve_to_url(key, tenant_id)
