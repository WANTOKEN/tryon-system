"""
火山引擎 TOS 临时签名 URL 工具

用于处理 ARK API 返回的临时签名 URL，支持：
- 解析签名 URL 信息
- 检查 URL 是否过期
- 重新签名获取新的访问 URL
"""
import os
import time
import hmac
import hashlib
import urllib.parse
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Tuple
from urllib.parse import urlparse, parse_qs

import requests

logger = __import__('logging').getLogger('tos_utils')


class TosSignedURL:
    """
    火山引擎 TOS 签名 URL 解析器
    
    支持解析和检查 TOS 临时签名 URL 的有效性
    """
    
    # TOS 签名 URL 的特征
    TOS_DOMAIN_SUFFIX = '.tos-cn-beijing.volces.com'
    TOS_SIGNATURE_PARAMS = {
        'X-Tos-Algorithm',
        'X-Tos-Credential',
        'X-Tos-Date',
        'X-Tos-Expires',
        'X-Tos-Signature',
        'X-Tos-SignedHeaders',
    }
    
    def __init__(self, url: str):
        """
        初始化签名 URL 解析器
        
        Args:
            url: TOS 签名 URL
        """
        self.original_url = url
        self.parsed = urlparse(url)
        self.query_params = parse_qs(self.parsed.query)
        
        # 解析基本信息
        self.bucket = self._extract_bucket()
        self.object_key = self._extract_object_key()
        self.is_signed = self._check_if_signed()
        
        # 解析签名信息
        self.algorithm = self._get_param('X-Tos-Algorithm')
        self.credential = self._get_param('X-Tos-Credential')
        self.sign_date = self._get_param('X-Tos-Date')
        self.expires_seconds = self._get_int_param('X-Tos-Expires')
        self.signature = self._get_param('X-Tos-Signature')
        self.signed_headers = self._get_param('X-Tos-SignedHeaders')
        
        # 计算过期时间
        self.expires_at = self._calculate_expires_at()
    
    def _extract_bucket(self) -> str:
        """从域名提取 bucket 名称"""
        host = self.parsed.netloc
        if '.' in host:
            return host.split('.')[0]
        return ''
    
    def _extract_object_key(self) -> str:
        """提取对象路径（不含查询参数）"""
        return self.parsed.path.lstrip('/')
    
    def _check_if_signed(self) -> bool:
        """检查是否是签名 URL"""
        return any(param in self.query_params for param in self.TOS_SIGNATURE_PARAMS)
    
    def _get_param(self, name: str) -> str:
        """获取查询参数值"""
        values = self.query_params.get(name, [''])
        return values[0] if values else ''
    
    def _get_int_param(self, name: str) -> int:
        """获取整数查询参数值"""
        try:
            return int(self._get_param(name))
        except (ValueError, TypeError):
            return 0
    
    def _calculate_expires_at(self) -> Optional[datetime]:
        """计算过期时间"""
        if not self.sign_date or not self.expires_seconds:
            return None
        
        try:
            # 解析签名日期: 20260422T085723Z
            sign_dt = datetime.strptime(self.sign_date, '%Y%m%dT%H%M%SZ')
            sign_dt = sign_dt.replace(tzinfo=timezone.utc)
            
            # 计算过期时间
            return sign_dt + timedelta(seconds=self.expires_seconds)
        except ValueError:
            return None
    
    @property
    def is_expired(self) -> bool:
        """检查 URL 是否已过期"""
        if not self.expires_at:
            return True  # 无法解析过期时间，视为已过期
        
        return datetime.now(timezone.utc) > self.expires_at
    
    @property
    def remaining_seconds(self) -> int:
        """获取剩余有效秒数"""
        if not self.expires_at:
            return 0
        
        delta = self.expires_at - datetime.now(timezone.utc)
        return max(0, int(delta.total_seconds()))
    
    @property
    def is_tos_url(self) -> bool:
        """检查是否是 TOS URL"""
        return self.TOS_DOMAIN_SUFFIX in self.parsed.netloc
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            'original_url': self.original_url,
            'bucket': self.bucket,
            'object_key': self.object_key,
            'is_tos_url': self.is_tos_url,
            'is_signed': self.is_signed,
            'is_expired': self.is_expired,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'remaining_seconds': self.remaining_seconds,
            'algorithm': self.algorithm,
            'sign_date': self.sign_date,
            'expires_seconds': self.expires_seconds,
        }
    
    def __str__(self) -> str:
        status = '已过期' if self.is_expired else f'剩余 {self.remaining_seconds}s'
        return f"TosSignedURL(bucket={self.bucket}, key={self.object_key}, status={status})"


class TosURLReSigner:
    """
    TOS URL 重签名工具
    
    使用火山引擎 TOS SDK 重新签名 URL，获取新的访问链接
    """
    
    def __init__(
        self,
        access_key: str = None,
        secret_key: str = None,
        endpoint: str = 'tos-cn-beijing.volces.com',
        region: str = 'cn-beijing',
    ):
        """
        初始化重签名工具
        
        Args:
            access_key: 火山引擎 AccessKey ID
            secret_key: 火山引擎 AccessKey Secret
            endpoint: TOS 端点
            region: 区域
        """
        self.access_key = access_key or os.getenv('VOLC_ACCESSKEY', '')
        self.secret_key = secret_key or os.getenv('VOLC_SECRETKEY', '')
        self.endpoint = endpoint
        self.region = region
        
        # TOS 客户端（延迟初始化）
        self._client = None
    
    @property
    def client(self):
        """延迟初始化 TOS 客户端"""
        if self._client is None:
            try:
                import tos
                
                self._client = tos.TosClientV2(
                    ak=self.access_key,
                    sk=self.secret_key,
                    endpoint=self.endpoint,
                    region=self.region,
                )
            except ImportError:
                raise ImportError(
                    "需要安装 tos SDK: pip install tos"
                )
        return self._client
    
    def is_configured(self) -> bool:
        """检查是否已配置凭证"""
        return bool(self.access_key and self.secret_key)
    
    def resign_url(
        self,
        url: str,
        expires_seconds: int = 86400,
    ) -> str:
        """
        重新签名 URL
        
        Args:
            url: 原始签名 URL 或对象路径
            expires_seconds: 新签名有效期（秒），默认 24 小时
        
        Returns:
            新的签名 URL
        """
        # 解析原始 URL
        parsed = TosSignedURL(url)
        
        if not parsed.is_tos_url:
            raise ValueError(f"不是有效的 TOS URL: {url}")
        
        # 使用 TOS SDK 重新签名
        try:
            # presigned_url 方法需要 bucket 和 object_key
            new_url = self.client.pre_signed_url(
                http_method='GET',
                bucket=parsed.bucket,
                key=parsed.object_key,
                expires=expires_seconds,
            )
            return new_url
        except Exception as e:
            logger.error(f"重签名失败: {e}")
            raise
    
    def get_object_info(self, url: str) -> Dict[str, Any]:
        """
        获取对象信息（不下载内容）
        
        Args:
            url: TOS URL
        
        Returns:
            对象元信息
        """
        parsed = TosSignedURL(url)
        
        if not parsed.is_tos_url:
            raise ValueError(f"不是有效的 TOS URL: {url}")
        
        try:
            # head_object 获取对象元信息
            meta = self.client.head_object(
                bucket=parsed.bucket,
                key=parsed.object_key,
            )
            return {
                'content_type': meta.content_type,
                'content_length': meta.content_length,
                'last_modified': meta.last_modified,
                'etag': meta.etag,
            }
        except Exception as e:
            logger.error(f"获取对象信息失败: {e}")
            raise


def parse_tos_url(url: str) -> TosSignedURL:
    """
    解析 TOS 签名 URL
    
    Args:
        url: TOS 签名 URL
    
    Returns:
        TosSignedURL 对象
    """
    return TosSignedURL(url)


def check_url_validity(url: str) -> Dict[str, Any]:
    """
    检查 URL 有效性
    
    Args:
        url: 待检查的 URL
    
    Returns:
        检查结果
    """
    parsed = TosSignedURL(url)
    
    result = parsed.to_dict()
    
    # 如果未过期，尝试 GET 请求验证可访问性
    # 注意：TOS 签名 URL 可能禁止 HEAD 请求，需用 GET
    if not parsed.is_expired:
        try:
            # 使用 stream=True 避免下载全部内容
            resp = requests.get(url, timeout=10, stream=True)
            result['accessible'] = resp.status_code == 200
            result['status_code'] = resp.status_code
            result['content_type'] = resp.headers.get('Content-Type', '')
            result['content_length'] = resp.headers.get('Content-Length', '')
            # 立即关闭连接，不读取内容
            resp.close()
        except Exception as e:
            result['accessible'] = False
            result['error'] = str(e)
    else:
        result['accessible'] = False
        result['error'] = 'URL 已过期'
    
    return result


def resign_if_expired(
    url: str,
    expires_seconds: int = 86400,
    threshold_seconds: int = 3600,
) -> Tuple[str, bool]:
    """
    如果 URL 即将过期则重新签名
    
    Args:
        url: 原始 URL
        expires_seconds: 新签名有效期
        threshold_seconds: 剩余时间阈值，低于此值则重签名
    
    Returns:
        (url, was_resigned) - URL 和是否重签名
    """
    parsed = TosSignedURL(url)
    
    # 不是 TOS URL 或未配置重签名，直接返回
    if not parsed.is_tos_url or not parsed.is_signed:
        return url, False
    
    # 检查剩余时间
    if parsed.remaining_seconds > threshold_seconds:
        return url, False
    
    # 需要重签名
    resigner = TosURLReSigner()
    
    if not resigner.is_configured():
        logger.warning("未配置 TOS 凭证，无法重签名")
        return url, False
    
    try:
        new_url = resigner.resign_url(url, expires_seconds)
        logger.info(f"URL 重签名成功: 剩余 {parsed.remaining_seconds}s -> {expires_seconds}s")
        return new_url, True
    except Exception as e:
        logger.error(f"URL 重签名失败: {e}")
        return url, False
