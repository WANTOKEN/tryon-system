"""
Authentication service
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt, JWTError
import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.merchant import Merchant

settings = get_settings()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    password_bytes = plain_password.encode('utf-8')[:72]
    hash_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hash_bytes)


def hash_password(password: str) -> str:
    password_bytes = password.encode('utf-8')[:72]
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode('utf-8')


def create_access_token(user_id: int, expires_delta: Optional[timedelta] = None) -> str:
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.jwt_access_token_expire_minutes))
    payload = {"sub": str(user_id), "type": "access", "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: int, expires_delta: Optional[timedelta] = None) -> str:
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(days=settings.jwt_refresh_token_expire_days))
    payload = {"sub": str(user_id), "type": "refresh", "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        return payload
    except JWTError:
        return None


async def authenticate_user(db: AsyncSession, username: str, password: str) -> Optional[Merchant]:
    stmt = select(Merchant).where(Merchant.username == username, Merchant.is_active == True)
    result = await db.execute(stmt)
    merchant = result.scalar_one_or_none()
    if merchant and verify_password(password, merchant.password_hash):
        return merchant
    return None


async def get_user_by_id(db: AsyncSession, user_id: int) -> Optional[Merchant]:
    stmt = select(Merchant).where(Merchant.id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_user_by_phone(db: AsyncSession, phone: str) -> Optional[Merchant]:
    stmt = select(Merchant).where(Merchant.phone == phone)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create_user(db: AsyncSession, username: str, phone: str, password: str, **kwargs) -> Merchant:
    merchant = Merchant(
        username=username,
        phone=phone,
        password_hash=hash_password(password),
        **kwargs
    )
    db.add(merchant)
    await db.flush()
    return merchant


async def update_last_login(db: AsyncSession, merchant: Merchant, ip: str = ""):
    merchant.last_login_at = datetime.now(timezone.utc)
    merchant.last_login_ip = ip
    await db.flush()


# ===== 开发期短信验证码（内存存储，仅用于无短信网关的本地演示） =====
_DEV_SMS_CODES: dict[str, tuple[str, float]] = {}


def generate_sms_code(phone: str, ttl: int = 300) -> str:
    import random

    code = f"{random.randint(100000, 999999)}"
    _DEV_SMS_CODES[phone] = (code, datetime.now(timezone.utc).timestamp() + ttl)
    return code


def verify_sms_code(phone: str, code: str) -> bool:
    entry = _DEV_SMS_CODES.get(phone)
    if not entry:
        return False
    stored_code, expire_at = entry
    if datetime.now(timezone.utc).timestamp() > expire_at:
        _DEV_SMS_CODES.pop(phone, None)
        return False
    if stored_code != code:
        return False
    _DEV_SMS_CODES.pop(phone, None)
    return True


async def ensure_admin(db: AsyncSession) -> None:
    """首次启动时创建超级管理员（若不存在）"""
    from sqlalchemy import select

    existing = (await db.execute(select(Merchant).where(Merchant.is_superuser == True))).scalars().first()  # noqa: E712
    if existing:
        return
    admin = await create_user(
        db,
        username=settings.admin_username,
        phone=settings.admin_phone,
        password=settings.admin_password,
        store_name="平台管理员",
    )
    admin.role = "super_admin"
    admin.is_superuser = True
    await db.commit()
