#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
存储服务可用性测试

使用方法:
    python test_storage.py          # 完整测试
    python test_storage.py --check  # 仅检查配置
"""
import os
import sys
import io
import argparse

# 设置标准输出编码为 UTF-8
import io as _io
sys.stdout = _io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = _io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# 添加项目路径
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
sys.path.insert(0, project_root)

# 设置 Django 环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()


def main():
    parser = argparse.ArgumentParser(description='存储服务可用性测试')
    parser.add_argument('--check', action='store_true', help='仅检查配置')
    args = parser.parse_args()
    
    print("\n" + "=" * 50)
    print("  存储服务可用性测试")
    print("=" * 50 + "\n")
    
    from apps.common.services.storage_service import StorageService
    from apps.common.services.upload_config import (
        ALLOWED_IMAGE_TYPES,
        MAX_FILE_SIZE,
        ALLOWED_EXTENSIONS,
        UploadValidationError
    )
    
    # 显示配置
    storage_type = os.getenv('STORAGE_TYPE', 'local')
    print(f"存储类型: {storage_type}")
    print(f"允许类型: {list(ALLOWED_IMAGE_TYPES.keys())}")
    print(f"最大大小: {MAX_FILE_SIZE // 1024 // 1024}MB")
    print()
    
    # 仅检查配置
    if args.check:
        print("✅ 配置正常")
        return
    
    storage = StorageService()
    
    # 测试图片列表
    test_images = [
        ('people.png', 'image/png'),
        ('cloths.webp', 'image/webp'),
    ]
    
    uploaded_keys = []
    
    for filename, content_type in test_images:
        test_image_path = os.path.join(project_root, f'apps/common/services/images/{filename}')
        if not os.path.exists(test_image_path):
            print(f"⚠️  测试图片不存在，跳过: {test_image_path}")
            continue
        
        # 测试上传
        print(f"\n测试上传 {filename}...")
        with open(test_image_path, 'rb') as f:
            test_content = f.read()
        
        test_file = io.BytesIO(test_content)
        
        try:
            key, url, is_dup = storage.upload_file(
                file_obj=test_file,
                filename=filename,
                folder='test',
                tenant_id='test_tenant',
                content_type=content_type,
                skip_duplicate=True,
            )
            uploaded_keys.append(key)
            print(f"✅ 上传成功 {'(重复跳过)' if is_dup else ''}")
            print(f"   存储路径: {key}")
            print(f"   访问 URL: {url}")
        except UploadValidationError as e:
            print(f"❌ 验证失败: {e}")
            continue
    
    if not uploaded_keys:
        print("\n❌ 没有成功上传的文件")
        return
    
    # 测试获取 URL
    print("\n" + "-" * 40)
    print("测试获取 URL...")
    
    # 先查看数据库记录
    from apps.common.models import FileUploadRecord
    
    for key in uploaded_keys:
        print(f"\n存储路径: {key}")
        try:
            record = FileUploadRecord.objects.get(storage_key=key, storage_type=storage_type)
            print(f"   数据库记录: storage_type={record.storage_type}, md5={record.md5_hash}")
        except FileUploadRecord.DoesNotExist:
            print("   数据库记录: 未找到")
        
        url = storage.get_url_by_key(key, tenant_id='test_tenant')
        print(f"✅ 获取 URL:")
        print(f"   {url}")
        
        # 检查是否是签名 URL
        if 'OSSAccessKeyId' in url or 'Signature' in url:
            print("   类型: 签名 URL（可直接访问）")
        elif url.startswith('http://') or url.startswith('https://'):
            print("   类型: 完整 URL（本地存储）")
        else:
            print("   类型: 相对路径（需要拼接域名）")
    
    print("\n" + "=" * 50)
    print("  测试完成")
    print("=" * 50)

# python apps/common/services/test_storage.py
if __name__ == '__main__':
    main()
