"""
URL 工具函数
统一处理图片 URL,确保返回完整的可访问链接
"""
from django.conf import settings


def get_full_url(url):
    """
    获取完整的 URL
    
    如果 URL 已经是完整的 URL (以 http 开头),直接返回
    如果是相对路径,拼接后端域名
    
    Args:
        url: 图片 URL,可以是完整 URL 或相对路径
        
    Returns:
        完整的可访问 URL,如果 url 为空则返回 None
    """
    if not url:
        return None
    
    # 如果已经是完整 URL,直接返回
    if url.startswith('http://') or url.startswith('https://'):
        return url
    
    # 如果是相对路径,拼接后端域名
    base_url = getattr(settings, 'BACKEND_URL', 'http://localhost:8888')
    
    # 确保路径以 / 开头
    if not url.startswith('/'):
        url = f'/{url}'
    
    return f"{base_url.rstrip('/')}{url}"


def get_image_url(image_field):
    """
    获取图片字段的完整 URL
    
    处理 Django ImageField 或单纯 URL 字符串
    
    Args:
        image_field: ImageField 实例或 URL 字符串
        
    Returns:
        完整的可访问 URL
    """
    if not image_field:
        return None
    
    # 如果是字符串
    if isinstance(image_field, str):
        return get_full_url(image_field)
    
    # 如果是 ImageField
    if hasattr(image_field, 'url'):
        return get_full_url(image_field.url)
    
    return None
