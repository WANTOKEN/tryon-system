"""
缓存工具类
提供统一的缓存操作接口
"""
from django.core.cache import cache
from django.db.models import F
from functools import wraps
import logging

logger = logging.getLogger('apps')


class CacheKeys:
    """缓存键常量"""
    # 分类统计
    CATEGORIES_COUNTS = "categories:counts:{merchant_id}"
    # 商户配额
    MERCHANT_QUOTA = "merchant:quota:{merchant_id}"
    # 预设服装
    PRESET_CLOTHES = "preset:clothes:all"
    # 服装详情
    CLOTHING_DETAIL = "clothing:detail:{clothing_id}"
    # 用户信息
    USER_INFO = "user:info:{user_id}"


class CacheTimeout:
    """缓存超时常量（秒）"""
    SHORT = 60          # 1 分钟
    MEDIUM = 300        # 5 分钟
    LONG = 3600         # 1 小时
    DAY = 86400         # 1 天


def cache_result(key_template, timeout=CacheTimeout.MEDIUM, key_args=None):
    """
    缓存装饰器
    
    Args:
        key_template: 缓存键模板，如 "user:info:{user_id}"
        timeout: 缓存超时时间
        key_args: 用于生成缓存键的参数名列表
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # 生成缓存键
            if key_args:
                key_values = {k: kwargs.get(k) for k in key_args if k in kwargs}
                cache_key = key_template.format(**key_values)
            else:
                cache_key = key_template.format(*args, **kwargs)
            
            # 尝试从缓存获取
            result = cache.get(cache_key)
            if result is not None:
                logger.debug(f"缓存命中: {cache_key}")
                return result
            
            # 执行函数并缓存结果
            result = func(*args, **kwargs)
            if result is not None:
                cache.set(cache_key, result, timeout)
                logger.debug(f"缓存设置: {cache_key}")
            
            return result
        return wrapper
    return decorator


def invalidate_cache(key_template, **kwargs):
    """
    使缓存失效
    
    Args:
        key_template: 缓存键模板
        **kwargs: 键参数
    """
    cache_key = key_template.format(**kwargs)
    cache.delete(cache_key)
    logger.debug(f"缓存清除: {cache_key}")


def invalidate_pattern(pattern):
    """
    使匹配模式的所有缓存失效
    
    Args:
        pattern: 缓存键模式，如 "categories:*"
    """
    try:
        # django-redis 支持 delete_pattern
        cache.delete_pattern(pattern)
        logger.debug(f"缓存模式清除: {pattern}")
    except AttributeError:
        # 如果不支持，记录警告
        logger.warning(f"缓存后端不支持 delete_pattern: {pattern}")


class QuotaCache:
    """配额缓存管理"""
    
    @staticmethod
    def get(merchant_id):
        """获取缓存的配额信息"""
        key = CacheKeys.MERCHANT_QUOTA.format(merchant_id=merchant_id)
        return cache.get(key)
    
    @staticmethod
    def set(merchant_id, quota_total, quota_used, timeout=CacheTimeout.SHORT):
        """设置配额缓存"""
        key = CacheKeys.MERCHANT_QUOTA.format(merchant_id=merchant_id)
        cache.set(key, {
            'total': quota_total,
            'used': quota_used,
            'remaining': quota_total - quota_used
        }, timeout)
    
    @staticmethod
    def invalidate(merchant_id):
        """使配额缓存失效"""
        invalidate_cache(CacheKeys.MERCHANT_QUOTA, merchant_id=merchant_id)


class CategoryCache:
    """分类缓存管理"""
    
    @staticmethod
    def get_counts(merchant_id):
        """获取分类统计缓存"""
        key = CacheKeys.CATEGORIES_COUNTS.format(merchant_id=merchant_id)
        return cache.get(key)
    
    @staticmethod
    def set_counts(merchant_id, counts, timeout=CacheTimeout.MEDIUM):
        """设置分类统计缓存"""
        key = CacheKeys.CATEGORIES_COUNTS.format(merchant_id=merchant_id)
        cache.set(key, counts, timeout)
    
    @staticmethod
    def invalidate(merchant_id):
        """使分类缓存失效"""
        invalidate_cache(CacheKeys.CATEGORIES_COUNTS, merchant_id=merchant_id)
