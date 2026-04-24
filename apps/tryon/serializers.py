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
    clothing = serializers.SerializerMethodField()  # 手动查询关联服装
    avatar_url = serializers.SerializerMethodField()
    avatar_key = serializers.CharField(read_only=True)  # 返回 key 供前端复用
    result_url = serializers.SerializerMethodField()
    result_key = serializers.CharField(read_only=True)  # 返回 key 供前端复用
    result_thumb_url = serializers.SerializerMethodField()
    status_text = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = TryOnRecord
        fields = [
            'id', 'uuid', 'merchant_id', 'session_id', 'avatar_url', 'avatar_key', 'result_url', 'result_key', 'result_thumb_url',
            'status', 'status_text', 'ai_engine', 'is_saved', 'clothing',
            'processing_time', 'error_message', 'ip_address', 'device_info', 'created_at'
        ]

    def get_clothing(self, obj):
        """手动查询关联的服装数据"""
        clothing_items = TryOnClothing.objects.filter(record_id=obj.id)
        return TryOnClothingSerializer(clothing_items, many=True).data

    def get_avatar_url(self, obj):
        return get_full_url(obj.avatar_url)

    def get_result_url(self, obj):
        return get_full_url(obj.result_url)

    def get_result_thumb_url(self, obj):
        return get_full_url(obj.result_thumb_url)


class TryOnGenerateSerializer(serializers.Serializer):
    """提交试穿任务序列化器"""
    # 头像：支持文件上传或 key 复用（二选一）
    avatar = serializers.ImageField(required=False)
    avatar_key = serializers.CharField(required=False, allow_blank=True)  # 复用已上传头像的 key
    
    # 服装：支持 UUID 复用或自定义上传
    clothing_uuids = serializers.CharField(required=False, allow_blank=True)  # 逗号分隔，可选
    custom_clothes = serializers.CharField(required=False, allow_blank=True)  # JSON 字符串
    
    session_id = serializers.CharField(required=True)
    ai_engine = serializers.ChoiceField(
        choices=TryOnRecord.AIEngine.choices,
        default=TryOnRecord.AIEngine.SEEDDANCE
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
        """验证：avatar 和 avatar_key 二选一，必须有服装"""
        import json
        
        # 验证头像：avatar 或 avatar_key 必须有一个
        avatar = data.get('avatar')
        avatar_key = data.get('avatar_key', '')
        
        if not avatar and not avatar_key:
            raise serializers.ValidationError('请上传头像图片或提供 avatar_key')
        
        if avatar and avatar_key:
            raise serializers.ValidationError('avatar 和 avatar_key 只能提供一个')
        
        clothing_uuids = data.get('clothing_uuids', '')
        custom_clothes_raw = data.get('custom_clothes', '')
        
        # 解析 clothing_uuids（支持 JSON 数组或逗号分隔字符串）
        uuids = []
        if clothing_uuids:
            try:
                # 尝试 JSON 解析
                parsed = json.loads(clothing_uuids)
                if isinstance(parsed, list):
                    uuids = [str(item).strip() for item in parsed if item]
                else:
                    uuids = [uuid.strip() for uuid in str(parsed).split(',') if uuid.strip()]
            except json.JSONDecodeError:
                # 回退到逗号分隔
                uuids = [uuid.strip() for uuid in clothing_uuids.split(',') if uuid.strip()]
        
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
