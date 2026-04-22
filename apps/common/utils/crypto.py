"""
加解密工具
"""
from django.conf import settings
import base64
import hashlib
import json
import uuid

try:
    from cryptography.fernet import Fernet
    HAS_FERNET = True
except ImportError:
    Fernet = None
    HAS_FERNET = False


def get_encryption_key():
    """获取加密密钥，确保32字节"""
    key = settings.DATA_ENCRYPTION_KEY
    if not key:
        key = settings.SECRET_KEY
    # 派生32字节密钥
    return base64.urlsafe_b64encode(hashlib.sha256(key.encode()).digest()).decode()


def xor_encrypt(data: str, key: str) -> str:
    """XOR 加密"""
    encrypted = ''
    for i, char in enumerate(data):
        encrypted += chr(ord(char) ^ ord(key[i % len(key)]))
    return encrypted


def xor_decrypt(encrypted: str, key: str) -> str:
    """XOR 解密（与加密相同）"""
    return xor_encrypt(encrypted, key)


ENCRYPTION_KEY = 'TryOn@2024!Secret'


def encrypt_data(data) -> str:
    """
    加密数据
    :param data: 字典或字符串
    :return: 加密后的字符串
    """
    if not settings.DATA_ENCRYPTION_ENABLED:
        if isinstance(data, dict):
            return json.dumps(data, ensure_ascii=False)
        return str(data)
    
    try:
        if isinstance(data, dict):
            data = json.dumps(data, ensure_ascii=False)
        encrypted = xor_encrypt(data, ENCRYPTION_KEY)
        return base64.b64encode(encrypted.encode()).decode()
    except Exception as e:
        print(f"Encryption error: {e}")
        return str(data) if not isinstance(data, dict) else json.dumps(data, ensure_ascii=False)


def decrypt_data(encrypted_data: str):
    """
    解密数据
    :param encrypted_data: 加密后的字符串
    :return: 解密后的数据（字典或字符串）
    """
    if not settings.DATA_ENCRYPTION_ENABLED:
        try:
            return json.loads(encrypted_data)
        except:
            return encrypted_data
    
    try:
        decoded = base64.b64decode(encrypted_data.encode()).decode()
        decrypted = xor_decrypt(decoded, ENCRYPTION_KEY)
        try:
            return json.loads(decrypted)
        except:
            return decrypted
    except Exception as e:
        print(f"Decryption error: {e}")
        try:
            return json.loads(encrypted_data)
        except:
            return encrypted_data


def is_encryption_enabled() -> bool:
    """检查是否启用加密"""
    return settings.DATA_ENCRYPTION_ENABLED


def generate_uuid(prefix: str = '') -> str:
    """生成带业务前缀的 UUID"""
    return f"{prefix}{uuid.uuid4()}"


def generate_merchant_uuid() -> str:
    """生成商家 UUID"""
    return generate_uuid('mcht_')


def generate_clothing_uuid() -> str:
    """生成服装 UUID"""
    return generate_uuid('cloth_')


def generate_tryon_uuid() -> str:
    """生成试穿记录 UUID"""
    return generate_uuid('tryon_')


def generate_task_uuid() -> str:
    """生成 AI 任务 ID"""
    return generate_uuid('task_')


def mask_phone(phone: str) -> str:
    """手机号脱敏：13812345678 -> 138****5678"""
    if len(phone) >= 11:
        return f"{phone[:3]}****{phone[-4:]}"
    return phone


def calculate_file_hash(file) -> str:
    """计算文件 SHA256 哈希"""
    sha256 = hashlib.sha256()
    for chunk in file.chunks():
        sha256.update(chunk)
    return sha256.hexdigest()


class PhoneEncryptor:
    """手机号加密工具（用于存储和匹配）"""

    _fernet = None

    @classmethod
    def _get_fernet(cls):
        if not HAS_FERNET:
            raise RuntimeError("cryptography package not installed")
        if cls._fernet is None:
            key = settings.SECRET_KEY.encode()[:32].ljust(32, b'=')
            cls._fernet = Fernet(Fernet.generate_key())
        return cls._fernet

    @classmethod
    def encrypt(cls, phone: str) -> str:
        """加密手机号"""
        if not HAS_FERNET:
            # 没有加密库时，使用简单的 XOR 加密
            return xor_encrypt(phone, settings.SECRET_KEY[:16])
        return cls._get_fernet().encrypt(phone.encode()).decode()

    @classmethod
    def decrypt(cls, encrypted: str) -> str:
        """解密手机号"""
        if not HAS_FERNET:
            return xor_decrypt(encrypted, settings.SECRET_KEY[:16])
        return cls._get_fernet().decrypt(encrypted.encode()).decode()
