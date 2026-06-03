"""
图片处理工具

功能特性：
- 图片格式转换（支持 WebP）
- 图片压缩
- 缩略图生成
- 图片信息提取
"""

import io
from typing import Tuple, Dict, Any

try:
    from PIL import Image

    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

from apps.common.exceptions import SystemException


def is_pil_available() -> bool:
    """检查 PIL 是否可用"""
    return PIL_AVAILABLE


def convert_to_webp(image_data: bytes, quality: int = 80) -> bytes:
    """
    将图片转换为 WebP 格式

    Args:
        image_data: 原始图片数据
        quality: 输出质量 (0-100)

    Returns:
        WebP 格式的图片数据

    Raises:
        SystemException: PIL 不可用或转换失败
    """
    if not PIL_AVAILABLE:
        raise SystemException("图片处理库不可用")

    try:
        image = Image.open(io.BytesIO(image_data))

        # 如果是 RGBA，转换为 RGB（WebP 不支持 RGBA）
        if image.mode == "RGBA":
            background = Image.new("RGB", image.size, (255, 255, 255))
            background.paste(image, mask=image.split()[3])
            image = background

        output_buffer = io.BytesIO()
        image.save(output_buffer, format="WebP", quality=quality)
        return output_buffer.getvalue()
    except Exception as e:
        raise SystemException(f"图片转换失败: {str(e)}")


def compress_image(
    image_data: bytes, max_size: int = 1024 * 1024, quality: int = 80, max_width: int = 1920, max_height: int = 1080
) -> bytes:
    """
    压缩图片，保持质量的同时减小文件大小

    Args:
        image_data: 原始图片数据
        max_size: 最大文件大小（字节）
        quality: 输出质量 (0-100)
        max_width: 最大宽度
        max_height: 最大高度

    Returns:
        压缩后的图片数据

    Raises:
        SystemException: PIL 不可用或压缩失败
    """
    if not PIL_AVAILABLE:
        raise SystemException("图片处理库不可用")

    try:
        image = Image.open(io.BytesIO(image_data))

        # 调整尺寸
        width, height = image.size
        if width > max_width or height > max_height:
            ratio = min(max_width / width, max_height / height)
            new_size = (int(width * ratio), int(height * ratio))
            image = image.resize(new_size, Image.Resampling.LANCZOS)

        # 保存为原格式
        output_buffer = io.BytesIO()
        image_format = image.format or "JPEG"

        # 如果是 PNG 且有透明度，保持 PNG 格式
        if image_format == "PNG" and image.mode == "RGBA":
            image.save(output_buffer, format="PNG", optimize=True)
        else:
            # 转换为 RGB 并保存为 JPEG
            if image.mode != "RGB":
                image = image.convert("RGB")
            image.save(output_buffer, format="JPEG", quality=quality, optimize=True)

        compressed_data = output_buffer.getvalue()

        # 如果仍超过大小限制，降低质量
        if len(compressed_data) > max_size and quality > 10:
            return compress_image(
                image_data, max_size, quality=quality - 10, max_width=max_width, max_height=max_height
            )

        return compressed_data
    except Exception as e:
        raise SystemException(f"图片压缩失败: {str(e)}")


def generate_thumbnail(image_data: bytes, size: Tuple[int, int] = (128, 128), crop: bool = False) -> bytes:
    """
    生成缩略图

    Args:
        image_data: 原始图片数据
        size: 缩略图尺寸 (width, height)
        crop: 是否裁剪

    Returns:
        缩略图数据

    Raises:
        SystemException: PIL 不可用或生成失败
    """
    if not PIL_AVAILABLE:
        raise SystemException("图片处理库不可用")

    try:
        image = Image.open(io.BytesIO(image_data))

        if crop:
            # 裁剪为正方形
            width, height = image.size
            min_dim = min(width, height)
            left = (width - min_dim) // 2
            top = (height - min_dim) // 2
            right = left + min_dim
            bottom = top + min_dim
            image = image.crop((left, top, right, bottom))

        # 调整尺寸
        image.thumbnail(size, Image.Resampling.LANCZOS)

        # 如果是 RGBA，转换为 RGB
        if image.mode == "RGBA":
            background = Image.new("RGB", size, (255, 255, 255))
            background.paste(image, mask=image.split()[3] if image.mode == "RGBA" else None)
            image = background

        output_buffer = io.BytesIO()
        image.save(output_buffer, format="JPEG", quality=85)
        return output_buffer.getvalue()
    except Exception as e:
        raise SystemException(f"缩略图生成失败: {str(e)}")


def get_image_info(image_data: bytes) -> Dict[str, Any]:
    """
    获取图片信息

    Args:
        image_data: 图片数据

    Returns:
        图片信息字典

    Raises:
        SystemException: PIL 不可用或解析失败
    """
    if not PIL_AVAILABLE:
        raise SystemException("图片处理库不可用")

    try:
        image = Image.open(io.BytesIO(image_data))

        return {
            "format": image.format,
            "mode": image.mode,
            "size": image.size,
            "width": image.width,
            "height": image.height,
            "channels": len(image.getbands()),
        }
    except Exception as e:
        raise SystemException(f"图片信息解析失败: {str(e)}")


def is_webp_supported() -> bool:
    """
    检查系统是否支持 WebP 格式

    Returns:
        是否支持 WebP
    """
    if not PIL_AVAILABLE:
        return False

    try:
        # 创建一个测试图片并尝试保存为 WebP
        test_image = Image.new("RGB", (100, 100), color="red")
        buffer = io.BytesIO()
        test_image.save(buffer, format="WebP")
        return True
    except Exception:
        return False


def convert_to_format(image_data: bytes, target_format: str = "JPEG", quality: int = 80) -> bytes:
    """
    将图片转换为指定格式

    Args:
        image_data: 原始图片数据
        target_format: 目标格式（JPEG, PNG, WebP, GIF）
        quality: 输出质量 (0-100)

    Returns:
        转换后的图片数据

    Raises:
        SystemException: PIL 不可用或转换失败
    """
    if not PIL_AVAILABLE:
        raise SystemException("图片处理库不可用")

    try:
        image = Image.open(io.BytesIO(image_data))
        target_format = target_format.upper()

        output_buffer = io.BytesIO()

        # 根据目标格式处理
        if target_format == "JPEG":
            # JPEG 不支持透明度，需要转换
            if image.mode != "RGB":
                image = image.convert("RGB")
            image.save(output_buffer, format="JPEG", quality=quality, optimize=True)

        elif target_format == "PNG":
            image.save(output_buffer, format="PNG", optimize=True)

        elif target_format == "WEBP":
            if image.mode == "RGBA":
                background = Image.new("RGB", image.size, (255, 255, 255))
                background.paste(image, mask=image.split()[3])
                image = background
            image.save(output_buffer, format="WebP", quality=quality)

        elif target_format == "GIF":
            image.save(output_buffer, format="GIF")

        else:
            raise ValueError(f"不支持的目标格式: {target_format}")

        return output_buffer.getvalue()
    except Exception as e:
        raise SystemException(f"图片格式转换失败: {str(e)}")
