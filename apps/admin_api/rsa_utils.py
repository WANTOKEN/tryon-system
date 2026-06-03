"""
RSA 加密工具
用于密码传输加密
"""

import os
import base64
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.backends import default_backend
from django.conf import settings


def get_rsa_key_paths():
    """获取 RSA 密钥文件路径"""
    keys_dir = os.path.join(settings.BASE_DIR, "keys")
    os.makedirs(keys_dir, exist_ok=True)
    private_key_path = os.path.join(keys_dir, "private_key.pem")
    public_key_path = os.path.join(keys_dir, "public_key.pem")
    return private_key_path, public_key_path


def generate_rsa_key_pair():
    """生成 RSA 密钥对"""
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048, backend=default_backend())

    # 私钥 PEM 格式
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )

    # 公钥 PEM 格式
    public_key = private_key.public_key()
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM, format=serialization.PublicFormat.SubjectPublicKeyInfo
    )

    return private_pem.decode("utf-8"), public_pem.decode("utf-8")


def get_or_create_rsa_keys():
    """获取或创建 RSA 密钥对（保存到文件）"""
    private_key_path, public_key_path = get_rsa_key_paths()

    # 如果密钥文件存在，直接读取
    if os.path.exists(private_key_path) and os.path.exists(public_key_path):
        try:
            with open(private_key_path, "r", encoding="utf-8") as f:
                private_key = f.read()
            with open(public_key_path, "r", encoding="utf-8") as f:
                public_key = f.read()
            return private_key, public_key
        except Exception as e:
            print(f"[RSA] 读取密钥文件失败: {e}")

    # 生成新的密钥对
    private_key, public_key = generate_rsa_key_pair()

    # 保存到文件
    try:
        with open(private_key_path, "w", encoding="utf-8") as f:
            f.write(private_key)
        with open(public_key_path, "w", encoding="utf-8") as f:
            f.write(public_key)
        print(f"[RSA] 密钥对已生成并保存到 {private_key_path}")
    except Exception as e:
        print(f"[RSA] 保存密钥文件失败: {e}")

    return private_key, public_key


def decrypt_password(encrypted_base64: str) -> str:
    """解密前端传输的密码"""
    private_key_pem, _ = get_or_create_rsa_keys()

    # 加载私钥
    private_key = serialization.load_pem_private_key(
        private_key_pem.encode("utf-8"), password=None, backend=default_backend()
    )

    # Base64 解码
    encrypted_bytes = base64.b64decode(encrypted_base64)

    # RSA 解密
    decrypted_bytes = private_key.decrypt(encrypted_bytes, padding.PKCS1v15())

    return decrypted_bytes.decode("utf-8")
