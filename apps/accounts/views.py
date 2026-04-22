"""
认证视图
"""
import random
import string
from datetime import timedelta
from django.utils import timezone
from django.conf import settings
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from apps.common.utils.response import ApiResponse
from apps.common.exceptions import RateLimitException
from .models import Merchant, SmsLog
from .serializers import (
    LoginSerializer, SmsLoginSerializer, SendSmsSerializer,
    RefreshTokenSerializer, MerchantSerializer
)


def get_client_ip(request):
    """获取客户端 IP"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '')


def generate_sms_code(length: int = 6) -> str:
    """生成随机验证码"""
    return ''.join(random.choices(string.digits, k=length))


def generate_tokens_for_user(user: Merchant) -> dict:
    """为用户生成 JWT Token"""
    refresh = RefreshToken.for_user(user)
    return {
        'access_token': str(refresh.access_token),
        'refresh_token': str(refresh),
        'token_type': 'Bearer',
        'expires_in': int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
    }


class LoginView(APIView):
    """账号密码登录"""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']

        # 更新登录信息
        user.last_login_at = timezone.now()
        user.last_login_ip = get_client_ip(request)
        user.save(update_fields=['last_login_at', 'last_login_ip'])

        # 生成 Token
        tokens = generate_tokens_for_user(user)

        return ApiResponse.success({
            **tokens,
            'merchant': MerchantSerializer(user).data
        })


class SmsLoginView(APIView):
    """短信验证码登录"""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SmsLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        merchant = serializer.validated_data['merchant']

        # 更新登录信息
        merchant.last_login_at = timezone.now()
        merchant.last_login_ip = get_client_ip(request)
        merchant.save(update_fields=['last_login_at', 'last_login_ip'])

        # 生成 Token
        tokens = generate_tokens_for_user(merchant)

        return ApiResponse.success({
            **tokens,
            'merchant': MerchantSerializer(merchant).data
        })


class SendSmsView(APIView):
    """发送验证码"""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SendSmsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        phone = serializer.validated_data['phone']
        purpose = serializer.validated_data.get('purpose', 'login')
        ip = get_client_ip(request)

        # 频率限制：同一手机号 60 秒内只能发送一次
        recent_sms = SmsLog.objects.filter(
            phone=phone,
            created_at__gte=timezone.now() - timedelta(seconds=settings.SMS_SEND_COOLDOWN)
        ).exists()
        if recent_sms:
            raise RateLimitException('验证码发送过于频繁，请稍后再试')

        # 频率限制：同一 IP 每小时最多发送 10 次
        hourly_count = SmsLog.objects.filter(
            ip_address=ip,
            created_at__gte=timezone.now() - timedelta(hours=1)
        ).count()
        if hourly_count >= settings.IP_SMS_HOURLY_LIMIT:
            raise RateLimitException('请求过于频繁，请稍后再试')

        # 生成验证码
        code = generate_sms_code(settings.SMS_CODE_LENGTH)
        expired_at = timezone.now() + timedelta(seconds=settings.SMS_CODE_EXPIRY)

        # 保存验证码记录
        SmsLog.objects.create(
            phone=phone,
            code=code,
            purpose=purpose,
            ip_address=ip,
            expired_at=expired_at
        )

        # TODO: 调用短信服务发送验证码
        # 这里仅记录日志，生产环境需要接入真实短信服务
        print(f"[SMS] 发送验证码到 {phone}: {code}")

        return ApiResponse.success({
            'expired_in': settings.SMS_CODE_EXPIRY
        }, message='验证码已发送')


class RefreshTokenView(APIView):
    """刷新 Token"""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RefreshTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        refresh_token = serializer.validated_data['refresh_token']

        try:
            refresh = RefreshToken(refresh_token)
            return ApiResponse.success({
                'access_token': str(refresh.access_token),
                'refresh_token': str(refresh),
                'token_type': 'Bearer',
                'expires_in': int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
            })
        except TokenError:
            return ApiResponse.error('Token 无效或已过期', 'AUTH_TOKEN_EXPIRED', status.HTTP_401_UNAUTHORIZED)


class LogoutView(APIView):
    """退出登录"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh_token')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
        except TokenError:
            pass  # Token 无效时忽略错误

        return ApiResponse.success(message='已退出登录')


class MeView(APIView):
    """获取当前商家信息"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return ApiResponse.success(MerchantSerializer(request.user).data)
