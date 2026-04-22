"""
AI 引擎熔断器
防止持续调用失败的服务，自动切换到备用引擎
"""
from datetime import datetime
from django.core.cache import cache
import logging

logger = logging.getLogger('ai_engines')


class CircuitBreaker:
    """
    熔断器实现
    
    状态:
    - CLOSED: 正常状态，允许请求
    - OPEN: 熔断状态，拒绝请求
    - HALF_OPEN: 半开状态，允许试探性请求
    """
    
    STATE_CLOSED = 'closed'
    STATE_OPEN = 'open'
    STATE_HALF_OPEN = 'half_open'
    
    def __init__(
        self,
        engine_name: str,
        fail_threshold: int = 5,
        success_threshold: int = 2,
        reset_timeout: int = 60,
    ):
        """
        Args:
            engine_name: 引擎名称
            fail_threshold: 失败次数阈值，达到后触发熔断
            success_threshold: 半开状态下成功次数阈值，达到后关闭熔断
            reset_timeout: 熔断后多久尝试恢复（秒）
        """
        self.engine_name = engine_name
        self.fail_threshold = fail_threshold
        self.success_threshold = success_threshold
        self.reset_timeout = reset_timeout
        self.cache_key = f"ai:circuit:{engine_name}"
    
    def _get_state(self) -> dict:
        """获取当前状态"""
        state = cache.get(self.cache_key)
        if state is None:
            return {
                'status': self.STATE_CLOSED,
                'fail_count': 0,
                'success_count': 0,
                'opened_at': None,
            }
        return state
    
    def _set_state(self, state: dict):
        """设置状态"""
        cache.set(self.cache_key, state, timeout=self.reset_timeout * 2)
    
    def is_open(self) -> bool:
        """检查熔断器是否打开（是否拒绝请求）"""
        state = self._get_state()
        
        if state['status'] == self.STATE_CLOSED:
            return False
        
        if state['status'] == self.STATE_OPEN:
            # 检查是否已过冷却期
            if state['opened_at']:
                opened_at = datetime.fromisoformat(state['opened_at'])
                elapsed = (datetime.now() - opened_at).total_seconds()
                if elapsed >= self.reset_timeout:
                    # 转为半开状态
                    state['status'] = self.STATE_HALF_OPEN
                    state['success_count'] = 0
                    self._set_state(state)
                    logger.info(f"[CircuitBreaker] {self.engine_name} 转为半开状态")
                    return False
            return True
        
        if state['status'] == self.STATE_HALF_OPEN:
            return False
        
        return False
    
    def record_success(self):
        """记录成功调用"""
        state = self._get_state()
        
        if state['status'] == self.STATE_HALF_OPEN:
            state['success_count'] += 1
            if state['success_count'] >= self.success_threshold:
                # 达到成功阈值，关闭熔断器
                state['status'] = self.STATE_CLOSED
                state['fail_count'] = 0
                state['success_count'] = 0
                state['opened_at'] = None
                logger.info(f"[CircuitBreaker] {self.engine_name} 熔断器已关闭")
        else:
            # 正常状态，重置失败计数
            state['fail_count'] = 0
        
        self._set_state(state)
    
    def record_failure(self):
        """记录失败调用"""
        state = self._get_state()
        
        if state['status'] == self.STATE_HALF_OPEN:
            # 半开状态下失败，立即重新熔断
            state['status'] = self.STATE_OPEN
            state['opened_at'] = datetime.now().isoformat()
            logger.warning(f"[CircuitBreaker] {self.engine_name} 半开状态失败，重新熔断")
        else:
            state['fail_count'] += 1
            if state['fail_count'] >= self.fail_threshold:
                state['status'] = self.STATE_OPEN
                state['opened_at'] = datetime.now().isoformat()
                logger.warning(
                    f"[CircuitBreaker] {self.engine_name} 熔断器打开，"
                    f"失败次数: {state['fail_count']}"
                )
        
        self._set_state(state)
    
    def get_status(self) -> dict:
        """获取熔断器状态信息"""
        state = self._get_state()
        return {
            'engine': self.engine_name,
            'status': state['status'],
            'fail_count': state['fail_count'],
            'success_count': state['success_count'],
            'is_open': self.is_open(),
        }


# 引擎备用映射
FALLBACK_ENGINE_MAP = {
    'aliyun': 'tencent',
    'tencent': 'aliyun',
    'seeddance': 'aliyun',
}


def get_fallback_engine(engine_name: str) -> str | None:
    """获取备用引擎名称"""
    return FALLBACK_ENGINE_MAP.get(engine_name)
