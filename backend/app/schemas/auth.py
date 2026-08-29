"""
Authentication schemas
"""
from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=6)


class SmsLoginRequest(BaseModel):
    phone: str = Field(..., pattern=r"^1[3-9]\d{9}$")
    code: str = Field(..., min_length=4, max_length=6)


class SendSmsRequest(BaseModel):
    phone: str = Field(..., pattern=r"^1[3-9]\d{9}$")


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class TokenPayload(BaseModel):
    sub: str  # user id (uuid hex)
    type: str  # access or refresh
    exp: int


class VerifyPasswordRequest(BaseModel):
    password: str = Field(..., min_length=1)
