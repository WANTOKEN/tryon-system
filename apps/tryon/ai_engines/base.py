"""
AI 引擎基类
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
import logging

logger = logging.getLogger("ai_engines")


class BaseAIEngine(ABC):
    """AI 引擎抽象基类"""

    name: str = ""
    display_name: str = ""

    def _validate_public_url(self, url: str, name: str = "URL") -> None:
        """
        验证 URL 是否为公网可访问的在线链接

        禁止 localhost、内网地址、非 HTTP(S) 协议

        Args:
            url: 要验证的 URL
            name: URL 名称（用于错误信息）

        Raises:
            ValueError: 如果 URL 不是公网可访问的
        """
        from urllib.parse import urlparse
        import re

        if not url:
            raise ValueError(f"{name} 不能为空")

        # 必须是 HTTP 或 HTTPS 协议
        if not url.startswith("http://") and not url.startswith("https://"):
            raise ValueError(f"{name} 必须是 HTTP(S) 协议: {url}")

        parsed = urlparse(url)
        hostname = parsed.netloc.split(":")[0]  # 移除端口

        # 禁止的 hostname 列表
        forbidden_hosts = [
            "localhost",
            "127.0.0.1",
            "0.0.0.0",
            "::1",
            "[::1]",
        ]

        # 检查是否是禁止的 host
        if hostname.lower() in forbidden_hosts:
            raise ValueError(f"{name} 不能使用本地地址 (localhost)，必须是公网可访问的在线链接: {url}")

        # 检查内网 IP 段 (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
        private_ip_patterns = [
            r"^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$",  # 10.0.0.0/8
            r"^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$",  # 172.16.0.0/12
            r"^192\.168\.\d{1,3}\.\d{1,3}$",  # 192.168.0.0/16
        ]

        for pattern in private_ip_patterns:
            if re.match(pattern, hostname):
                raise ValueError(f"{name} 不能使用内网地址，必须是公网可访问的在线链接: {url}")

    def _validate_all_urls(self, avatar_url: str, clothing_urls: List[str]) -> None:
        """
        验证所有传入的 URL 是否为公网可访问的在线链接

        Args:
            avatar_url: 人物照片 URL
            clothing_urls: 服装照片 URL 列表

        Raises:
            ValueError: 如果任何 URL 不是公网可访问的
        """
        self._validate_public_url(avatar_url, "人物照片 URL")
        for i, clothing_url in enumerate(clothing_urls):
            self._validate_public_url(clothing_url, f"服装照片 URL[{i+1}]")

    @abstractmethod
    def submit_task(
        self,
        avatar_url: str,
        clothing_urls: list,
        prompt: Optional[str] = None,
        clothing_info: Optional[List[Dict]] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        """
        提交 AI 试穿任务

        Args:
            avatar_url: 顾客形象照片 URL
            clothing_urls: 服装图片 URL 列表
            prompt: 可选的自定义提示词
            clothing_info: 服装信息列表，每项包含 category, subcategory 等
            **kwargs: 额外参数，供具体引擎实现使用

        Returns:
            {
                'task_id': str,       # AI 任务 ID
                'success': bool,
                'error_message': str  # 失败时返回
            }
        """
        pass

    @abstractmethod
    def query_task_status(self, task_id: str) -> Dict[str, Any]:
        """
        查询任务状态

        Args:
            task_id: AI 任务 ID

        Returns:
            {
                'status': 'pending' | 'processing' | 'completed' | 'failed',
                'result_url': str,      # 完成后返回
                'progress': int,         # 0-100
                'error_message': str,
                'processing_time': float
            }
        """
        pass

    def validate_config(self) -> bool:
        """验证引擎配置"""
        return True

    def cleanup(self, task_id: str):
        """清理任务资源"""
        pass


class MockAIEngine(BaseAIEngine):
    """模拟 AI 引擎（用于测试）"""

    name = "mock"
    display_name = "模拟引擎"

    def __init__(self):
        self._tasks: Dict[str, Dict] = {}

    def submit_task(
        self, avatar_url: str, clothing_urls: list, prompt: Optional[str] = None, **kwargs
    ) -> Dict[str, Any]:
        import uuid

        task_id = f"mock_{uuid.uuid4().hex[:16]}"
        self._tasks[task_id] = {
            "status": "pending",
            "avatar_url": avatar_url,
            "clothing_urls": clothing_urls,
            "prompt": prompt,
            "progress": 0,
            "result_url": avatar_url,
            "error_message": "",
            "processing_time": 0,
            "created_at": __import__("time").time(),
        }
        logger.info(f"[MockEngine] 任务已提交: {task_id}, prompt={prompt is not None}")
        return {"task_id": task_id, "success": True}

    def query_task_status(self, task_id: str) -> Dict[str, Any]:
        import time

        if task_id not in self._tasks:
            return {
                "status": "failed",
                "progress": 0,
                "result_url": "",
                "error_message": "任务不存在",
                "processing_time": 0,
            }

        task = self._tasks[task_id]
        elapsed = time.time() - task["created_at"]

        # 模拟处理进度
        if task["status"] == "pending":
            if elapsed > 1:
                task["status"] = "processing"
                task["progress"] = 50
        elif task["status"] == "processing":
            if elapsed > 3:
                task["status"] = "completed"
                task["progress"] = 100
                task["result_url"] = task["avatar_url"]  # 模拟返回原图
                task["processing_time"] = elapsed

        return {
            "status": task["status"],
            "progress": task["progress"],
            "result_url": task["result_url"],
            "error_message": task["error_message"],
            "processing_time": task["processing_time"],
        }
