"""
SeedDance/SeedDream AI 试穿引擎
字节跳动/火山引擎豆包虚拟试穿能力

使用 OpenAI 兼容接口调用火山引擎 ARK 平台
文档: https://www.volcengine.com/docs/82379/1298299
"""

import os
import time
import uuid
import json
import logging
from typing import Dict, Any, Optional, List

import requests
from openai import OpenAI

from .base import BaseAIEngine
from .circuit_breaker import CircuitBreaker
from apps.common.exceptions import AIEngineException
from apps.common.utils.trace_context import get_trace_id, TraceContext
from apps.common.services.storage_service import StorageService

logger = logging.getLogger("ai_engines")


class SeedDanceEngine(BaseAIEngine):
    """
    SeedDance/SeedDream 虚拟试衣引擎 (火山引擎豆包)

    使用 Doubao SeedDream 模型实现虚拟试穿

    配置环境变量:
    - ARK_API_KEY: 火山引擎 ARK API Key
      获取地址: https://console.volcengine.com/ark/region:ark+cn-beijing/apikey
    - ARK_BASE_URL: API 端点 (默认: https://ark.cn-beijing.volces.com/api/v3)
    - ARK_MODEL_ID: 模型 ID (默认: doubao-seedream-5-0-260128)
    """

    name = "seeddance"
    display_name = "字节跳动 SeedDream"

    # API 配置
    DEFAULT_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3"
    # DEFAULT_MODEL_ID = 'doubao-seedream-4-0-250828'
    DEFAULT_MODEL_ID = "doubao-seedream-5-0-lite-260128"
    DEFAULT_REGION = "cn-beijing"

    # 请求配置
    REQUEST_TIMEOUT = 60  # 秒 (图像生成可能较慢)
    POLL_INTERVAL = 5  # 轮询间隔秒
    MAX_POLL_TIME = 300  # 最大轮询时间秒 (5分钟)

    def __init__(self):
        self.api_key = os.getenv("ARK_API_KEY", "")
        self.base_url = os.getenv("ARK_BASE_URL", self.DEFAULT_BASE_URL)
        self.model_id = os.getenv("ARK_MODEL_ID", self.DEFAULT_MODEL_ID)
        self.circuit_breaker = CircuitBreaker(self.name)

        # OpenAI 兼容客户端
        self._client = None

    @property
    def client(self) -> OpenAI:
        """延迟初始化 OpenAI 客户端"""
        if self._client is None:
            self._client = OpenAI(
                base_url=self.base_url,
                api_key=self.api_key,
                timeout=self.REQUEST_TIMEOUT,
            )
        return self._client

    def validate_config(self) -> bool:
        """验证配置是否完整"""
        if not self.api_key:
            logger.warning(f"[{self.name}] 配置不完整: " f"ARK_API_KEY={'已配置' if self.api_key else '缺失'}")
            return False
        return True

    def _execute_with_circuit_breaker(self, operation: str, func, *args, **kwargs) -> Any:
        """
        带熔断保护的执行

        Args:
            operation: 操作名称 (用于日志)
            func: 要执行的函数
            *args, **kwargs: 函数参数

        Returns:
            函数返回值

        Raises:
            AIEngineException: 执行失败
        """
        if not self.validate_config():
            raise AIEngineException(f"{self.display_name} 引擎配置不完整")

        # 检查熔断器
        if self.circuit_breaker.is_open():
            raise AIEngineException(f"{self.display_name} 引擎已熔断，请稍后重试")

        try:
            result = func(*args, **kwargs)
            self.circuit_breaker.record_success()
            return result

        except Exception as e:
            self.circuit_breaker.record_failure()

            # 解析错误信息
            error_msg = str(e)
            if hasattr(e, "response"):
                try:
                    error_data = e.response.json()
                    error_msg = error_data.get("error", {}).get("message", error_msg)
                except:
                    pass

            logger.error(f"[{self.name}] {operation} 失败: {error_msg}")
            raise AIEngineException(f"{self.display_name} {operation}失败: {error_msg}")

    def submit_task(
        self,
        avatar_url: str,
        clothing_urls: List[str],
        prompt: Optional[str] = None,
        clothing_info: Optional[List[Dict]] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        """
        提交试穿任务

        Args:
            avatar_url: 人物照片 URL (图1)
            clothing_urls: 服装图片 URL 列表 (图2)
            prompt: 自定义提示词 (可选)
            clothing_info: 服装信息列表，每项包含 category, subcategory 等
            **kwargs: 额外参数
                - size: 输出尺寸 "1K" | "2K" (默认: "2K")
                - watermark: 是否添加水印 (默认: False)
                - output_format: 输出格式 "png" | "jpg" | "webp" (默认: "png")
                - tenant_id: 租户 ID

        Returns:
            {'task_id': str, 'success': bool, 'error_message': str, 'result_url': str, 'trace_id': str}
        """
        # 从上下文获取追踪 ID
        trace_id = get_trace_id()

        # 兼容处理：确保 clothing_urls 是列表
        if isinstance(clothing_urls, str):
            clothing_urls = [clothing_urls]

        if not clothing_urls:
            return {
                "task_id": "",
                "success": False,
                "error_message": "服装图片不能为空",
                "result_url": "",
            }

        # 验证所有 URL 必须是公网可访问的在线链接
        try:
            self._validate_all_urls(avatar_url, clothing_urls)
        except ValueError as e:
            error_msg = str(e)
            logger.error(f"[{self.name}] URL 验证失败: {error_msg}")
            return {
                "task_id": "",
                "success": False,
                "error_message": error_msg,
                "result_url": "",
            }

        try:
            images = [avatar_url] + clothing_urls
            prompt = "保留人物原有姿态、表情与背景，将参考服装精准穿戴在对应身体部位，上下装衔接自然，衣物贴合身形，褶皱、光影真实自然，整体搭配协调。"

            # 获取可选参数
            biz_size = kwargs.get("size", "2K")
            watermark = kwargs.get("watermark", False)
            sequential = kwargs.get("sequential_image_generation", "disabled")

            # 构建请求参数
            request_params = {
                "model": self.model_id,
                "prompt": prompt,
                "width": 1024,
                "height": 1024,
                "response_format": "url",
                "extra_body": {
                    "image": images,
                    "watermark": watermark,
                    "sequential_image_generation": sequential,
                    "steps": 20,
                    "cfg_scale": 7.5,
                },
            }

            logger.info(
                f"[{self.name}] [{trace_id}] API 入参: {json.dumps(request_params, ensure_ascii=False, indent=2)}"
            )

            def _call_api():
                response = self.client.images.generate(
                    model=self.model_id,
                    prompt=prompt,
                    size=biz_size,
                    response_format="url",
                    extra_body={
                        "image": images,
                        "watermark": watermark,
                        "sequential_image_generation": sequential,
                    },
                )
                return response

            response = self._execute_with_circuit_breaker("生成试穿图像", _call_api)

            # 记录返回参数
            result_url = ""
            if response.data and len(response.data) > 0:
                result_url = response.data[0].url
                response_info = {"url": result_url, "data_count": len(response.data)}
            else:
                response_info = {"data": None}
            logger.info(
                f"[{self.name}] [{trace_id}] API 返回: {json.dumps(response_info, ensure_ascii=False, indent=2)}"
            )

            # 检查结果 URL
            if not result_url:
                return {
                    "task_id": "",
                    "success": False,
                    "error_message": "AI 引擎未返回结果图片",
                    "result_url": "",
                }

            # 生成任务 ID (用于追踪)
            task_id = f"seed_{uuid.uuid4().hex[:16]}_{int(time.time())}"

            logger.info(f"[{self.name}] [{trace_id}] 任务完成: task_id={task_id}, result_url={result_url}")

            # 立即返回原始 URL 给前端预览（不等待存储）
            # 后台异步存储结果图片
            self._async_store_result(
                result_url=result_url,
                task_id=task_id,
                trace_id=trace_id,
                tenant_id=kwargs.get("tenant_id", "default"),
            )

            return {
                "task_id": task_id,
                "success": True,
                "error_message": "",
                "result_url": result_url,  # 立即返回原始 URL，不等待存储
                "result_key": "",  # 异步存储后更新
                "original_url": result_url,
                "processing_time": 0,
                "trace_id": trace_id,
            }

        except AIEngineException as e:
            return {
                "task_id": "",
                "success": False,
                "error_message": e.internal_message,
                "result_url": "",
            }
        except Exception as e:
            logger.exception(f"[{self.name}] 未预期的错误: {e}")
            return {
                "task_id": "",
                "success": False,
                "error_message": f"内部错误: {str(e)}",
                "result_url": "",
            }

    def query_task_status(self, task_id: str) -> Dict[str, Any]:
        """
        查询任务状态

        由于 SeedDream API 是同步返回结果，
        此方法主要用于配合 submit_task 返回的 result_url

        Args:
            task_id: 任务 ID

        Returns:
            {
                'status': 'pending' | 'processing' | 'completed' | 'failed',
                'result_url': str,
                'progress': int (0-100),
                'error_message': str,
                'processing_time': float
            }
        """
        # SeedDream 是同步 API，任务提交时已完成
        # task_id 格式: seed_{uuid}_{timestamp}
        if task_id.startswith("seed_"):
            # 如果有缓存的结果，从缓存获取
            from django.core.cache import cache

            cached = cache.get(f"ai:seeddream:{task_id}")
            if cached:
                return {
                    "status": "completed",
                    "progress": 100,
                    "result_url": cached.get("result_url", ""),
                    "error_message": "",
                    "processing_time": 0,
                }

            # 没有缓存，返回处理中状态
            # 实际应用中，submit_task 会直接返回结果，不会走到这里
            return {
                "status": "completed",
                "progress": 100,
                "result_url": "",
                "error_message": "",
                "processing_time": 0,
            }

        return {
            "status": "failed",
            "progress": 0,
            "result_url": "",
            "error_message": "无效的任务 ID",
            "processing_time": 0,
        }

    def generate_with_retry(
        self, avatar_url: str, clothing_urls: List[str], max_retries: int = 3, **kwargs
    ) -> Dict[str, Any]:
        """
        带重试的生成方法

        Args:
            avatar_url: 人物照片 URL
            clothing_urls: 服装图片 URL 列表
            max_retries: 最大重试次数
            **kwargs: 其他参数

        Returns:
            生成结果
        """
        last_error = ""

        for attempt in range(max_retries):
            result = self.submit_task(avatar_url, clothing_urls, **kwargs)

            if result["success"]:
                return result

            last_error = result["error_message"]
            logger.warning(f"[{self.name}] 第 {attempt + 1} 次尝试失败: {last_error}")

            # 等待后重试
            if attempt < max_retries - 1:
                time.sleep(2**attempt)  # 指数退避

        return {
            "task_id": "",
            "success": False,
            "error_message": f"重试 {max_retries} 次后仍失败: {last_error}",
            "result_url": "",
        }

    def batch_generate(self, items: List[Dict[str, str]], **kwargs) -> List[Dict[str, Any]]:
        """
        批量生成

        Args:
            items: [{'avatar_url': str, 'clothing_urls': list}, ...]
            **kwargs: 其他参数

        Returns:
            [生成结果, ...]
        """
        results = []

        for i, item in enumerate(items):
            logger.info(f"[{self.name}] 批量处理 {i + 1}/{len(items)}")

            result = self.submit_task(item["avatar_url"], item["clothing_urls"], **kwargs)
            results.append(result)

            # 避免触发频率限制
            if i < len(items) - 1:
                time.sleep(1)

        return results

    def _download_and_store_result(
        self,
        result_url: str,
        task_id: str,
        trace_id: str,
        tenant_id: str = "default",
        max_retries: int = 3,
    ) -> Optional[str]:
        """
        下载 AI 生成的结果图片并存储到本地/OSS

        Args:
            result_url: AI 返回的结果图片 URL
            task_id: 任务 ID
            trace_id: 追踪 ID
            tenant_id: 租户 ID
            max_retries: 最大重试次数

        Returns:
            (存储后的 URL, 存储 key) 元组，失败返回 (None, None)
        """
        from io import BytesIO

        # 下载图片（带重试）
        for attempt in range(max_retries):
            try:
                logger.info(
                    f"[{self.name}] [{trace_id}] 开始下载结果图片 (尝试 {attempt + 1}/{max_retries}): {result_url}"
                )

                # 下载图片，超时 60s（大图可能较慢）
                response = requests.get(result_url, timeout=60)
                response.raise_for_status()
                break  # 成功则跳出重试循环

            except requests.exceptions.RequestException as e:
                if attempt < max_retries - 1:
                    wait_time = 2**attempt  # 指数退避: 1s, 2s, 4s
                    logger.warning(f"[{self.name}] [{trace_id}] 下载失败，{wait_time}s 后重试: {e}")
                    time.sleep(wait_time)
                else:
                    logger.error(f"[{self.name}] [{trace_id}] 下载失败，已重试 {max_retries} 次: {e}")
                    return None, None

        try:
            # 获取内容类型
            content_type = response.headers.get("Content-Type", "image/png")

            # 根据内容类型确定扩展名
            ext_map = {
                "image/png": ".png",
                "image/jpeg": ".jpg",
                "image/webp": ".webp",
                "image/gif": ".gif",
            }
            ext = ext_map.get(content_type, ".png")

            # 存储到本地/OSS
            storage = StorageService()

            file_obj = BytesIO(response.content)
            filename = f"tryon_result_{task_id}{ext}"

            from apps.common.constants import StorageFolder

            storage_key, stored_url, is_dup, content_key = storage.upload_file(
                file_obj=file_obj,
                filename=filename,
                folder=StorageFolder.RESULTS,  # 结果图片存储目录
                tenant_id=tenant_id,
                content_type=content_type,
                file_category="result",  # 标记为试穿结果图片
                skip_duplicate=True,
            )

            # 生成预签名 URL（如果是 OSS 存储）
            if storage.is_oss and storage_key:
                presigned_url = storage.get_signed_url(storage_key, expires=86400)  # 24小时有效
                logger.info(
                    f"[{self.name}] [{trace_id}] 结果图片已存储: storage_key={storage_key}, presigned_url={presigned_url}"
                )
                return presigned_url, storage_key
            else:
                # 本地存储返回完整 URL
                logger.info(f"[{self.name}] [{trace_id}] 结果图片已存储: {stored_url}")
                return stored_url, storage_key

        except Exception as e:
            logger.error(f"[{self.name}] [{trace_id}] 存储结果图片失败: {e}")
            return None, None

    def _async_store_result(
        self,
        result_url: str,
        task_id: str,
        trace_id: str,
        tenant_id: str = "default",
    ):
        """
        后台异步存储结果图片

        用户无需等待存储完成，可以立即看到预览图
        存储完成后会更新 TryOnRecord 记录
        """
        import threading

        def store_in_background():
            try:
                logger.info(f"[{self.name}] [{trace_id}] 后台开始存储结果图片: task_id={task_id}")
                stored_url, stored_key = self._download_and_store_result(
                    result_url=result_url,
                    task_id=task_id,
                    trace_id=trace_id,
                    tenant_id=tenant_id,
                )

                if stored_url and stored_key:
                    # 更新 TryOnRecord 记录
                    self._update_record_result(task_id, stored_url, stored_key)
                    logger.info(f"[{self.name}] [{trace_id}] 后台存储完成: task_id={task_id}")
                else:
                    logger.warning(f"[{self.name}] [{trace_id}] 后台存储失败，结果将使用原始 URL: task_id={task_id}")

            except Exception as e:
                logger.error(f"[{self.name}] [{trace_id}] 后台存储异常: {e}")

        thread = threading.Thread(target=store_in_background)
        thread.daemon = True
        thread.start()
        logger.info(f"[{self.name}] [{trace_id}] 已启动后台存储线程: task_id={task_id}")

    def _update_record_result(self, task_id: str, result_url: str, result_key: str):
        """
        更新 TryOnRecord 记录，添加存储后的结果文件
        """
        try:
            from apps.tryon.models import TryOnRecord
            from apps.common.models import FileRecord

            record = TryOnRecord.objects.filter(task_id=task_id).first()
            if record:
                # 尝试获取或创建文件记录
                try:
                    file_record = FileRecord.objects.get(storage_key=result_key)
                except FileRecord.DoesNotExist:
                    # 创建新的文件记录
                    file_record = FileRecord.objects.create(
                        md5_hash="",
                        storage_type="oss",
                        storage_key=result_key,
                        access_url=result_url,
                        tenant_id="",
                        folder="results",
                        file_category="result",
                        content_type="image/png",
                    )

                record.result_file = file_record
                record.save(update_fields=["result_file", "updated_at"])
                logger.info(f"[{self.name}] 已更新记录 {task_id} 的 result_file")
            else:
                logger.warning(f"[{self.name}] 未找到任务 {task_id} 对应的记录")
        except Exception as e:
            logger.error(f"[{self.name}] 更新记录失败: {e}")

    def cleanup(self, task_id: str):
        """清理任务资源"""
        # 清理缓存
        if task_id.startswith("seed_"):
            from django.core.cache import cache

            cache.delete(f"ai:seeddream:{task_id}")

    def get_model_info(self) -> Dict[str, Any]:
        """获取模型信息"""
        return {
            "name": self.name,
            "display_name": self.display_name,
            "model_id": self.model_id,
            "base_url": self.base_url,
            "configured": self.validate_config(),
            "circuit_open": self.circuit_breaker.is_open(),
            "supported_sizes": ["1K", "2K"],
            "supported_formats": ["png", "jpg", "webp"],
        }


class SeedDanceAsyncEngine(SeedDanceEngine):
    """
    异步版本的 SeedDance 引擎

    如果未来火山引擎提供异步 API，可使用此实现
    目前继承自同步引擎，保持兼容
    """

    name = "seeddance_async"
    display_name = "SeedDance (异步)"

    async def submit_task_async(self, avatar_url: str, clothing_urls: List[str], **kwargs) -> Dict[str, Any]:
        """
        异步提交任务

        使用 asyncio.to_thread 将同步调用转为异步
        """
        import asyncio

        return await asyncio.to_thread(self.submit_task, avatar_url, clothing_urls, **kwargs)

    async def query_task_status_async(self, task_id: str) -> Dict[str, Any]:
        """异步查询任务状态"""
        import asyncio

        return await asyncio.to_thread(self.query_task_status, task_id)
