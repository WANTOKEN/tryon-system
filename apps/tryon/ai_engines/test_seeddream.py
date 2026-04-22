#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
SeedDream AI 引擎可用性测试

使用方法:
    python test_seeddream.py          # 测试 API 调用
    python test_seeddream.py --check  # 仅检查配置
"""
import os
import sys
import time
import argparse
import io

# 设置标准输出编码为 UTF-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# 添加项目路径 (向上 4 级到项目根目录)
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
sys.path.insert(0, project_root)

# 设置 Django 环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()


def main():
    parser = argparse.ArgumentParser(description='SeedDream AI 引擎可用性测试')
    parser.add_argument('--check', action='store_true', help='仅检查配置')
    args = parser.parse_args()
    
    print("\n" + "=" * 50)
    print("  SeedDream AI 引擎可用性测试")
    print("=" * 50 + "\n")
    
    # 导入引擎
    from apps.tryon.ai_engines.seeddance import SeedDanceEngine
    
    engine = SeedDanceEngine()
    info = engine.get_model_info()
    
    # 显示配置信息
    print(f"引擎名称: {info['display_name']}")
    print(f"模型 ID:  {info['model_id']}")
    print(f"API 端点: {info['base_url']}")
    print(f"已配置:   {'是' if info['configured'] else '否 (请设置 ARK_API_KEY)'}")
    print()
    
    # 仅检查配置
    if args.check:
        if info['configured']:
            print("✅ 配置正常")
        else:
            print("❌ 配置不完整，请设置 ARK_API_KEY")
        return
    
    # 测试 API 调用
    if not info['configured']:
        print("❌ 配置不完整，跳过 API 测试")
        print("   请设置环境变量: ARK_API_KEY")
        return
    
    print("正在测试 API 调用...")
    
    # 测试图片 URL
    test_avatar = "https://test-9977.oss-cn-shenzhen.aliyuncs.com/test%2F55e87a11f56d241f8ab3e9a5eede90b9.png?OSSAccessKeyId=LTAI5t7WBPHgZ1RWQMB8NLRv&Expires=1776847390&Signature=i97BlzRwAZTPLX4s%2Fn3PftWaQXc%3D"
    test_clothing = "https://test-9977.oss-cn-shenzhen.aliyuncs.com/test%2Fb8bbd502c268d72802a75696255b3eda.webp?OSSAccessKeyId=LTAI5t7WBPHgZ1RWQMB8NLRv&Expires=1776847390&Signature=PxOUkx5HXDVdj78jLtdxjX1cSXs%3D"
    
    start = time.time()
    
    result = engine.submit_task(
        avatar_url=test_avatar,
        clothing_urls=[test_clothing],
        prompt="将图1的服装换为图2的服装",
        size="1K",
    )
    
    elapsed = time.time() - start
    
    print()
    if result['success']:
        print(f"✅ API 调用成功 (耗时 {elapsed:.2f}s)")
        print(f"   任务 ID: {result['task_id']}")
        print(f"   结果 URL: {result['result_url']}")
    else:
        print(f"❌ API 调用失败: {result['error_message']}")

# python apps/tryon/ai_engines/test_seeddream.py
if __name__ == '__main__':
    main()
