# -*- coding: utf-8 -*-
"""
上传验证配置

从 constants 导入配置，确保一致性
"""

from apps.common.constants import FileType, FileExtension, FileSizeLimit

# ============ 上传限制配置 ============

# 允许上传的图片类型（MIME Type -> 扩展名）
ALLOWED_IMAGE_TYPES = FileType.EXTENSIONS

# 最大文件大小
MAX_FILE_SIZE = FileSizeLimit.MAX_FILE_SIZE

# 允许的扩展名
ALLOWED_EXTENSIONS = set(FileExtension.ALL)


class UploadValidationError(Exception):
    """上传验证错误"""

    pass
