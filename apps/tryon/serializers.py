"""
试穿序列化器
"""
from rest_framework import serializers
from .models import TryOnRecord, TryOnClothing
from apps.common.utils.url_utils import get_full_url


class CustomClothingSerializer(serializers.Serializer):
    """自定义服装序列化器"""
    image = serializers.CharField(required=True)  # Base64 或 URL
    name = serializers.CharField(max_length=100, required=False, default='自定义服装')
    category = serializers.CharField(max_length=30, required=False, default='tops')
    subcategory = serializers.CharField(max_length=30, required=False, default='')


class TryOnClothingSerializer(serializers.ModelSerializer):
    """试穿服装关联序列化器"""
    clothing_image = serializers.SerializerMethodField()

    class Meta:
        model = TryOnClothing
        fields = ['id', 'clothing_id', 'category', 'subcategory', 'clothing_name', 'clothing_color', 'clothing_image', 'is_custom']

    def get_clothing_image(self, obj):
        return get_full_url(obj.clothing_image)


class TryOnRecordSerializer(serializers.ModelSerializer):
    """试穿记录序列化器"""
    clothing = TryOnClothingSerializer(source='clothing_items', many=True, read_only=True)
    avatar_url = serializers.SerializerMethodField()
    result_url = serializers.SerializerMethodField()
    result_thumb_url = serializers.SerializerMethodField()

    class Meta:
        model = TryOnRecord
        fields = [
            'uuid', 'session_id', 'avatar_url', 'result_url', 'result_thumb_url',
            'status', 'ai_engine', 'is_saved', 'clothing',
            'processing_time', 'created_at'
        ]

    def get_avatar_url(self, obj):
        return get_full_url(obj.avatar_url)

    def get_result_url(self, obj):
        return get_full_url(obj.result_url)

    def get_result_thumb_url(self, obj):
        return get_full_url(obj.result_thumb_url)


class TryOnGenerateSerializer(serializers.Serializer):
    """提交试穿任务序列化器"""
    avatar = serializers.ImageField(required=True)
    clothing_uuids = serializers.CharField(required=False, allow_blank=True)  # 逗号分隔，可选
    custom_clothes = serializers.CharField(required=False, allow_blank=True)  # JSON 字符串
    session_id = serializers.CharField(required=True)
    ai_engine = serializers.ChoiceField(
        choices=TryOnRecord.AIEngine.choices,
        default=TryOnRecord.AIEngine.ALIYUN
    )

    def validate_avatar(self, value):
        """验证图片"""
        if value.size > 10 * 1024 * 1024:  # 10MB
            raise serializers.ValidationError('图片大小不能超过 10MB')
        allowed_types = ['image/jpeg', 'image/png']
        if value.content_type not in allowed_types:
            raise serializers.ValidationError('仅支持 JPG、PNG 格式')
        return value

    def validate(self, data):
        """验证：必须有 clothing_uuids 或 custom_clothes"""
        import json
        
        clothing_uuids = data.get('clothing_uuids', '')
        custom_clothes_raw = data.get('custom_clothes', '')
        
        # 解析 clothing_uuids
        uuids = [uuid.strip() for uuid in clothing_uuids.split(',') if uuid.strip()] if clothing_uuids else []
        
        # 解析 custom_clothes (JSON 字符串 -> 列表)
        custom_clothes = []
        if custom_clothes_raw:
            try:
                custom_clothes = json.loads(custom_clothes_raw)
                if not isinstance(custom_clothes, list):
                    raise serializers.ValidationError('custom_clothes 格式错误')
            except json.JSONDecodeError as e:
                raise serializers.ValidationError(f'custom_clothes JSON 解析失败: {e}')
        
        if len(uuids) == 0 and len(custom_clothes) == 0:
            raise serializers.ValidationError('请至少选择一件服装')
        
        if len(uuids) + len(custom_clothes) > 6:
            raise serializers.ValidationError('最多选择 6 件服装')
        
        data['clothing_uuids'] = uuids
        data['custom_clothes'] = custom_clothes
        return data


class TryOnStatusSerializer(serializers.Serializer):
    """试穿状态序列化器"""
    record_uuid = serializers.CharField()
    status = serializers.ChoiceField(choices=TryOnRecord.Status.choices)
    progress = serializers.IntegerField()
    result_url = serializers.URLField(allow_null=True)
    result_thumb_url = serializers.URLField(allow_null=True)
    error_message = serializers.CharField(allow_null=True)
    processing_time = serializers.DecimalField(max_digits=8, decimal_places=2, allow_null=True)


class TryOnSaveSerializer(serializers.Serializer):
    """收藏序列化器"""
    is_saved = serializers.BooleanField(required=True)
