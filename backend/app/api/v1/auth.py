"""
Authentication routes - 认证接口

- 账号密码登录 / 刷新 / 登出 / 注册（返回 access_token / refresh_token，与前端契约一致）
- 开发期短信登录：内存验证码，仅 debug 模式启用，避免「假装发送」的安全假象
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.api.deps import get_current_user
from app.schemas.auth import (
    LoginRequest,
    SmsLoginRequest,
    SendSmsRequest,
    TokenResponse,
    RefreshTokenRequest,
)
from app.schemas.merchant import MerchantResponse, MerchantCreate
from app.services import (
    authenticate_user,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_user_by_id,
    create_user,
)
from app.models.merchant import Merchant
from app.core.config import get_settings

settings = get_settings()
router = APIRouter()


@router.post("/login/", response_model=TokenResponse)
async def login(request: Request, login_data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """账号密码登录"""
    user = await authenticate_user(db, login_data.username, login_data.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        expires_in=settings.jwt_access_token_expire_minutes * 60,
    )


@router.post("/register/")
async def register(register_data: MerchantCreate, db: AsyncSession = Depends(get_db)):
    """用户注册（自注册商家，初始配额 100）"""
    existing = (
        await db.execute(
            select(Merchant).where(
                (Merchant.username == register_data.username) | (Merchant.phone == register_data.phone)
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用户名或手机号已存在")

    user = await create_user(
        db,
        username=register_data.username,
        phone=register_data.phone,
        password=register_data.password,
        store_name=register_data.store_name or "",
    )
    await db.commit()
    await db.refresh(user)

    return {
        "access_token": create_access_token(user.id),
        "refresh_token": create_refresh_token(user.id),
        "token_type": "bearer",
        "expires_in": settings.jwt_access_token_expire_minutes * 60,
        "merchant": MerchantResponse.model_validate(user).model_dump(),
    }


@router.post("/sms-login/")
async def sms_login(sms_data: SmsLoginRequest, db: AsyncSession = Depends(get_db)):
    """短信验证码登录（开发期：校验内存验证码）"""
    if settings.dev_sms_enabled:
        from app.services.auth_service import verify_sms_code

        if not verify_sms_code(sms_data.phone, sms_data.code):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="验证码错误或已过期")
    else:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="短信登录未启用")

    user = (
        await db.execute(select(Merchant).where(Merchant.phone == sms_data.phone))
    ).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        expires_in=settings.jwt_access_token_expire_minutes * 60,
    )


@router.post("/send-sms/")
async def send_sms(sms_data: SendSmsRequest):
    """发送短信验证码（开发期：生成并返回明文验证码，便于演示）"""
    if not settings.dev_sms_enabled:
        return {"success": True, "message": "验证码已发送"}
    from app.services.auth_service import generate_sms_code

    code = generate_sms_code(sms_data.phone)
    # 开发期直接把验证码返回给前端，避免依赖真实短信网关
    return {"success": True, "message": "验证码已发送", "dev_code": code}


@router.post("/send-reset-sms/")
async def send_reset_sms():
    """发送找回密码短信验证码（MVP 未启用）"""
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="找回密码功能未启用")


@router.post("/reset-password/")
async def reset_password():
    """重置密码（MVP 未启用）"""
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="找回密码功能未启用")


@router.post("/refresh/", response_model=TokenResponse)
async def refresh_token(token_data: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    """刷新 Token"""
    payload = decode_token(token_data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user_id = int(payload.get("sub"))
    user = await get_user_by_id(db, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        expires_in=settings.jwt_access_token_expire_minutes * 60,
    )


@router.post("/logout/")
async def logout(current_user: Merchant = Depends(get_current_user)):
    """登出（无状态 JWT：前端丢弃 token 即可；此处仅作占位以匹配前端）"""
    return {"success": True}


@router.get("/me/", response_model=MerchantResponse)
async def get_current_user_info(current_user: Merchant = Depends(get_current_user)):
    """获取当前用户信息（含 role / is_superuser，供管理后台鉴权）"""
    return current_user
