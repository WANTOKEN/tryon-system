"""
虚拟试穿引擎抽象层

- MockEngine：演示模式，直接以人像作为输入源产出「结果图」（本地可用，无需外部 API）。
- RealEngine：接入豆包 Seedream（LAS）多图融合能力——
  将人像 + 多张服装参考图以 base64 形式上传，配合提示词生成试穿结果图。

引擎只负责「生成结果图字节流」，存储与状态机由 tryon_service 负责。
"""
import asyncio
import base64
from abc import ABC, abstractmethod
from typing import List, Optional
import httpx
from urllib.parse import urlparse

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
    """真实引擎：豆包 Seedream（LAS）多图融合图生图

    按豆包 Seedream 多图融合接口调用：
    - POST {las_base_url}/api/v1/images/generations
    - Headers: Authorization: Bearer $las_api_key
    - Body: {model, prompt, image:[person_b64, garment_b64], size, response_format:"url"}
    - 返回 data[0].url 为结果图 URL，需下载后保存到本地存储

    注意：
    - 未配置 las_api_key 时实例化即抛错
    - 引擎超时 engine_timeout=60s；总耗时受 task_overall_timeout=180s 约束
    - 同步 httpx 调用经 asyncio.to_thread 在线程池执行，避免阻塞事件循环
    """

    _DEFAULT_PROMPT = (
        "保持图中人物的面容、发型、姿态与背景不变，仅将其服装更换为参考图中的服装，"
        "真实摄影风格，高清细节，自然光照。"
    )

    def __init__(self, model: Optional[str] = None, api_key: Optional[str] = None) -> None:
        self.api_key = api_key or settings.las_api_key
        if not self.api_key:
            raise RuntimeError("未配置 API 密钥（las_api_key / 系统设置 ai_api_key），无法使用真实试穿引擎（豆包 Seedream）")
        self.endpoint = f"{settings.las_base_url.rstrip('/')}/api/v1/images/generations"
        self.model = model or settings.engine_model
        self.size = settings.las_size
        self.response_format = settings.las_response_format
        self.watermark = settings.las_watermark
        self.max_ref_images = settings.las_max_ref_images
        self.default_prompt = settings.ark_prompt or self._DEFAULT_PROMPT
        self.timeout = settings.engine_timeout
        self.result_allowed_host = settings.las_result_allowed_host
        self.result_download_timeout = settings.las_result_download_timeout
        self.max_bytes = settings.upload_max_size_mb * 1024 * 1024

    def _build_images(self, avatar_bytes: bytes, clothing_items: List[dict]) -> List[str]:
        """组装参考图列表（人像 + 服装），均以 base64 data URI 上传。

        成本控制：Seedream 计费按「生成张数 × 单价」，与参考图数量无关。
        但 base64 上传量随服装图数量线性增长，单请求 payload 过大易触发超时。
        此处限制服装参考图 ≤ max_ref_images-1（预留人像），超出按上传顺序截断并记录。
        """
        images: List[str] = [_to_data_uri(avatar_bytes)]
        cap = max(1, self.max_ref_images - 1)  # 至少留 1 张给人像
        kept = 0
        for item in clothing_items or []:
            if kept >= cap:
                break
            if item.get("image_bytes"):
                images.append(_to_data_uri(item["image_bytes"]))
                kept += 1
            elif item.get("image_url"):
                images.append(item["image_url"])
                kept += 1
        if len(clothing_items or []) > cap:
            import logging

            logging.getLogger(__name__).info(
                "服装参考图 %d 张截断到 %d（max_ref_images=%d）",
                len(clothing_items or []), cap, self.max_ref_images,
            )
        return images

    async def generate(
        self,
        avatar_bytes: bytes,
        clothing_items: List[dict],
        prompt: Optional[str] = None,
    ) -> bytes:
        # 同步调用在线程池执行，避免阻塞事件循环
        return await asyncio.to_thread(
            self._generate_sync, avatar_bytes, clothing_items, prompt
        )

    def _generate_sync(
        self,
        avatar_bytes: bytes,
        clothing_items: List[dict],
        prompt: Optional[str],
    ) -> bytes:
        images = self._build_images(avatar_bytes, clothing_items)
        payload: dict = {
            "model": self.model,
            "prompt": prompt or self.default_prompt,
            "image": images,
            "size": self.size,
            "response_format": self.response_format,
            "watermark": self.watermark,
            # 4.5/5.0 系列：明确只生成 1 张，避免默认生成多张按 N 倍计费
            "n": 1,
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        # 1) 调用生成接口
        try:
            with httpx.Client(timeout=self.timeout, follow_redirects=True) as client:
                r = client.post(self.endpoint, json=payload, headers=headers)
                if r.status_code == 429:
                    raise RuntimeError("图像生成 API 限流（429），请稍后重试")
                if r.status_code >= 500:
                    raise RuntimeError(f"图像生成 API 服务端错误 [{r.status_code}]")
                if r.status_code >= 400:
                    raise RuntimeError(
                        f"图像生成 API 调用失败 [{r.status_code}] {r.text[:200]}"
                    )
                data = r.json()
        except httpx.TimeoutException as e:
            raise RuntimeError("图像生成 API 超时") from e
        except httpx.RequestError as e:
            raise RuntimeError(f"图像生成 API 网络异常: {e}") from e

        # 2) 解析结果 URL
        try:
            result_url = data["data"][0]["url"]
        except (KeyError, IndexError, TypeError):
            raise RuntimeError(f"图像生成返回结果异常: {str(data)[:200]}")

        # 3) 下载结果图保存到本地（SSRF 防护）
        parsed = urlparse(result_url)
        host = (parsed.hostname or "").lower()
        allowed_host = self.result_allowed_host.lower()
        if not (host == allowed_host or host.endswith(".volces.com")):
            raise RuntimeError(f"结果 URL 主机不被允许: {host}")

        try:
            with httpx.Client(timeout=self.result_download_timeout, follow_redirects=False) as client:
                with client.stream("GET", result_url) as r:
                    r.raise_for_status()
                    ctype = r.headers.get("content-type", "") or ""
                    if not ctype.startswith("image/"):
                        raise RuntimeError(f"结果非图片类型: {ctype}")
                    buf = bytearray()
                    for chunk in r.iter_bytes(chunk_size=65536):
                        buf.extend(chunk)
                        if len(buf) > self.max_bytes:
                            raise RuntimeError("结果图下载超出大小限制")
                    return bytes(buf)
        except httpx.HTTPError as e:
            raise RuntimeError(f"下载结果图失败: {e}") from e


def get_engine(ai_engine: Optional[str] = None, model: Optional[str] = None, api_key: Optional[str] = None) -> TryOnEngine:
    engine = ai_engine or settings.ai_engine
    if engine in ("real", "seeddance"):
        try:
            return RealEngine(model=model, api_key=api_key)
        except RuntimeError:
            # 未配置密钥时优雅降级到演示引擎，避免试穿整体不可用
            return MockEngine()
    return MockEngine()

