"""
Mock AI 引擎实现
用于本地开发和测试
"""
import time
import random
import threading
import logging
from typing import Dict, Any, List, Optional
from .base import BaseAIEngine

logger = logging.getLogger('ai_engines')


class MockAIEngine(BaseAIEngine):
    """模拟 AI 引擎（用于开发和测试）"""

    display_name = "模拟引擎 (Mock)"
    description = "模拟 AI 试穿效果，无需真实 API"

    # 模拟生成时间（秒）
    PROCESSING_TIME = 40

    def __init__(self):
        super().__init__()
        self._tasks: Dict[str, Dict] = {}
        self._lock = threading.Lock()

    def submit_task(
        self,
        avatar_url: str,
        clothing_urls: List[str],
        prompt: str = None,
        clothing_info: Optional[List[Dict]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """提交试穿任务（Mock 模式模拟异步处理）"""
        task_id = f"task_{int(time.time())}_{random.randint(1000, 9999)}"
        
        # 可选：记录 prompt 信息用于调试
        if prompt:
            logger.debug(f"[MockAIEngine] 收到 prompt: {prompt}")
        
        if clothing_info:
            logger.debug(f"[MockAIEngine] 收到 clothing_info: {clothing_info}")

        # 创建任务记录
        with self._lock:
            self._tasks[task_id] = {
                'status': 'pending',
                'avatar_url': avatar_url,
                'clothing_urls': clothing_urls,
                'prompt': prompt,
                'progress': 0,
                'result_url': None,
                'result_key': '',
                'error_message': '',
                'processing_time': 0,
                'created_at': time.time(),
                'updated_at': time.time(),
            }

        logger.info(f"[MockAIEngine] 任务已提交: {task_id}，模拟 {self.PROCESSING_TIME} 秒生成时间")
        
        # 启动后台线程模拟处理
        self._start_mock_processing(task_id)
        
        return {
            'success': True,
            'task_id': task_id,
            'status': 'pending',
            'estimated_time': self.PROCESSING_TIME,
        }

    def query_task_status(self, task_id: str) -> Dict[str, Any]:
        """查询任务状态"""
        with self._lock:
            if task_id not in self._tasks:
                return {
                    'task_id': task_id,
                    'status': 'not_found',
                    'progress': 0,
                    'error_message': '任务不存在'
                }

            task = self._tasks[task_id]
            elapsed = time.time() - task['created_at']

            # 模拟进度更新（基于已过去的时间）
            if task['status'] == 'pending':
                # 刚提交，状态转为 processing
                task['status'] = 'processing'
                task['progress'] = min(5, int(elapsed * 2))  # 快速达到 5%

            elif task['status'] == 'processing':
                # 计算进度：40秒内从 5% 到 95%
                progress_per_second = 90 / self.PROCESSING_TIME  # 每秒增加约 2.25%
                calculated_progress = 5 + int(elapsed * progress_per_second)
                task['progress'] = min(95, calculated_progress)

            task['updated_at'] = time.time()
            
            return {
                'task_id': task_id,
                'status': task['status'],
                'progress': task['progress'],
                'result_url': task.get('result_url'),
                'error_message': task.get('error_message'),
                'processing_time': task.get('processing_time'),
                'estimated_time': self.PROCESSING_TIME - int(elapsed),
            }

    def cancel_task(self, task_id: str) -> Dict[str, Any]:
        """取消任务"""
        with self._lock:
            if task_id not in self._tasks:
                return {'success': False, 'error_message': '任务不存在'}

            self._tasks[task_id]['status'] = 'cancelled'
            return {'success': True, 'message': '任务已取消'}

    def _start_mock_processing(self, task_id: str):
        """启动模拟处理（后台线程）"""
        def process():
            # 模拟 40 秒生成时间
            time.sleep(self.PROCESSING_TIME)
            
            with self._lock:
                if task_id in self._tasks:
                    task = self._tasks[task_id]
                    task['status'] = 'completed'
                    task['progress'] = 100
                    task['result_url'] = self._generate_mock_result(avatar_url=task['avatar_url'])
                    task['processing_time'] = time.time() - task['created_at']
                    logger.info(f"[MockAIEngine] 任务完成: {task_id}")

        thread = threading.Thread(target=process)
        thread.daemon = True
        thread.start()

    def _generate_mock_result(self, avatar_url: str = None) -> str:
        """生成模拟结果图片 URL"""
        # 返回用户上传的形象图片作为模拟结果
        if avatar_url:
            return avatar_url
        # 如果没有头像 URL，返回一个占位图片（512x1024 竖版，符合试穿效果比例）
        return f"https://picsum.photos/seed/{random.randint(1, 1000)}/512/1024"
