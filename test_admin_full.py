#!/usr/bin/env python3
"""
Admin API 完整功能验证测试
"""

import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
sys.path.insert(0, '/Users/apple/my_project')
django.setup()

from rest_framework.test import APIClient  # 使用DRF的APIClient
from apps.accounts.models import Merchant
from apps.wardrobe.models import Clothing
import json

# 使用正确的HTTP_HOST
client = APIClient(enforce_csrf_checks=False)
client.credentials(HTTP_HOST='localhost')

print("="*60)
print("Admin 功能验证测试")
print("="*60)
print()

# 1. 创建测试管理员
print("【1】创建测试管理员")
try:
    # 删除已存在的测试用户
    Merchant.objects.filter(username='test_admin').delete()
    
    # 创建测试管理员
    admin = Merchant.objects.create_superuser(
        username='test_admin',
        phone='13800138000',
        password='test_password',
        store_name='测试管理员',
        is_active=True,
        is_staff=True,
        is_superuser=True,
    )
    print("✓ 测试管理员创建成功")
    print(f"  - 用户ID: {admin.id}")
    print(f"  - 用户名: {admin.username}")
except Exception as e:
    print(f"✗ 创建测试管理员失败: {e}")
print()

# 2. 测试管理员登录
print("【2】测试管理员登录")
response = client.post(
    '/api/admin/auth/login/',
    json.dumps({'username': 'test_admin', 'password': 'test_password', 'encrypted': False}),
    content_type='application/json',
    HTTP_HOST='localhost'
)
if response.status_code == 200:
    data = response.json()
    print("✓ 登录成功")
    print(f"  - access_token: {data.get('access_token', '')[:20]}...")
    print(f"  - 用户: {data.get('user', {}).get('username')}")
    token = data.get('access_token')
else:
    print(f"✗ 登录失败 (状态码: {response.status_code})")
    print(f"  - 错误信息: {response.json()}")
    token = None
print()

# 3. 测试获取服装列表
print("【3】测试获取服装列表")
if token:
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    response = client.get('/api/admin/clothing/', HTTP_HOST='localhost')
    if response.status_code == 200:
        data = response.json()
        print("✓ 获取服装列表成功")
        # 使用自定义分页器格式
        total = data.get('data', {}).get('total', 0)
        items = data.get('data', {}).get('items', [])
        print(f"  - 总数: {total}")
        if items:
            print(f"  - 第一条服装: {items[0].get('name', 'N/A')}")
    else:
        print(f"✗ 获取服装列表失败 (状态码: {response.status_code})")
        try:
            print(f"  - 错误信息: {response.json()}")
        except:
            print(f"  - 响应内容: {response.content[:500]}")
else:
    print("✗ 跳过测试（未登录）")
print()

# 4. 测试创建服装
print("【4】测试创建服装")
if token:
    clothing_data = {
        'name': '测试T恤',
        'category': 'tops',
        'subcategory': 't-shirt',
        'color': '#FF0000',
        'price': 99.00,
        'sizes': ['S', 'M', 'L']
    }
    response = client.post(
        '/api/admin/clothing/',
        json.dumps(clothing_data),
        content_type='application/json',
        HTTP_HOST='localhost'
    )
    if response.status_code in [200, 201]:
        data = response.json()
        print("✓ 创建服装成功")
        print(f"  - 服装ID: {data.get('id', 'N/A')}")
        print(f"  - 名称: {data.get('name', 'N/A')}")
        print(f"  - 分类: {data.get('category', 'N/A')}")
    else:
        print(f"✗ 创建服装失败 (状态码: {response.status_code})")
        try:
            print(f"  - 错误信息: {response.json()}")
        except:
            print(f"  - 响应内容: {response.content[:500]}")
else:
    print("✗ 跳过测试（未登录）")
print()

# 5. 测试分类筛选
print("【5】测试分类筛选")
if token:
    # 先创建几条测试数据
    Clothing.objects.create(
        merchant_id=admin.id,
        name='测试裤子',
        category='bottoms',
        subcategory='pants',
        price=199.0
    )
    Clothing.objects.create(
        merchant_id=admin.id,
        name='测试连衣裙',
        category='dresses',
        subcategory='casual-dress',
        price=299.0
    )
    
    response = client.get('/api/admin/clothing/?category=tops', HTTP_HOST='localhost')
    if response.status_code == 200:
        data = response.json()
        count = data.get('data', {}).get('total', 0)
        print("✓ 分类筛选成功")
        print(f"  - tops分类服装数量: {count}")
    else:
        print(f"✗ 分类筛选失败 (状态码: {response.status_code})")
else:
    print("✗ 跳过测试（未登录）")
print()

# 6. 测试商家管理
print("【6】测试商家管理")
if token:
    response = client.get('/api/admin/merchants/', HTTP_HOST='localhost')
    if response.status_code == 200:
        data = response.json()
        count = data.get('data', {}).get('total', 0)
        print("✓ 获取商家列表成功")
        print(f"  - 商家总数: {count}")
    else:
        print(f"✗ 获取商家列表失败 (状态码: {response.status_code})")
        try:
            print(f"  - 错误信息: {response.json()}")
        except:
            print(f"  - 响应内容: {response.content[:500]}")
else:
    print("✗ 跳过测试（未登录）")
print()

# 7. 测试系统统计
print("【7】测试系统统计")
if token:
    response = client.get('/api/admin/system/stats/', HTTP_HOST='localhost')
    if response.status_code == 200:
        data = response.json()
        print("✓ 获取系统统计成功")
        print(f"  - 商家总数: {data.get('total_merchants', 0)}")
        print(f"  - 服装总数: {data.get('total_clothing', 0)}")
        print(f"  - 试穿记录: {data.get('total_tryon_records', 0)}")
    else:
        print(f"✗ 获取系统统计失败 (状态码: {response.status_code})")
        try:
            print(f"  - 错误信息: {response.json()}")
        except:
            print(f"  - 响应内容: {response.content[:500]}")
else:
    print("✗ 跳过测试（未登录）")
print()

print("="*60)
print("测试完成")
print("="*60)
