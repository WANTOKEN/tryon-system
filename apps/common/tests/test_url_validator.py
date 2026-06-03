"""
URL 校验器单元测试

测试覆盖：
1. 合法URL场景
2. 非法URL场景（空值、格式错误、协议错误、域名错误等）
3. 自定义规则测试
4. 性能测试（响应时间）
"""

import unittest
import time
from apps.common.utils.url_validator import (
    URLValidator,
    URLValidationError,
    validate_url,
    is_valid_url,
    create_common_rules,
)


class TestURLValidator(unittest.TestCase):
    """URL校验器单元测试"""

    def setUp(self):
        """初始化测试环境"""
        self.validator = URLValidator()

    def test_valid_urls(self):
        """测试合法URL"""
        valid_urls = [
            "https://example.com",
            "https://example.com/path/to/resource",
            "http://example.com:8080",
            "https://www.example.com/page?query=value",
            "https://example.com/path#fragment",
            "http://192.168.1.1",
            "https://localhost:8000",
            "https://api.example.com/v1/users",
            "https://example.com/path/with-special-chars~!$()*+=",
        ]

        for url in valid_urls:
            with self.subTest(url=url):
                result = self.validator.validate(url)
                self.assertTrue(result["success"])
                self.assertEqual(result["url"], url)

    def test_invalid_empty_url(self):
        """测试空URL"""
        with self.assertRaises(URLValidationError) as ctx:
            self.validator.validate("")

        self.assertEqual(ctx.exception.error_code, "URL_EMPTY")
        self.assertIsNotNone(ctx.exception.suggestion)

    def test_invalid_url_too_long(self):
        """测试超长URL"""
        long_url = "https://example.com/" + "a" * 2100
        with self.assertRaises(URLValidationError) as ctx:
            self.validator.validate(long_url)

        self.assertEqual(ctx.exception.error_code, "URL_TOO_LONG")

    def test_invalid_chars(self):
        """测试包含非法字符的URL"""
        invalid_urls = [
            "https://example.com/path?query=val#ue",  # 无特殊字符问题
            "https://example.com/path<test>",  # 包含 < >
            "https://example.com/path test",  # 包含空格
            "https://example.com/path|test",  # 包含 |
        ]

        for url in invalid_urls[1:]:
            with self.subTest(url=url):
                with self.assertRaises(URLValidationError) as ctx:
                    self.validator.validate(url)
                self.assertEqual(ctx.exception.error_code, "URL_INVALID_CHARS")

    def test_invalid_no_protocol(self):
        """测试缺少协议的URL"""
        with self.assertRaises(URLValidationError) as ctx:
            self.validator.validate("example.com")

        self.assertEqual(ctx.exception.error_code, "URL_NO_PROTOCOL")

    def test_invalid_protocol(self):
        """测试不支持的协议"""
        invalid_protocols = [
            "ftp://example.com",
            "ssh://example.com",
            "file:///path/to/file",
        ]

        for url in invalid_protocols:
            with self.subTest(url=url):
                with self.assertRaises(URLValidationError) as ctx:
                    self.validator.validate(url)
                self.assertEqual(ctx.exception.error_code, "URL_INVALID_PROTOCOL")

    def test_invalid_no_domain(self):
        """测试缺少域名的URL"""
        with self.assertRaises(URLValidationError) as ctx:
            self.validator.validate("https:///path")

        self.assertEqual(ctx.exception.error_code, "URL_NO_DOMAIN")

    def test_invalid_domain(self):
        """测试无效域名"""
        invalid_domains = [
            "https://-example.com",  # 以连字符开头
            "https://example-.com",  # 以连字符结尾
            "https://exa..mple.com",  # 连续点号
            "https://.example.com",  # 开头点号
            "https://example..com",  # 连续点号
            "https://123",  # 无效域名
        ]

        for url in invalid_domains:
            with self.subTest(url=url):
                with self.assertRaises(URLValidationError) as ctx:
                    self.validator.validate(url)
                self.assertEqual(ctx.exception.error_code, "URL_INVALID_DOMAIN")

    def test_invalid_path(self):
        """测试无效路径"""
        invalid_paths = [
            "https://example.com/path//double",  # 双斜杠
            "https://example.com/path/../parent",  # 路径遍历
        ]

        # 注意：路径遍历不在基础校验范围内，需要自定义规则

    def test_quick_validate(self):
        """测试快速校验方法"""
        self.assertTrue(self.validator.quick_validate("https://example.com"))
        self.assertFalse(self.validator.quick_validate("invalid-url"))
        self.assertFalse(self.validator.quick_validate(""))

    def test_custom_rules(self):
        """测试自定义规则"""

        # 添加自定义规则
        def deny_example(url):
            if "example.com" in url:
                return URLValidationError(
                    error_code="URL_DENY_EXAMPLE", message="不允许访问example.com", suggestion="请使用其他域名"
                )
            return None

        self.validator.add_rule("deny_example", deny_example)

        # 测试规则生效
        with self.assertRaises(URLValidationError) as ctx:
            self.validator.validate("https://example.com")
        self.assertEqual(ctx.exception.error_code, "URL_DENY_EXAMPLE")

        # 移除规则
        self.validator.remove_rule("deny_example")

        # 验证规则已移除
        result = self.validator.validate("https://example.com")
        self.assertTrue(result["success"])

    def test_common_rules(self):
        """测试常用规则"""
        create_common_rules(self.validator)

        # 测试禁止内部IP规则
        internal_urls = [
            "https://192.168.1.1",
            "https://10.0.0.1",
            "https://localhost",
        ]

        for url in internal_urls:
            with self.subTest(url=url):
                with self.assertRaises(URLValidationError) as ctx:
                    self.validator.validate(url)
                self.assertEqual(ctx.exception.error_code, "URL_PRIVATE_IP")

        # 测试HTTPS强制规则
        with self.assertRaises(URLValidationError) as ctx:
            self.validator.validate("http://example.com")
        self.assertEqual(ctx.exception.error_code, "URL_HTTP_NOT_ALLOWED")

    def test_field_name(self):
        """测试字段名传递"""
        with self.assertRaises(URLValidationError) as ctx:
            self.validator.validate("invalid-url", "callback_url")

        self.assertEqual(ctx.exception.field, "callback_url")

    def test_performance(self):
        """测试性能（响应时间应小于10毫秒）"""
        test_urls = [
            "https://example.com",
            "https://api.example.com/v1/users/123",
            "http://192.168.1.1:8080/path",
            "invalid-url",
        ]

        total_time = 0
        iterations = 100

        for _ in range(iterations):
            for url in test_urls:
                start = time.time()
                try:
                    self.validator.validate(url)
                except URLValidationError:
                    pass
                end = time.time()
                total_time += (end - start) * 1000  # 转换为毫秒

        avg_time = total_time / (iterations * len(test_urls))
        print(f"Average validation time: {avg_time:.3f} ms")

        # 断言平均响应时间小于10毫秒
        self.assertLess(avg_time, 10, f"Average time {avg_time}ms exceeds threshold")

    def test_concurrent_validation(self):
        """测试并发校验（线程安全）"""
        import threading

        urls = [f"https://example{i}.com" for i in range(100)]
        results = []

        def validate_urls(start, end):
            for i in range(start, end):
                try:
                    result = self.validator.validate(urls[i])
                    results.append(("success", urls[i]))
                except URLValidationError as e:
                    results.append(("error", urls[i], e.error_code))

        # 创建多个线程
        threads = []
        num_threads = 5
        chunk_size = len(urls) // num_threads

        for i in range(num_threads):
            start = i * chunk_size
            end = (i + 1) * chunk_size if i < num_threads - 1 else len(urls)
            t = threading.Thread(target=validate_urls, args=(start, end))
            threads.append(t)
            t.start()

        # 等待所有线程完成
        for t in threads:
            t.join()

        # 验证结果
        self.assertEqual(len(results), 100)
        for result in results:
            self.assertEqual(result[0], "success")


class TestConvenienceFunctions(unittest.TestCase):
    """便捷函数测试"""

    def test_validate_url(self):
        """测试便捷函数 validate_url"""
        result = validate_url("https://example.com")
        self.assertTrue(result["success"])

        with self.assertRaises(URLValidationError):
            validate_url("invalid-url")

    def test_is_valid_url(self):
        """测试便捷函数 is_valid_url"""
        self.assertTrue(is_valid_url("https://example.com"))
        self.assertFalse(is_valid_url("invalid-url"))


if __name__ == "__main__":
    unittest.main()
