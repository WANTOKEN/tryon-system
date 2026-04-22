# -*- coding: utf-8 -*-
"""
上传验证配置

允许的文件类型和大小限制
"""

# ============ 上传限制配置 ============
# 允许上传的图片类型（相机拍照常见格式）
ALLOWED_IMAGE_TYPES = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/heic': '.heic',   # iPhone 拍照格式
    'image/heif': '.heif',   # iPhone 拍照格式
}

# 最大文件大小：30MB（支持高清拍照、ProRAW 等）
MAX_FILE_SIZE = 30 * 1024 * 1024  # 30MB

# 允许的扩展名
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'}


class UploadValidationError(Exception):
    """上传验证错误"""
    pass
