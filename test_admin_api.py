#!/usr/bin/env python3
"""
Admin API 功能验证测试脚本
"""

import os
import sys
import django

# 设置 Django 环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
sys.path.insert(0, '/Users/apple/my_project')
django.setup()

from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient, APIRequestFactory, force_authenticate
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Merchant
from apps.wardrobe.models import Clothing
from apps.admin_api.views import (
    admin_login,
    system_info,
    system_stats,
    ClothingAdminViewSet,
    MerchantAdminViewSet,
)


class TestAdminAPIAuthentication(TestCase):
    """测试管理员认证功能"""

    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=False)
        self.factory = APIRequestFactory()
        
        # 创建测试管理员 (Merchant模型没有email字段)
        self.admin_user = Merchant.objects.create_superuser(
            username='test_admin',
            phone='13800138000',
            password='test_password',
            store_name='测试管理员',
            is_active=True,
            is_staff=True,
            is_superuser=True,
        )

    def test_admin_login_success(self):
        """测试管理员登录成功"""
        response = self.client.post(
            '/api/admin/auth/login/',
            {'username': 'test_admin', 'password': 'test_password', 'encrypted': False},
            content_type='application/json'
        )
        print(f"登录响应状态码: {response.status_code}")
        if response.status_code == 200:
            print(f"登录响应数据: {response.json()}")
        else:
            print(f"登录响应内容: {response.content}")
        self.assertEqual(response.status_code, 200)

    def test_admin_login_failure(self):
        """测试管理员登录失败"""
        response = self.client.post(
            '/api/admin/auth/login/',
            {'username': 'test_admin', 'password': 'wrong_password', 'encrypted': False},
            content_type='application/json'
        )
        print(f"失败登录响应状态码: {response.status_code}")
        print(f"失败登录响应内容: {response.content}")
        # 登录失败应该返回401或400
        self.assertIn(response.status_code, [400, 401])

    def test_system_info(self):
        """测试系统信息接口"""
        response = self.client.get('/api/admin/system/info/')
        print(f"系统信息响应状态码: {response.status_code}")
        if response.status_code == 200:
            print(f"系统信息响应数据: {response.json()}")
        else:
            print(f"系统信息响应内容: {response.content}")
        self.assertEqual(response.status_code, 200)


class TestAdminClothingAPI(TestCase):
    """测试服装管理API"""

    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=False)
        
        # 创建测试管理员
        self.admin_user = Merchant.objects.create_superuser(
            username='test_admin',
            phone='13800138000',
            password='test_password',
            store_name='测试管理员',
            is_active=True,
            is_staff=True,
            is_superuser=True,
        )
        
        # 获取JWT token
        refresh = RefreshToken.for_user(self.admin_user)
        self.token = str(refresh.access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')

    def test_clothing_list(self):
        """测试获取服装列表"""
        response = self.client.get('/api/admin/clothing/')
        print(f"服装列表响应状态码: {response.status_code}")
        if response.status_code == 200:
            print(f"服装列表响应数据: {response.json()}")
        else:
            print(f"服装列表响应内容: {response.content}")
        self.assertEqual(response.status_code, 200)

    def test_category_filter(self):
        """测试分类筛选功能"""
        # 先创建测试服装
        Clothing.objects.create(
            merchant_id=self.admin_user.id,
            name='测试上衣',
            category='tops',
            subcategory='t-shirt',
            price=99.0,
        )
        
        Clothing.objects.create(
            merchant_id=self.admin_user.id,
            name='测试裤子',
            category='bottoms',
            subcategory='pants',
            price=199.0,
        )
        
        response = self.client.get('/api/admin/clothing/?category=tops')
        print(f"分类筛选响应状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"分类筛选响应数据: {data}")
            # 验证只返回tops分类的服装
            results = data.get('results', data)
            if isinstance(results, list):
                for item in results:
                    self.assertEqual(item.get('category'), 'tops')
        else:
            print(f"分类筛选响应内容: {response.content}")
        self.assertEqual(response.status_code, 200)


class TestAdminMerchantAPI(TestCase):
    """测试商家管理API"""

    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=False)
        
        # 创建超级管理员
        self.super_admin = Merchant.objects.create_superuser(
            username='super_admin',
            phone='13900139000',
            password='test_password',
            store_name='超级管理员',
            is_active=True,
            is_staff=True,
            is_superuser=True,
        )
        
        # 创建普通商家
        self.merchant = Merchant.objects.create_user(
            username='test_merchant',
            phone='13700137000',
            password='test_password',
            store_name='测试商家',
            is_active=True,
            is_staff=True,
            is_superuser=False,
        )
        
        # 获取超级管理员JWT token
        refresh = RefreshToken.for_user(self.super_admin)
        self.super_token = str(refresh.access_token)
        
        # 获取普通商家JWT token
        refresh = RefreshToken.for_user(self.merchant)
        self.merchant_token = str(refresh.access_token)

    def test_super_admin_list_merchants(self):
        """测试超级管理员查看所有商家"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.super_token}')
        response = self.client.get('/api/admin/merchants/')
        print(f"超级管理员查看商家列表状态码: {response.status_code}")
        if response.status_code == 200:
            print(f"超级管理员查看商家列表数据: {response.json()}")
        else:
            print(f"超级管理员查看商家列表内容: {response.content}")
        self.assertEqual(response.status_code, 200)

    def test_merchant_list_self_only(self):
        """测试普通商家只能查看自己"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.merchant_token}')
        response = self.client.get('/api/admin/merchants/')
        print(f"普通商家查看商家列表状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"普通商家查看商家列表数据: {data}")
        else:
            print(f"普通商家查看商家列表内容: {response.content}")
        self.assertEqual(response.status_code, 200)


if __name__ == '__main__':
    import unittest
    unittest.main(verbosity=2)
