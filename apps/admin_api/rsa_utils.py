"""
RSA 加密工具
用于密码传输加密
"""
import base64
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.backends import default_backend
from django.core.cache import cache


def generate_rsa_key_pair():
    """生成 RSA 密钥对"""
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend()
    )
    
    # 私钥 PEM 格式
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )
    
    # 公钥 PEM 格式
    public_key = private_key.public_key()
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    
    return private_pem.decode('utf-8'), public_pem.decode('utf-8')


def get_or_create_rsa_keys():
    """获取或创建 RSA 密钥对（缓存 1 小时）"""
    cache_key_private = 'rsa_private_key'
    cache_key_public = 'rsa_public_key'
    
    private_key = cache.get(cache_key_private)
    public_key = cache.get(cache_key_public)
    
    if not private_key or not public_key:
        private_key, public_key = generate_rsa_key_pair()
        # 缓存 1 小时
        cache.set(cache_key_private, private_key, 3600)
        cache.set(cache_key_public, public_key, 3600)
    
    return private_key, public_key


def decrypt_password(encrypted_base64: str) -> str:
    """解密前端传输的密码"""
    private_key_pem, _ = get_or_create_rsa_keys()
    
    # 加载私钥
    private_key = serialization.load_pem_private_key(
        private_key_pem.encode('utf-8'),
        password=None,
        backend=default_backend()
    )
    
    # Base64 解码
    encrypted_bytes = base64.b64decode(encrypted_base64)
    
    # RSA 解密
    decrypted_bytes = private_key.decrypt(
        encrypted_bytes,
        padding.PKCS1v15()
    )
    
    return decrypted_bytes.decode('utf-8')
