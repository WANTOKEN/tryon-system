"""
虚拟试穿引擎抽象层

- MockEngine：演示模式，直接以人像作为输入源产出「结果图」（本地可用，无需外部 API）。
- RealEngine：接入火山引擎 Ark 图像生成 API，使用「多图融合」能力——
  将人像 + 多张服装参考图以 base64 形式上传，配合提示词生成试穿结果图。

引擎只负责「生成结果图字节流」，存储与状态机由 tryon_service 负责。
"""
import base64
from abc import ABC, abstractmethod
from typing import List, Optional
import httpx

from app.core.config import get_settings

settings = get_settings()


def _detect_mime(data: bytes) -> str:
    """根据文件头推断图片 MIME 类型"""
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data[:2] == b"BM":
        return "image/bmp"
    return "image/png"


def _to_data_uri(data: bytes, mime: Optional[str] = None) -> str:
    """将图片字节流编码为 base64 data URI（满足 API 的 base64 上传要求）"""
    mime = mime or _detect_mime(data)
    encoded = base64.b64encode(data).decode("ascii")
    return f"data:{mime};base64,{encoded}"


class TryOnEngine(ABC):
    @abstractmethod
    async def generate(
        self,
        avatar_bytes: bytes,
        clothing_items: List[dict],
        prompt: Optional[str] = None,
    ) -> bytes:
        """返回试穿结果图字节流

        clothing_items: list[dict]，每项可包含：
          - image_bytes: 服装图字节流（优先，base64 上传）
          - image_url:   服装图可访问 URL（可选）
          - uuid / name: 仅用于日志与调试
        """
        raise NotImplementedError


class MockEngine(TryOnEngine):
    """演示引擎：直接复用上传的人像作为结果（保证端到端闭环可运行）"""

    async def generate(
        self,
        avatar_bytes: bytes,
        clothing_items: List[dict],
        prompt: Optional[str] = None,
    ) -> bytes:
        # 真实接入时，这里替换为调用虚拟试穿模型/API
        return avatar_bytes


class RealEngine(TryOnEngine):
    """真实引擎：火山引擎 Ark 多图融合图生图

    仅使用各模型通用参数（model/prompt/image/size/response_format/watermark），
    避免传入 5.0 Pro 不支持的 sequential_image_generation / stream / tools 等字段，
    保证跨模型兼容。
    """

    def __init__(self) -> None:
        if not settings.ark_api_key:
            raise RuntimeError("未配置 ark_api_key，无法使用真实试穿引擎")
        self.model = settings.ark_model
        self.size = settings.ark_size
        self.response_format = settings.ark_response_format
        self.watermark = settings.ark_watermark
        self.output_format = settings.ark_output_format
        self.max_ref_images = settings.ark_max_ref_images
        self.default_prompt = settings.ark_prompt
        self.timeout = settings.ark_timeout
        self.endpoint = f"{settings.ark_base_url.rstrip('/')}/images/generations"

    def _build_images(self, avatar_bytes: bytes, clothing_items: List[dict]) -> List[str]:
        """组装参考图列表（人像 + 服装），均以 base64 data URI 上传"""
        images: List[str] = [_to_data_uri(avatar_bytes)]
        for item in clothing_items or []:
            if item.get("image_bytes"):
                images.append(_to_data_uri(item["image_bytes"]))
            elif item.get("image_url"):
                images.append(item["image_url"])
        if len(images) > self.max_ref_images:
            raise ValueError(
                f"参考图数量（{len(images)}）超过模型上限 {self.max_ref_images}，"
                f"请减少服装参考图数量。"
            )
        return images

    async def generate(
        self,
        avatar_bytes: bytes,
        clothing_items: List[dict],
        prompt: Optional[str] = None,
    ) -> bytes:
        images = self._build_images(avatar_bytes, clothing_items)
        payload: dict = {
            "model": self.model,
            "prompt": prompt or self.default_prompt,
            "image": images,
            "size": self.size,
            "response_format": self.response_format,
            "watermark": self.watermark,
        }
        # output_format 仅 5.0 系列支持，且需用户显式配置
        if self.output_format and "5.0" in self.model:
            payload["output_format"] = self.output_format

        headers = {
            "Authorization": f"Bearer {settings.ark_api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(self.endpoint, json=payload, headers=headers)
            if resp.status_code != 200:
                message = self._extract_error(resp)
                raise RuntimeError(
                    f"图像生成 API 调用失败 [{resp.status_code}]: {message}"
                )
            data = resp.json()

        first = (data.get("data") or [{}])[0]
        if "error" in first:
            err = first["error"] or {}
            raise RuntimeError(
                f"图像生成失败 [{err.get('code')}]: {err.get('message')}"
            )

        if self.response_format == "b64_json":
            return base64.b64decode(first["b64_json"])

        url = first.get("url")
        if not url:
            raise RuntimeError("图像生成返回缺少 url 字段")
        # url 24 小时内有效，及时下载结果图字节流
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            img_resp = await client.get(url)
            img_resp.raise_for_status()
            return img_resp.content

    @staticmethod
    def _extract_error(resp: httpx.Response) -> str:
        try:
            body = resp.json()
            return body.get("error", {}).get("message") or resp.text
        except Exception:  # noqa: BLE001
            return resp.text


def get_engine() -> TryOnEngine:
    if settings.ai_engine == "real":
        return RealEngine()
    return MockEngine()
