"""
URL 合法性校验工具

功能特性：
- URL 格式验证（协议、域名、路径）
- 可扩展的规则系统
- 高性能校验（使用正则预编译）
- 标准化错误响应
"""

import re
import urllib.parse
from typing import Optional, Dict, List, Tuple, Any, Callable

# 预编译正则表达式，提升性能
PROTOCOL_REGEX = re.compile(r"^https?://", re.IGNORECASE)
DOMAIN_REGEX = re.compile(r"^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$")
IPV4_REGEX = re.compile(r"^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$")
IPV6_REGEX = re.compile(r"^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$")
PATH_REGEX = re.compile(r"^(/[a-zA-Z0-9._~!$&\'()*+,;=:@%\-]+)*$")
PORT_REGEX = re.compile(r":([0-9]{1,5})$")
# 允许URL中包含查询参数(?)和片段(#)
VALID_CHARS_REGEX = re.compile(r"^[a-zA-Z0-9._~!$&\'()*+,;=:@/?#%-]+$")


class URLValidationError(Exception):
    """
    URL 校验异常

    Attributes:
        error_code: 错误码
        message: 错误信息
        suggestion: 修正建议
        field: 字段名（可选）
    """

    def __init__(self, error_code: str, message: str, suggestion: Optional[str] = None, field: Optional[str] = None):
        self.error_code = error_code
        self.message = message
        self.suggestion = suggestion
        self.field = field
        super().__init__(message)


class URLValidator:
    """
    URL 校验器

    支持配置化的URL校验规则，可通过 add_rule() 添加自定义规则。
    """

    def __init__(self):
        self.custom_rules: List[Tuple[str, Callable[[str], Optional[URLValidationError]]]] = []

    def add_rule(self, name: str, validator: Callable[[str], Optional[URLValidationError]]):
        """
        添加自定义校验规则

        Args:
            name: 规则名称
            validator: 校验函数，接收URL字符串，返回URLValidationError或None
        """
        self.custom_rules.append((name, validator))

    def remove_rule(self, name: str):
        """
        移除自定义校验规则

        Args:
            name: 规则名称
        """
        self.custom_rules = [rule for rule in self.custom_rules if rule[0] != name]

    def validate(self, url: str, field_name: Optional[str] = None) -> Dict[str, Any]:
        """
        完整URL校验

        Args:
            url: 待校验的URL
            field_name: 字段名称（用于错误响应）

        Returns:
            校验结果字典，包含success和error信息

        Raises:
            URLValidationError: 校验失败时抛出
        """
        # 基础格式检查
        if not url or not isinstance(url, str):
            raise URLValidationError(
                error_code="URL_EMPTY", message="URL不能为空", suggestion="请提供有效的URL地址", field=field_name
            )

        # 长度检查
        if len(url) > 2048:
            raise URLValidationError(
                error_code="URL_TOO_LONG",
                message="URL长度超过限制",
                suggestion="URL长度不能超过2048个字符",
                field=field_name,
            )

        # 检查非法字符
        if not VALID_CHARS_REGEX.match(url):
            raise URLValidationError(
                error_code="URL_INVALID_CHARS",
                message="URL包含非法字符",
                suggestion="URL只能包含字母、数字和以下特殊字符：._~!$&'()*+,;=:@/-",
                field=field_name,
            )

        # 解析URL
        try:
            parsed = urllib.parse.urlparse(url)
        except ValueError as e:
            raise URLValidationError(
                error_code="URL_PARSE_ERROR",
                message=f"URL解析失败: {str(e)}",
                suggestion="请检查URL格式是否正确",
                field=field_name,
            )

        # 协议校验
        if not parsed.scheme:
            raise URLValidationError(
                error_code="URL_NO_PROTOCOL",
                message="URL缺少协议",
                suggestion="请添加 http:// 或 https:// 前缀",
                field=field_name,
            )

        if parsed.scheme.lower() not in ("http", "https"):
            raise URLValidationError(
                error_code="URL_INVALID_PROTOCOL",
                message=f"不支持的协议: {parsed.scheme}",
                suggestion="仅支持 http:// 和 https:// 协议",
                field=field_name,
            )

        # 域名校验
        if not parsed.netloc:
            raise URLValidationError(
                error_code="URL_NO_DOMAIN",
                message="URL缺少域名",
                suggestion="请提供有效的域名或IP地址",
                field=field_name,
            )

        # 提取域名（去除端口）
        domain = parsed.hostname or parsed.netloc
        if PORT_REGEX.search(domain):
            domain = PORT_REGEX.sub("", domain)

        # 验证域名格式
        if not self._validate_domain(domain):
            raise URLValidationError(
                error_code="URL_INVALID_DOMAIN",
                message=f"无效的域名格式: {domain}",
                suggestion="域名应由字母、数字和连字符组成，如 example.com",
                field=field_name,
            )

        # 路径校验（如果存在）
        if parsed.path and parsed.path != "/":
            if not PATH_REGEX.match(parsed.path):
                raise URLValidationError(
                    error_code="URL_INVALID_PATH",
                    message=f"无效的路径格式: {parsed.path}",
                    suggestion="路径只能包含字母、数字和以下特殊字符：._~!$&'()*+,;=:@%-",
                    field=field_name,
                )

        # 执行自定义规则
        for rule_name, validator in self.custom_rules:
            error = validator(url)
            if error:
                error.field = field_name
                raise error

        return {
            "success": True,
            "url": url,
            "parsed": {
                "scheme": parsed.scheme,
                "netloc": parsed.netloc,
                "path": parsed.path,
                "query": parsed.query,
                "fragment": parsed.fragment,
            },
        }

    def _validate_domain(self, domain: str) -> bool:
        """
        验证域名格式

        Args:
            domain: 域名

        Returns:
            是否有效
        """
        # 检查IP地址
        if IPV4_REGEX.match(domain):
            return True

        if IPV6_REGEX.match(domain):
            return True

        # 检查域名格式
        if DOMAIN_REGEX.match(domain):
            return True

        # 检查 localhost
        if domain.lower() == "localhost":
            return True

        return False

    def quick_validate(self, url: str) -> bool:
        """
        快速校验（仅返回布尔值，不抛异常）

        Args:
            url: 待校验的URL

        Returns:
            是否有效
        """
        try:
            self.validate(url)
            return True
        except URLValidationError:
            return False


# 创建全局单例验证器
_global_validator = URLValidator()


def get_validator() -> URLValidator:
    """获取全局URL验证器"""
    return _global_validator


def validate_url(url: str, field_name: Optional[str] = None) -> Dict[str, Any]:
    """
    便捷函数：校验URL

    Args:
        url: 待校验的URL
        field_name: 字段名称

    Returns:
        校验结果
    """
    return _global_validator.validate(url, field_name)


def is_valid_url(url: str) -> bool:
    """
    便捷函数：检查URL是否有效

    Args:
        url: 待检查的URL

    Returns:
        是否有效
    """
    return _global_validator.quick_validate(url)


# 预设的常用规则
def create_common_rules(validator: URLValidator):
    """
    为验证器添加常用规则

    Args:
        validator: URLValidator实例
    """

    # 禁止内部IP地址规则
    def deny_internal_ips(url: str) -> Optional[URLValidationError]:
        parsed = urllib.parse.urlparse(url)
        domain = parsed.hostname or ""

        # 检查私有IP范围
        private_ranges = [
            re.compile(r"^10\."),
            re.compile(r"^172\.(1[6-9]|2[0-9]|3[0-1])\."),
            re.compile(r"^192\.168\."),
            re.compile(r"^127\."),
            re.compile(r"^0\.0\.0\.0$"),
            re.compile(r"^localhost$"),
        ]

        for pattern in private_ranges:
            if pattern.match(domain):
                return URLValidationError(
                    error_code="URL_PRIVATE_IP", message="不允许访问内部IP地址", suggestion="请使用公网域名或IP地址"
                )
        return None

    validator.add_rule("deny_internal_ips", deny_internal_ips)

    # HTTPS强制规则
    def require_https(url: str) -> Optional[URLValidationError]:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme.lower() == "http":
            return URLValidationError(
                error_code="URL_HTTP_NOT_ALLOWED", message="不允许使用HTTP协议", suggestion="请使用HTTPS协议"
            )
        return None

    validator.add_rule("require_https", require_https)
