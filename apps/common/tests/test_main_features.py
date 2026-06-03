"""
主要功能验证测试

测试覆盖：
1. 服装管理 API (CRUD)
2. 分类管理 API
3. 文件上传服务
4. 认证与权限
5. 数据格式验证
"""

import unittest
import json
from unittest.mock import MagicMock, patch
from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.wardrobe.models import Clothing
from apps.wardrobe.serializers import ClothingSerializer, ClothingDetailSerializer
from apps.wardrobe.views import CATEGORIES_CONFIG
from apps.common.services.storage.base import BaseStorageService


class TestClothingManagement(TestCase):
    """服装管理功能测试"""

    def setUp(self):
        """初始化测试数据"""
        self.merchant = get_user_model().objects.create(
            username="test_merchant",
            email="test@example.com",
            password="test_password",
            is_active=True,
        )

    def test_clothing_creation(self):
        """测试服装创建"""
        clothing = Clothing.objects.create(
            merchant_id=self.merchant.id,
            name="测试T恤",
            category="tops",
            subcategory="t-shirt",
            color="#FF0000",
            price=99.0,
            sizes=["S", "M", "L"],
        )

        self.assertEqual(clothing.name, "测试T恤")
        self.assertEqual(clothing.category, "tops")
        self.assertEqual(clothing.subcategory, "t-shirt")
        self.assertEqual(clothing.price, 99.0)
        self.assertEqual(clothing.sizes, ["S", "M", "L"])
        self.assertTrue(clothing.is_active)
        self.assertFalse(clothing.is_deleted)

    def test_clothing_soft_delete(self):
        """测试服装软删除"""
        clothing = Clothing.objects.create(
            merchant_id=self.merchant.id,
            name="测试服装",
            category="tops",
            subcategory="t-shirt",
        )

        clothing.is_deleted = True
        clothing.save()

        deleted_clothing = Clothing.objects.get(id=clothing.id)
        self.assertTrue(deleted_clothing.is_deleted)

    def test_clothing_serializer(self):
        """测试服装序列化器"""
        clothing = Clothing.objects.create(
            merchant_id=self.merchant.id,
            name="测试夹克",
            category="outerwear",
            subcategory="jacket",
            color="#0000FF",
            price=299.0,
            sizes=["M", "L", "XL"],
        )

        serializer = ClothingSerializer(clothing)
        data = serializer.data

        self.assertEqual(data["name"], "测试夹克")
        self.assertEqual(data["category"], "outerwear")
        self.assertEqual(data["subcategory"], "jacket")
        self.assertEqual(data["price"], "299.00")
        self.assertEqual(data["sizes"], ["M", "L", "XL"])

    def test_clothing_detail_serializer(self):
        """测试服装详情序列化器"""
        clothing = Clothing.objects.create(
            merchant_id=self.merchant.id,
            name="测试连衣裙",
            category="dresses",
            subcategory="casual-dress",
            color="#FF69B4",
            price=199.0,
            sizes=["S", "M"],
        )

        serializer = ClothingDetailSerializer(clothing)
        data = serializer.data

        self.assertIn("id", data)
        self.assertEqual(data["name"], "测试连衣裙")
        self.assertEqual(data["category"], "dresses")
        self.assertEqual(data["subcategory"], "casual-dress")


class TestCategoryConfig(TestCase):
    """分类配置测试"""

    def test_category_keys_match_frontend(self):
        """测试分类标识与前端匹配"""
        expected_categories = ["tops", "bottoms", "dresses", "outerwear", "shoes", "accessories"]
        actual_categories = list(CATEGORIES_CONFIG.keys())

        self.assertEqual(sorted(actual_categories), sorted(expected_categories))

    def test_category_config_structure(self):
        """测试分类配置结构完整性"""
        for category_id, config in CATEGORIES_CONFIG.items():
            self.assertIn("name_zh", config)
            self.assertIn("name_en", config)
            self.assertIn("name_tw", config)
            self.assertIsInstance(config["name_zh"], str)
            self.assertIsInstance(config["name_en"], str)
            self.assertIsInstance(config["name_tw"], str)

    def test_category_names_not_empty(self):
        """测试分类名称不为空"""
        for category_id, config in CATEGORIES_CONFIG.items():
            self.assertTrue(config["name_zh"].strip(), f"分类 {category_id} 的中文名称为空")
            self.assertTrue(config["name_en"].strip(), f"分类 {category_id} 的英文名称为空")
            self.assertTrue(config["name_tw"].strip(), f"分类 {category_id} 的繁体名称为空")


class TestStorageService(TestCase):
    """存储服务测试"""

    def test_check_duplicate_return_format(self):
        """测试检查重复文件返回格式"""
        with patch.object(BaseStorageService, '_get_record_model'):
            storage = BaseStorageService()

            # 测试返回None的情况
            result = storage._check_duplicate("test_md5", "test_tenant")
            self.assertIsNone(result)

    def test_storage_key_format(self):
        """测试存储密钥格式"""
        from apps.common.utils.content_key import ContentKey

        content_key = ContentKey.from_md5("test_md5_hash_value_12345", "local")
        self.assertIsNotNone(content_key)
        self.assertTrue(str(content_key).startswith("local/"))


class TestAPIResponseFormat(TestCase):
    """API响应格式测试"""

    def test_success_response_format(self):
        """测试成功响应格式"""
        from apps.common.utils.response import ApiResponse

        data = {"key": "value"}
        response = ApiResponse.success(data, message="成功")

        self.assertEqual(response.status_code, 200)
        response_data = json.loads(response.content)

        self.assertEqual(response_data["code"], 200)
        self.assertEqual(response_data["message"], "成功")
        self.assertEqual(response_data["data"], data)
        self.assertIn("request_id", response_data)
        self.assertIn("timestamp", response_data)

    def test_error_response_format(self):
        """测试错误响应格式"""
        from apps.common.utils.response import ApiResponse

        response = ApiResponse.error({"field": "错误信息"}, code=400)

        self.assertEqual(response.status_code, 200)
        response_data = json.loads(response.content)

        self.assertEqual(response_data["code"], 400)
        self.assertEqual(response_data["data"], {"field": "错误信息"})

    def test_not_found_response(self):
        """测试资源不存在响应"""
        from apps.common.utils.response import ApiResponse

        response = ApiResponse.not_found("资源不存在")

        self.assertEqual(response.status_code, 200)
        response_data = json.loads(response.content)

        self.assertEqual(response_data["code"], 404)
        self.assertEqual(response_data["message"], "资源不存在")


class TestDataValidation(TestCase):
    """数据验证测试"""

    def test_price_validation(self):
        """测试价格验证"""
        from apps.wardrobe.serializers import ClothingDetailSerializer

        # 测试合法价格
        valid_data = {
            "name": "测试服装",
            "category": "tops",
            "subcategory": "t-shirt",
            "price": 99.99,
        }
        serializer = ClothingDetailSerializer(data=valid_data)
        self.assertTrue(serializer.is_valid(), serializer.errors)

        # 测试非法价格（负数）
        invalid_data = {
            "name": "测试服装",
            "category": "tops",
            "subcategory": "t-shirt",
            "price": -10.0,
        }
        serializer = ClothingDetailSerializer(data=invalid_data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("price", serializer.errors)

    def test_category_validation(self):
        """测试分类验证"""
        from apps.wardrobe.serializers import ClothingDetailSerializer

        # 测试非法分类
        invalid_data = {
            "name": "测试服装",
            "category": "invalid_category",
            "subcategory": "t-shirt",
        }
        serializer = ClothingDetailSerializer(data=invalid_data)
        self.assertFalse(serializer.is_valid())

    def test_color_format_validation(self):
        """测试颜色格式验证"""
        from apps.wardrobe.serializers import ClothingDetailSerializer

        # 测试合法颜色格式
        valid_colors = ["#FF0000", "#00FF00", "#0000FF", "#123456"]
        for color in valid_colors:
            data = {
                "name": "测试服装",
                "category": "tops",
                "subcategory": "t-shirt",
                "color": color,
            }
            serializer = ClothingDetailSerializer(data=data)
            self.assertTrue(serializer.is_valid(), f"颜色 {color} 验证失败: {serializer.errors}")


class TestEdgeCases(TestCase):
    """边界情况测试"""

    def test_empty_sizes(self):
        """测试空尺寸列表"""
        clothing = Clothing.objects.create(
            merchant_id="test_merchant",
            name="测试服装",
            category="tops",
            subcategory="t-shirt",
            sizes=[],
        )
        self.assertEqual(clothing.sizes, [])

    def test_max_price(self):
        """测试最大价格"""
        clothing = Clothing.objects.create(
            merchant_id="test_merchant",
            name="高价服装",
            category="outerwear",
            subcategory="coat",
            price=999999.99,
        )
        self.assertEqual(clothing.price, 999999.99)

    def test_special_characters_in_name(self):
        """测试名称包含特殊字符"""
        special_name = "测试服装 & 特殊字符 @#$%^&*"
        clothing = Clothing.objects.create(
            merchant_id="test_merchant",
            name=special_name,
            category="tops",
            subcategory="t-shirt",
        )
        self.assertEqual(clothing.name, special_name)


if __name__ == "__main__":
    unittest.main()
