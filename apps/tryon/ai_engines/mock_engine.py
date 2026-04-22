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

    def __init__(self):
        super().__init__()
        self._tasks: Dict[str, Dict] = {}
        self._lock = threading.Lock()

    def submit_task(
        self,
        avatar_url: str,
        clothing_urls: List[str],
        prompt: str = None,
        **kwargs
    ) -> Dict[str, Any]:
        """提交试穿任务"""
        task_id = f"task_{int(time.time())}_{random.randint(1000, 9999)}"
        
        # 可选：记录 prompt 信息用于调试
        if prompt:
                    logger.debug(f"[MockAIEngine] 收到 prompt: {prompt}")

        with self._lock:
            self._tasks[task_id] = {
                'task_id': task_id,
                'avatar_url': avatar_url,
                'clothing_urls': clothing_urls,
                'status': 'pending',
                'progress': 0,
                'created_at': time.time(),
                'updated_at': time.time(),
                'result_url': None,
                'error_message': None,
            }

        # 异步模拟处理
        self._start_mock_processing(task_id)

        return {
            'success': True,
            'task_id': task_id,
            'status': 'pending',
            'message': '任务已提交'
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

            # 模拟处理进度
            if task['status'] == 'pending':
                task['status'] = 'processing'
                task['progress'] = min(50, int(elapsed * 10))

            elif task['status'] == 'processing':
                if elapsed < 5:
                    task['progress'] = min(50, int(elapsed * 10))
                else:
                    # 5 秒后随机成功或失败
                    if random.random() > 0.1:  # 90% 成功率
                        task['status'] = 'completed'
                        task['progress'] = 100
                        task['result_url'] = self._generate_mock_result(avatar_url=task['avatar_url'])
                        task['processing_time'] = elapsed
                    else:
                        task['status'] = 'failed'
                        task['progress'] = 0
                        task['error_message'] = '模拟处理失败'

            task['updated_at'] = time.time()
            return {
                'task_id': task_id,
                'status': task['status'],
                'progress': task['progress'],
                'result_url': task.get('result_url'),
                'error_message': task.get('error_message'),
                'processing_time': task.get('processing_time'),
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
            time.sleep(random.uniform(3, 6))  # 3-6 秒后完成
            with self._lock:
                if task_id in self._tasks:
                    task = self._tasks[task_id]
                    if random.random() > 0.1:  # 90% 成功率
                        task['status'] = 'completed'
                        task['progress'] = 100
                        task['result_url'] = self._generate_mock_result(avatar_url=task['avatar_url'])
                        task['processing_time'] = time.time() - task['created_at']
                    else:
                        task['status'] = 'failed'
                        task['error_message'] = '模拟处理失败'

        thread = threading.Thread(target=process)
        thread.daemon = True
        thread.start()

    def _generate_mock_result(self, avatar_url: str = None) -> str:
        """生成模拟结果图片 URL"""
        # 返回一个占位图片
        return f"https://picsum.photos/seed/{random.randint(1, 1000)}/512/1024"
