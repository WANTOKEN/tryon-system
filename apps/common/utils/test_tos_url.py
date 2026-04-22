#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
TOS 签名 URL 工具测试（简化版）

使用方法:
    python test_tos_url.py                    # 测试示例 URL
    python test_tos_url.py --url "https://..." # 测试指定 URL
"""
import os
import sys
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse, parse_qs

# 设置编码
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

# 示例 TOS 签名 URL
EXAMPLE_URL = (
    "https://ark-acg-cn-beijing.tos-cn-beijing.volces.com"
    "/doubao-seedream-5-0/02177684821535136e5ad32e3806a7503d1b9484cfb9294ab72bf_0.png"
    "?X-Tos-Algorithm=TOS4-HMAC-SHA256"
    "&X-Tos-Credential=AKLTYWJkZTExNjA1ZDUyNDc3YzhjNTM5OGIyNjBhNDcyOTQ%2F20260422%2Fcn-beijing%2Ftos%2Frequest"
    "&X-Tos-Date=20260422T085723Z"
    "&X-Tos-Expires=86400"
    "&X-Tos-Signature=9892fc206263ebf21730f1fb339e0be1c07108185c27d934e99a57d684bc8ad5"
    "&X-Tos-SignedHeaders=host"
)


def parse_tos_url(url: str):
    """解析 TOS 签名 URL"""
    parsed = urlparse(url)
    params = parse_qs(parsed.query)
    
    # 提取 bucket
    bucket = parsed.netloc.split('.')[0] if '.' in parsed.netloc else ''
    
    # 提取对象路径
    object_key = parsed.path.lstrip('/')
    
    # 获取签名参数
    sign_date = params.get('X-Tos-Date', [''])[0]
    expires = int(params.get('X-Tos-Expires', ['0'])[0])
    
    # 计算过期时间
    expires_at = None
    remaining = 0
    if sign_date and expires:
        try:
            sign_dt = datetime.strptime(sign_date, '%Y%m%dT%H%M%SZ')
            sign_dt = sign_dt.replace(tzinfo=timezone.utc)
            expires_at = sign_dt + timedelta(seconds=expires)
            remaining = max(0, int((expires_at - datetime.now(timezone.utc)).total_seconds()))
        except:
            pass
    
    return {
        'bucket': bucket,
        'object_key': object_key,
        'sign_date': sign_date,
        'expires_seconds': expires,
        'expires_at': expires_at,
        'remaining_seconds': remaining,
        'is_expired': remaining <= 0,
    }


def main():
    # 获取 URL
    url = EXAMPLE_URL
    if len(sys.argv) > 1 and sys.argv[1] == '--url' and len(sys.argv) > 2:
        url = sys.argv[2]
    
    print(f"\n📝 URL: {url}")
    
    # 解析
    info = parse_tos_url(url)
    
    print(f"\n✅ 解析结果:")
    print(f"   Bucket:     {info['bucket']}")
    print(f"   Object:     {info['object_key']}")
    print(f"   签名时间:   {info['sign_date']}")
    print(f"   有效期:     {info['expires_seconds']}s ({info['expires_seconds']//3600}h)")
    print(f"   过期时间:   {info['expires_at']}")
    print(f"   剩余时间:   {info['remaining_seconds']}s ({info['remaining_seconds']//3600}h)")
    print(f"   状态:       {'❌ 已过期' if info['is_expired'] else '✅ 未过期'}\n")


if __name__ == '__main__':
    main()
