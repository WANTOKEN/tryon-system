"""
AI 图片处理服务
用于自动修图，将商家上传的图片处理成白底或更适合商品标准的服装图片
"""

import os
import logging
import requests
from io import BytesIO
from typing import Optional, Tuple
from PIL import Image, ImageFilter, ImageEnhance

logger = logging.getLogger("ai_image")


class AIImageService:
    """
    AI 图片处理服务

    功能:
    - 自动去除背景，生成白底图
    - 图片增强（亮度、对比度、饱和度）
    - 图片裁剪和缩放
    - 支持多种 AI 引擎（可选）
    """

    def __init__(self):
        self.enabled = self._check_config()
        self.api_key = os.getenv("AI_IMAGE_API_KEY", "")
        self.api_url = os.getenv("AI_IMAGE_API_URL", "")

    def _check_config(self) -> bool:
        """检查配置是否完整"""
        # 如果没有配置 AI API，使用本地处理
        return True

    def process_clothing_image(
        self,
        image_data: bytes,
        remove_background: bool = True,
        enhance: bool = True,
        output_size: Tuple[int, int] = (800, 800),
    ) -> bytes:
        """
        处理服装图片

        Args:
            image_data: 原始图片数据
            remove_background: 是否去除背景
            enhance: 是否增强图片
            output_size: 输出尺寸

        Returns:
            处理后的图片数据
        """
        try:
            # 打开图片
            image = Image.open(BytesIO(image_data))

            # 转换为 RGB 模式
            if image.mode == "RGBA":
                # 如果有透明通道，先处理透明背景
                if remove_background:
                    image = self._remove_background_simple(image)
                else:
                    # 创建白色背景
                    background = Image.new("RGB", image.size, (255, 255, 255))
                    background.paste(image, mask=image.split()[3] if len(image.split()) == 4 else None)
                    image = background
            elif image.mode != "RGB":
                image = image.convert("RGB")

            # 图片增强
            if enhance:
                image = self._enhance_image(image)

            # 调整尺寸
            image = self._resize_image(image, output_size)

            # 保存为 JPEG
            output = BytesIO()
            image.save(output, format="JPEG", quality=95, optimize=True)
            output.seek(0)

            return output.read()

        except Exception as e:
            logger.error(f"[AIImage] 图片处理失败: {e}")
            # 返回原始图片
            return image_data

    def _remove_background_simple(self, image: Image.Image) -> Image.Image:
        """
        简单的背景去除（基于颜色）

        对于复杂的背景去除，建议使用专业的 AI 服务如：
        - remove.bg API
        - 阿里云图片智能分割
        - 腾讯云图像分割
        """
        # 转换为 RGB
        if image.mode == "RGBA":
            # 获取 alpha 通道
            r, g, b, a = image.split()

            # 创建白色背景
            background = Image.new("RGB", image.size, (255, 255, 255))

            # 将原图粘贴到白色背景上，使用 alpha 通道作为蒙版
            background.paste(image, mask=a)

            return background
        else:
            return image.convert("RGB")

    def _enhance_image(self, image: Image.Image) -> Image.Image:
        """
        图片增强

        - 调整亮度
        - 调整对比度
        - 调整饱和度
        - 锐化
        """
        # 增强亮度（稍微提亮）
        enhancer = ImageEnhance.Brightness(image)
        image = enhancer.enhance(1.1)

        # 增强对比度
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(1.2)

        # 增强饱和度
        enhancer = ImageEnhance.Color(image)
        image = enhancer.enhance(1.1)

        # 轻微锐化
        image = image.filter(ImageFilter.SHARPEN)

        return image

    def _resize_image(
        self, image: Image.Image, target_size: Tuple[int, int], maintain_aspect: bool = True
    ) -> Image.Image:
        """
        调整图片尺寸

        Args:
            image: 原始图片
            target_size: 目标尺寸
            maintain_aspect: 是否保持宽高比

        Returns:
            调整后的图片
        """
        if maintain_aspect:
            # 计算缩放比例
            width, height = image.size
            target_width, target_height = target_size

            # 计算缩放比例
            ratio = min(target_width / width, target_height / height)
            new_width = int(width * ratio)
            new_height = int(height * ratio)

            # 缩放图片
            image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)

            # 创建白色背景
            background = Image.new("RGB", target_size, (255, 255, 255))

            # 居中粘贴
            paste_x = (target_width - new_width) // 2
            paste_y = (target_height - new_height) // 2
            background.paste(image, (paste_x, paste_y))

            return background
        else:
            return image.resize(target_size, Image.Resampling.LANCZOS)

    def remove_background_with_api(self, image_data: bytes) -> Optional[bytes]:
        """
        使用 API 去除背景（需要配置 API）

        支持的 API:
        - remove.bg
        - 阿里云图片智能分割
        - 腾讯云图像分割
        """
        if not self.api_key or not self.api_url:
            logger.warning("[AIImage] 未配置 API，使用本地处理")
            return None

        try:
            # 调用 API
            response = requests.post(
                self.api_url,
                files={"image_file": ("image.jpg", image_data)},
                data={"size": "auto"},
                headers={"X-Api-Key": self.api_key},
                timeout=30,
            )

            if response.status_code == 200:
                return response.content
            else:
                logger.error(f"[AIImage] API 调用失败: {response.status_code}")
                return None

        except Exception as e:
            logger.error(f"[AIImage] API 调用异常: {e}")
            return None


# 全局单例
ai_image_service = AIImageService()
