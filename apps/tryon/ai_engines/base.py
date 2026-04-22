"""
AI 引擎基类
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger('ai_engines')


class BaseAIEngine(ABC):
    """AI 引擎抽象基类"""

    name: str = ''
    display_name: str = ''

    @abstractmethod
    def submit_task(
        self,
        avatar_url: str,
        clothing_urls: list,
        prompt: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        提交 AI 试穿任务

        Args:
            avatar_url: 顾客形象照片 URL
            clothing_urls: 服装图片 URL 列表
            prompt: 可选的自定义提示词
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

    name = 'mock'
    display_name = '模拟引擎'

    def __init__(self):
        self._tasks: Dict[str, Dict] = {}

    def submit_task(
        self,
        avatar_url: str,
        clothing_urls: list,
        prompt: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        import uuid
        task_id = f"mock_{uuid.uuid4().hex[:16]}"
        self._tasks[task_id] = {
            'status': 'pending',
            'avatar_url': avatar_url,
            'clothing_urls': clothing_urls,
            'prompt': prompt,
            'progress': 0,
            'result_url': '',
            'error_message': '',
            'processing_time': 0,
            'created_at': __import__('time').time()
        }
        logger.info(f"[MockEngine] 任务已提交: {task_id}, prompt={prompt is not None}")
        return {'task_id': task_id, 'success': True}

    def query_task_status(self, task_id: str) -> Dict[str, Any]:
        import time

        if task_id not in self._tasks:
            return {
                'status': 'failed',
                'progress': 0,
                'result_url': '',
                'error_message': '任务不存在',
                'processing_time': 0
            }

        task = self._tasks[task_id]
        elapsed = time.time() - task['created_at']

        # 模拟处理进度
        if task['status'] == 'pending':
            if elapsed > 1:
                task['status'] = 'processing'
                task['progress'] = 50
        elif task['status'] == 'processing':
            if elapsed > 3:
                task['status'] = 'completed'
                task['progress'] = 100
                task['result_url'] = task['avatar_url']  # 模拟返回原图
                task['processing_time'] = elapsed

        return {
            'status': task['status'],
            'progress': task['progress'],
            'result_url': task['result_url'],
            'error_message': task['error_message'],
            'processing_time': task['processing_time']
        }
