"""
商家序列化器
"""

from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import Merchant, SmsLog
from apps.common.utils.url_utils import get_full_url


class MerchantSerializer(serializers.ModelSerializer):
    """商家序列化器"""

    phone = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    quota_remaining = serializers.IntegerField(read_only=True)
    status_text = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Merchant
        fields = [
            "id",
            "uuid",
            "username",
            "phone",
            "store_name",
            "store_address",
            "avatar_url",
            "quota_total",
            "quota_used",
            "quota_remaining",
            "quota_reset_at",
            "status",
            "status_text",
            "last_login_at",
            "last_login_ip",
            "is_active",
            "created_at",
        ]
        read_only_fields = [
            "uuid",
            "quota_used",
            "quota_remaining",
            "quota_reset_at",
            "last_login_at",
            "last_login_ip",
            "created_at",
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
        fields = MerchantSerializer.Meta.fields + ["is_active"]


class LoginSerializer(serializers.Serializer):
    """登录序列化器"""

    username = serializers.CharField(max_length=50)
    password = serializers.CharField(max_length=128, write_only=True)

    def validate(self, attrs):
        username = attrs.get("username")
        password = attrs.get("password")

        # 支持用户名或手机号登录
        user = authenticate(username=username, password=password)
        if not user:
            # 尝试通过手机号查找
            try:
                merchant = Merchant.objects.get(phone=username)
                if not merchant.check_password(password):
                    raise serializers.ValidationError("账号或密码错误")
                user = merchant
            except Merchant.DoesNotExist:
                raise serializers.ValidationError("账号或密码错误")

        if not user.is_active:
            raise serializers.ValidationError("账号已被禁用")

        if user.status == Merchant.Status.DISABLED:
            raise serializers.ValidationError("账号已被禁用")

        if user.status == Merchant.Status.PENDING:
            raise serializers.ValidationError("账号待审核，请联系管理员开通")

        attrs["user"] = user
        return attrs


class SmsLoginSerializer(serializers.Serializer):
    """短信登录序列化器"""

    phone = serializers.CharField(max_length=20)
    code = serializers.CharField(max_length=6)

    def validate(self, attrs):
        phone = attrs.get("phone")
        code = attrs.get("code")

        # 验证验证码
        sms_log = (
            SmsLog.objects.filter(phone=phone, code=code, is_used=False, purpose=SmsLog.Purpose.LOGIN)
            .order_by("-created_at")
            .first()
        )

        if not sms_log:
            raise serializers.ValidationError("验证码错误或已过期")

        if sms_log.is_expired:
            raise serializers.ValidationError("验证码已过期")

        # 查找商家
        try:
            merchant = Merchant.objects.get(phone=phone, is_active=True)
        except Merchant.DoesNotExist:
            raise serializers.ValidationError("该手机号未注册")

        # 检查状态
        if merchant.status == Merchant.Status.DISABLED:
            raise serializers.ValidationError("账号已被禁用")

        if merchant.status == Merchant.Status.PENDING:
            raise serializers.ValidationError("账号待审核，请联系管理员开通")

        # 标记验证码已使用
        sms_log.is_used = True
        sms_log.save(update_fields=["is_used"])

        attrs["merchant"] = merchant
        return attrs


class SendSmsSerializer(serializers.Serializer):
    """发送验证码序列化器"""

    phone = serializers.CharField(max_length=20)
    purpose = serializers.ChoiceField(choices=[("login", "登录"), ("bind_phone", "绑定手机")], default="login")

    def validate_phone(self, value):
        """验证手机号格式"""
        import re

        if not re.match(r"^1[3-9]\d{9}$", value):
            raise serializers.ValidationError("手机号格式不正确")
        return value


class RefreshTokenSerializer(serializers.Serializer):
    """刷新 Token 序列化器"""

    refresh_token = serializers.CharField()


class RegisterSerializer(serializers.Serializer):
    """注册序列化器"""

    username = serializers.CharField(max_length=50)
    phone = serializers.CharField(max_length=20)
    password = serializers.CharField(max_length=128, min_length=6, write_only=True)
    store_name = serializers.CharField(max_length=100, required=False, default="")

    def validate_username(self, value):
        """验证用户名唯一性"""
        if Merchant.objects.filter(username=value).exists():
            raise serializers.ValidationError("用户名已存在")
        return value

    def validate_phone(self, value):
        """验证手机号格式和唯一性"""
        import re

        if not re.match(r"^1[3-9]\d{9}$", value):
            raise serializers.ValidationError("手机号格式不正确")
        if Merchant.objects.filter(phone=value).exists():
            raise serializers.ValidationError("该手机号已注册")
        return value

    def create(self, validated_data):
        """创建商家"""
        merchant = Merchant.objects.create_user(
            username=validated_data["username"],
            phone=validated_data["phone"],
            password=validated_data["password"],
            store_name=validated_data.get("store_name", ""),
            status=Merchant.Status.PENDING,
            quota_total=0,
        )
        return merchant


class SendResetSmsSerializer(serializers.Serializer):
    """发送重置密码验证码序列化器"""

    phone = serializers.CharField(max_length=20)

    def validate_phone(self, value):
        """验证手机号是否存在"""
        import re

        if not re.match(r"^1[3-9]\d{9}$", value):
            raise serializers.ValidationError("手机号格式不正确")
        if not Merchant.objects.filter(phone=value, is_active=True).exists():
            raise serializers.ValidationError("该手机号未注册")
        return value


class ResetPasswordSerializer(serializers.Serializer):
    """重置密码序列化器"""

    phone = serializers.CharField(max_length=20)
    code = serializers.CharField(max_length=6)
    new_password = serializers.CharField(max_length=128, min_length=6, write_only=True)

    def validate(self, attrs):
        phone = attrs.get("phone")
        code = attrs.get("code")

        # 验证验证码
        sms_log = (
            SmsLog.objects.filter(phone=phone, code=code, is_used=False, purpose=SmsLog.Purpose.RESET_PASSWORD)
            .order_by("-created_at")
            .first()
        )

        if not sms_log:
            raise serializers.ValidationError("验证码错误或已过期")

        if sms_log.is_expired:
            raise serializers.ValidationError("验证码已过期")

        # 查找商家
        try:
            merchant = Merchant.objects.get(phone=phone, is_active=True)
        except Merchant.DoesNotExist:
            raise serializers.ValidationError("该手机号未注册")

        # 标记验证码已使用
        sms_log.is_used = True
        sms_log.save(update_fields=["is_used"])

        attrs["merchant"] = merchant
        return attrs
