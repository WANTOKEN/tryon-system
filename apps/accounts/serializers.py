"""
商家序列化器
"""
from rest_framework import serializers
from django.contrib.auth import authenticate
from django.utils import timezone
from .models import Merchant, SmsLog
from apps.common.utils.url_utils import get_full_url


class MerchantSerializer(serializers.ModelSerializer):
    """商家序列化器"""

    phone = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    quota_remaining = serializers.IntegerField(read_only=True)

    class Meta:
        model = Merchant
        fields = [
            'id', 'uuid', 'username', 'phone', 'store_name', 'store_address',
            'avatar_url', 'quota_total', 'quota_used', 'quota_remaining',
            'status', 'last_login_at', 'created_at'
        ]

    def get_phone(self, obj):
        """脱敏手机号"""
        from apps.common.utils.crypto import mask_phone
        return mask_phone(obj.phone)
    
    def get_avatar_url(self, obj):
        """获取完整的头像 URL"""
        return get_full_url(obj.avatar_url)


class MerchantDetailSerializer(MerchantSerializer):
    """商家详情序列化器"""

    class Meta(MerchantSerializer.Meta):
        fields = MerchantSerializer.Meta.fields + ['is_active']


class LoginSerializer(serializers.Serializer):
    """登录序列化器"""
    username = serializers.CharField(max_length=50)
    password = serializers.CharField(max_length=128, write_only=True)

    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')

        # 支持用户名或手机号登录
        user = authenticate(username=username, password=password)
        if not user:
            # 尝试通过手机号查找
            try:
                merchant = Merchant.objects.get(phone=username)
                if not merchant.check_password(password):
                    raise serializers.ValidationError('账号或密码错误')
                user = merchant
            except Merchant.DoesNotExist:
                raise serializers.ValidationError('账号或密码错误')

        if not user.is_active:
            raise serializers.ValidationError('账号已被禁用')

        if user.status == Merchant.Status.DISABLED:
            raise serializers.ValidationError('账号已被禁用')

        attrs['user'] = user
        return attrs


class SmsLoginSerializer(serializers.Serializer):
    """短信登录序列化器"""
    phone = serializers.CharField(max_length=20)
    code = serializers.CharField(max_length=6)

    def validate(self, attrs):
        phone = attrs.get('phone')
        code = attrs.get('code')

        # 验证验证码
        sms_log = SmsLog.objects.filter(
            phone=phone,
            code=code,
            is_used=False,
            purpose=SmsLog.Purpose.LOGIN
        ).order_by('-created_at').first()

        if not sms_log:
            raise serializers.ValidationError('验证码错误或已过期')

        if sms_log.is_expired:
            raise serializers.ValidationError('验证码已过期')

        # 查找商家
        try:
            merchant = Merchant.objects.get(phone=phone, is_active=True)
        except Merchant.DoesNotExist:
            raise serializers.ValidationError('该手机号未注册')

        # 标记验证码已使用
        sms_log.is_used = True
        sms_log.save(update_fields=['is_used'])

        attrs['merchant'] = merchant
        return attrs


class SendSmsSerializer(serializers.Serializer):
    """发送验证码序列化器"""
    phone = serializers.CharField(max_length=20)
    purpose = serializers.ChoiceField(
        choices=[('login', '登录'), ('bind_phone', '绑定手机')],
        default='login'
    )

    def validate_phone(self, value):
        """验证手机号格式"""
        import re
        if not re.match(r'^1[3-9]\d{9}$', value):
            raise serializers.ValidationError('手机号格式不正确')
        return value


class RefreshTokenSerializer(serializers.Serializer):
    """刷新 Token 序列化器"""
    refresh_token = serializers.CharField()
