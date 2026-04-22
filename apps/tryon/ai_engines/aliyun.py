"""
阿里云 AI 试穿引擎
使用阿里云视觉智能开放平台的虚拟试衣能力
"""
import os
import time
import uuid
import hashlib
import hmac
import base64
import json
import logging
from datetime import datetime
from urllib.parse import quote, urlencode
from typing import Dict, Any, Optional

import requests

from .base import BaseAIEngine
from .circuit_breaker import CircuitBreaker
from apps.common.exceptions import AIEngineException

logger = logging.getLogger('ai_engines')


class AliyunEngine(BaseAIEngine):
    """
    阿里云虚拟试衣引擎
    
    文档: https://help.aliyun.com/document_detail/xxxxx.html
    
    配置环境变量:
    - ALIYUN_ACCESS_KEY_ID: 阿里云 AccessKey ID
    - ALIYUN_ACCESS_KEY_SECRET: 阿里云 AccessKey Secret
    - ALIYUN_VISION_ENDPOINT: 视觉智能服务端点 (默认: viapi.cn-shanghai.aliyuncs.com)
    - ALIYUN_VISION_REGION: 服务区域 (默认: cn-shanghai)
    """
    
    name = 'aliyun'
    display_name = '阿里云'
    
    # API 配置
    DEFAULT_ENDPOINT = 'viapi.cn-shanghai.aliyuncs.com'
    DEFAULT_REGION = 'cn-shanghai'
    API_VERSION = '2023-03-13'
    REQUEST_TIMEOUT = 30  # 秒
    POLL_INTERVAL = 2  # 轮询间隔秒
    MAX_POLL_TIME = 180  # 最大轮询时间秒
    
    def __init__(self):
        self.access_key_id = os.getenv('ALIYUN_ACCESS_KEY_ID', '')
        self.access_key_secret = os.getenv('ALIYUN_ACCESS_KEY_SECRET', '')
        self.endpoint = os.getenv('ALIYUN_VISION_ENDPOINT', self.DEFAULT_ENDPOINT)
        self.region = os.getenv('ALIYUN_VISION_REGION', self.DEFAULT_REGION)
        self.circuit_breaker = CircuitBreaker(self.name)
    
    def validate_config(self) -> bool:
        """验证配置是否完整"""
        if not self.access_key_id or not self.access_key_secret:
            logger.warning(
                f"[{self.name}] 配置不完整: "
                f"ACCESS_KEY_ID={'已配置' if self.access_key_id else '缺失'}, "
                f"ACCESS_KEY_SECRET={'已配置' if self.access_key_secret else '缺失'}"
            )
            return False
        return True
    
    def _sign_request(self, params: dict, method: str = 'POST') -> str:
        """
        生成阿里云 API 签名
        
        Args:
            params: 请求参数
            method: HTTP 方法
        
        Returns:
            签名值
        """
        # 1. 规范化请求参数
        sorted_params = sorted(params.items(), key=lambda x: x[0])
        canonicalized_qs = '&'.join([
            f"{quote(k, safe='')}={quote(str(v), safe='')}"
            for k, v in sorted_params
        ])
        
        # 2. 构造待签名字符串
        string_to_sign = f"{method}&%2F&{quote(canonicalized_qs, safe='')}"
        
        # 3. 计算签名
        key = (self.access_key_secret + '&').encode('utf-8')
        value = string_to_sign.encode('utf-8')
        signed_bytes = hmac.new(key, value, hashlib.sha1).digest()
        signature = base64.b64encode(signed_bytes).decode('utf-8')
        
        return signature
    
    def _build_common_params(self, action: str) -> dict:
        """构建公共请求参数"""
        return {
            'Format': 'JSON',
            'Version': self.API_VERSION,
            'AccessKeyId': self.access_key_id,
            'SignatureMethod': 'HMAC-SHA1',
            'Timestamp': datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
            'SignatureVersion': '1.0',
            'SignatureNonce': str(uuid.uuid4()),
            'Action': action,
        }
    
    def _request_api(
        self,
        action: str,
        params: dict,
        method: str = 'POST'
    ) -> Dict[str, Any]:
        """
        发送 API 请求
        
        Args:
            action: API Action 名称
            params: 业务参数
            method: HTTP 方法
        
        Returns:
            API 响应数据
        
        Raises:
            AIEngineException: API 调用失败
        """
        if not self.validate_config():
            raise AIEngineException(f'{self.display_name} 引擎配置不完整')
        
        # 检查熔断器
        if self.circuit_breaker.is_open():
            raise AIEngineException(
                f'{self.display_name} 引擎已熔断，请稍后重试',
                error_code='AI_ENGINE_CIRCUIT_OPEN'
            )
        
        # 构建完整参数
        all_params = self._build_common_params(action)
        all_params.update(params)
        
        # 添加签名
        all_params['Signature'] = self._sign_request(all_params, method)
        
        # 发送请求
        url = f"https://{self.endpoint}/"
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'AI-Virtual-TryOn/1.0',
        }
        
        try:
            response = requests.request(
                method,
                url,
                data=urlencode(all_params),
                headers=headers,
                timeout=self.REQUEST_TIMEOUT,
            )
            response.raise_for_status()
            
            result = response.json()
            
            # 检查 API 错误
            if 'Code' in result and result['Code'] != 'Success':
                self.circuit_breaker.record_failure()
                error_msg = result.get('Message', '未知错误')
                raise AIEngineException(
                    f'{self.display_name} API 错误: {error_msg}',
                    error_code='AI_API_ERROR'
                )
            
            self.circuit_breaker.record_success()
            return result
            
        except requests.Timeout:
            self.circuit_breaker.record_failure()
            raise AIEngineException(
                f'{self.display_name} API 请求超时',
                error_code='AI_API_TIMEOUT'
            )
        except requests.RequestException as e:
            self.circuit_breaker.record_failure()
            raise AIEngineException(
                f'{self.display_name} API 请求失败: {str(e)}',
                error_code='AI_API_ERROR'
            )
    
    def submit_task(self, avatar_url: str, clothing_urls: list) -> Dict[str, Any]:
        """
        提交试穿任务
        
        Args:
            avatar_url: 人物照片 URL
            clothing_urls: 服装图片 URL 列表
        
        Returns:
            {'task_id': str, 'success': bool, 'error_message': str}
        """
        if not clothing_urls:
            return {
                'task_id': '',
                'success': False,
                'error_message': '服装图片不能为空',
            }
        
        try:
            # 调用阿里云虚拟试衣 API
            # TODO: 根据实际 API 文档调整接口名称和参数
            params = {
                'PersonImageURL': avatar_url,
                'ClothImageURL': clothing_urls[0],  # 目前只支持单件服装
                # 可选参数
                # 'Mode': 'auto',  # auto/manual
                # 'BackgroundImageURL': '',
            }
            
            result = self._request_api('VirtualTryOn', params)
            
            task_id = result.get('Data', {}).get('TaskId', '')
            
            if not task_id:
                return {
                    'task_id': '',
                    'success': False,
                    'error_message': '任务提交失败，未返回任务ID',
                }
            
            logger.info(f"[{self.name}] 任务已提交: {task_id}")
            
            return {
                'task_id': task_id,
                'success': True,
                'error_message': '',
            }
            
        except AIEngineException as e:
            logger.error(f"[{self.name}] 任务提交失败: {e.message}")
            return {
                'task_id': '',
                'success': False,
                'error_message': e.message,
            }
    
    def query_task_status(self, task_id: str) -> Dict[str, Any]:
        """
        查询任务状态
        
        Args:
            task_id: AI 任务 ID
        
        Returns:
            {
                'status': 'pending' | 'processing' | 'completed' | 'failed',
                'result_url': str,
                'progress': int (0-100),
                'error_message': str,
                'processing_time': float
            }
        """
        try:
            params = {
                'TaskId': task_id,
            }
            
            result = self._request_api('GetVirtualTryOnResult', params)
            
            data = result.get('Data', {})
            status_code = data.get('Status', '')
            
            # 状态映射
            status_map = {
                'PENDING': 'pending',
                'RUNNING': 'processing',
                'SUCCEEDED': 'completed',
                'FAILED': 'failed',
            }
            status = status_map.get(status_code, 'pending')
            
            # 计算进度
            progress = 0
            if status == 'processing':
                progress = data.get('Progress', 50)
            elif status == 'completed':
                progress = 100
            
            # 获取结果 URL
            result_url = data.get('ResultImageURL', '')
            
            # 错误信息
            error_message = ''
            if status == 'failed':
                error_message = data.get('ErrorMessage', '处理失败')
            
            # 处理耗时
            processing_time = data.get('ProcessTime', 0) / 1000  # 毫秒转秒
            
            return {
                'status': status,
                'progress': progress,
                'result_url': result_url,
                'error_message': error_message,
                'processing_time': processing_time,
            }
            
        except AIEngineException as e:
            return {
                'status': 'failed',
                'progress': 0,
                'result_url': '',
                'error_message': e.message,
                'processing_time': 0,
            }
    
    def cleanup(self, task_id: str):
        """清理任务资源"""
        # 阿里云 API 会自动清理过期任务，无需手动处理
        pass
