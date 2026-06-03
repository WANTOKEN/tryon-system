"""
试穿序列化器 - 重构版
"""

from rest_framework import serializers
from .models import TryOnRecord, TryOnClothing


class CustomClothingSerializer(serializers.Serializer):
    """自定义服装序列化器"""

    image = serializers.CharField(required=True)  # Base64 或 URL
    name = serializers.CharField(max_length=100, required=False, default="自定义服装")
    category = serializers.CharField(max_length=30, required=False, default="upper")
    subcategory = serializers.CharField(max_length=30, required=False, default="")


class TryOnClothingSerializer(serializers.ModelSerializer):
    """试穿服装关联序列化器"""

    clothing_image = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()
    color = serializers.SerializerMethodField()
    is_available = serializers.SerializerMethodField()

    class Meta:
        model = TryOnClothing
        fields = [
            "id",
            "category",
            "subcategory",
            "clothing_name",
            "clothing_color",
            "clothing_image",
            "is_custom",
            "name",
            "color",
            "is_available",
        ]

    def get_clothing_image(self, obj):
        """获取服装图片URL"""
        if obj.is_custom and obj.custom_file:
            return f"/api/v1/file/{obj.custom_file.id}/"
        elif obj.clothing and obj.clothing.file:
            return f"/api/v1/file/{obj.clothing.file.id}/"
        return ""

    def get_name(self, obj):
        """获取服装名称"""
        if obj.is_custom:
            return obj.clothing_name

        try:
            if obj.clothing:
                return obj.clothing.name
        except Exception:
            pass

        return obj.clothing_name

    def get_color(self, obj):
        """获取服装颜色"""
        if obj.is_custom:
            return obj.clothing_color

        try:
            if obj.clothing:
                return obj.clothing.color
        except Exception:
            pass

        return obj.clothing_color

    def get_is_available(self, obj):
        """检查服装是否仍然可用"""
        if obj.is_custom:
            return True

        try:
            return obj.clothing is not None and obj.clothing.is_active
        except Exception:
            return False


class TryOnRecordSerializer(serializers.ModelSerializer):
    """试穿记录序列化器"""

    clothing = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    avatar_file_id = serializers.SerializerMethodField()
    result_url = serializers.SerializerMethodField()
    result_file_id = serializers.SerializerMethodField()
    status_text = serializers.CharField(source="get_status_display", read_only=True)
    merchant_name = serializers.SerializerMethodField()

    class Meta:
        model = TryOnRecord
        fields = [
            "id",
            "uuid",
            "merchant_id",
            "merchant_name",
            "session_id",
            "avatar_url",
            "avatar_file_id",
            "avatar_source",
            "result_url",
            "result_file_id",
            "status",
            "status_text",
            "ai_engine",
            "is_saved",
            "clothing",
            "processing_time",
            "error_message",
            "ip_address",
            "device_info",
            "created_at",
        ]

    def get_clothing(self, obj):
        """手动查询关联的服装数据"""
        try:
            clothing_items = TryOnClothing.objects.filter(record_id=obj.id)
            return TryOnClothingSerializer(clothing_items, many=True).data
        except Exception as e:
            import logging

            logger = logging.getLogger("tryon")
            logger.error(f"[get_clothing] Error: {e}")
            return []

    def get_merchant_name(self, obj):
        """获取商户名称"""
        try:
            from django.apps import apps

            Merchant = apps.get_model("accounts", "Merchant")
            merchant = Merchant.objects.filter(id=obj.merchant_id).first()
            if merchant:
                return merchant.store_name or merchant.username
        except Exception:
            pass
        return f"商户{obj.merchant_id}"

    def get_avatar_url(self, obj):
        """获取头像URL"""
        if obj.avatar_file:
            return f"/api/v1/file/{obj.avatar_file.id}/"
        return ""

    def get_avatar_file_id(self, obj):
        """获取头像文件ID"""
        return str(obj.avatar_file.id) if obj.avatar_file else None

    def get_result_url(self, obj):
        """获取结果URL"""
        if obj.result_file:
            return f"/api/v1/file/{obj.result_file.id}/"
        return ""

    def get_result_file_id(self, obj):
        """获取结果文件ID"""
        return str(obj.result_file.id) if obj.result_file else None


class TryOnGenerateSerializer(serializers.Serializer):
    """提交试穿任务序列化器"""

    # 头像文件ID
    avatar_file_id = serializers.CharField(required=False, allow_blank=True, help_text="用户上传头像的文件ID")

    # 模特ID：系统模特的ID（当 avatar_source=system 时使用）
    model_id = serializers.IntegerField(required=False, help_text="系统模特的ID")

    # 头像来源：system-系统模特, user-用户上传, history-历史记录
    avatar_source = serializers.ChoiceField(
        choices=TryOnRecord.AvatarSource.choices,
        default=TryOnRecord.AvatarSource.USER,
        help_text="头像来源：system-系统模特, user-用户上传, history-历史记录",
    )

    # 服装ID列表：统一传服装ID
    clothing_ids = serializers.CharField(required=True, allow_blank=False, help_text="服装ID列表（逗号分隔或JSON数组）")

    # 服装详细信息（JSON字符串，可选）
    clothing_info = serializers.CharField(required=False, allow_blank=True, help_text="服装详细信息JSON字符串")

    session_id = serializers.CharField(required=True)
    ai_engine = serializers.ChoiceField(choices=TryOnRecord.AIEngine.choices, default=TryOnRecord.AIEngine.SEEDDANCE)

    def validate(self, data):
        """验证：根据 avatar_source 验证对应的 key"""
        avatar_source = data.get("avatar_source", TryOnRecord.AvatarSource.USER)
        avatar_file_id = data.get("avatar_file_id", "")
        model_id = data.get("model_id", "")

        if avatar_source == TryOnRecord.AvatarSource.SYSTEM:
            if not model_id:
                raise serializers.ValidationError("请提供模特ID")
        elif avatar_source == TryOnRecord.AvatarSource.USER:
            if not avatar_file_id:
                raise serializers.ValidationError("请提供头像文件ID")
        elif avatar_source == TryOnRecord.AvatarSource.HISTORY:
            if not avatar_file_id:
                raise serializers.ValidationError("请提供历史记录文件ID")

        # 验证服装ID列表
        clothing_ids_str = data.get("clothing_ids", "")
        if not clothing_ids_str:
            raise serializers.ValidationError("请提供服装ID")

        import json

        clothing_ids = []
        if clothing_ids_str:
            try:
                parsed = json.loads(clothing_ids_str)
                if isinstance(parsed, list):
                    clothing_ids = [str(item).strip() for item in parsed if item]
                else:
                    clothing_ids = [id_str.strip() for id_str in str(parsed).split(",") if id_str.strip()]
            except json.JSONDecodeError:
                clothing_ids = [id_str.strip() for id_str in clothing_ids_str.split(",") if id_str.strip()]

        if len(clothing_ids) == 0:
            raise serializers.ValidationError("请至少选择一件服装")

        if len(clothing_ids) > 6:
            raise serializers.ValidationError("最多选择 6 件服装")

        data["clothing_ids"] = clothing_ids
        return data


class TryOnStatusSerializer(serializers.Serializer):
    """试穿状态序列化器"""

    record_uuid = serializers.CharField()
    status = serializers.ChoiceField(choices=TryOnRecord.Status.choices)
    progress = serializers.IntegerField()
    result_file_id = serializers.UUIDField(allow_null=True)
    error_message = serializers.CharField(allow_null=True)
    processing_time = serializers.DecimalField(max_digits=8, decimal_places=2, allow_null=True)


class TryOnSaveSerializer(serializers.Serializer):
    """收藏序列化器"""

    is_saved = serializers.BooleanField(required=True)
