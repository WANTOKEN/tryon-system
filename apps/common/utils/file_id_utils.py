"""
File ID 工具函数

设计说明：
- File ID 格式: {UUID}-{storage_type_suffix}
- 后缀标识存储类型，便于前端识别和处理
- 支持本地存储、OSS、TOS 等多种存储后端

存储类型映射：
- 01: local 本地存储
- 02: oss   阿里云 OSS
- 03: tos   火山引擎 TOS
"""

import uuid
import re

# 存储类型后缀常量
STORAGE_TYPE_LOCAL = "01"
STORAGE_TYPE_OSS = "02"
STORAGE_TYPE_TOS = "03"

# 存储类型映射
STORAGE_TYPE_MAP = {
    "01": "local",
    "02": "oss",
    "03": "tos",
}

REVERSE_STORAGE_TYPE_MAP = {
    "local": "01",
    "oss": "02",
    "tos": "03",
}

# File ID 正则表达式
FILE_ID_PATTERN = re.compile(r"^([0-9a-fA-F-]{36})-(\d{2})$")


def generate_file_id(storage_type: str) -> str:
    """
    生成带存储类型标识的文件ID
    
    Args:
        storage_type: 存储类型 (local/oss/tos)
    
    Returns:
        带存储类型后缀的文件ID，如 "71d332de-2344-4edc-8d44-dbb4bf262ae1-01"
    """
    base_uuid = str(uuid.uuid4())
    suffix = REVERSE_STORAGE_TYPE_MAP.get(storage_type.lower(), STORAGE_TYPE_LOCAL)
    return f"{base_uuid}-{suffix}"


def parse_file_id(file_id: str) -> tuple:
    """
    解析文件ID，提取UUID和存储类型
    
    Args:
        file_id: 带存储类型后缀的文件ID
    
    Returns:
        (uuid_str, storage_type) 元组
        
    Raises:
        ValueError: 如果文件ID格式无效
    """
    match = FILE_ID_PATTERN.match(file_id)
    if not match:
        # 兼容旧格式（不带后缀的纯UUID）
        try:
            # 尝试验证是否是有效的UUID
            uuid.UUID(file_id)
            return file_id, None  # 返回None表示未知存储类型
        except ValueError:
            raise ValueError(f"无效的文件ID格式: {file_id}")
    
    uuid_str = match.group(1)
    suffix = match.group(2)
    storage_type = STORAGE_TYPE_MAP.get(suffix)
    
    return uuid_str, storage_type


def get_storage_type_from_file_id(file_id: str) -> str:
    """
    从文件ID中获取存储类型
    
    Args:
        file_id: 文件ID
    
    Returns:
        存储类型 (local/oss/tos)，如果无法识别返回 None
    """
    try:
        _, storage_type = parse_file_id(file_id)
        return storage_type
    except ValueError:
        return None


def get_storage_suffix(storage_type: str) -> str:
    """
    获取存储类型对应的后缀
    
    Args:
        storage_type: 存储类型 (local/oss/tos)
    
    Returns:
        两位数字后缀
    """
    return REVERSE_STORAGE_TYPE_MAP.get(storage_type.lower(), STORAGE_TYPE_LOCAL)


def is_valid_file_id(file_id: str) -> bool:
    """
    验证文件ID是否有效
    
    Args:
        file_id: 文件ID
    
    Returns:
        True 如果有效，False 否则
    """
    try:
        parse_file_id(file_id)
        return True
    except ValueError:
        return False