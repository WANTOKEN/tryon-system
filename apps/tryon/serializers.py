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
    # 头像：必须提供 avatar_key（已上传的图片 key）
    avatar_key = serializers.CharField(required=True, allow_blank=False)
    
    # 服装：支持 UUID 复用或 key 形式（逗号分隔）
    clothing_uuids = serializers.CharField(required=True, allow_blank=False)
    
    session_id = serializers.CharField(required=True)
    ai_engine = serializers.ChoiceField(
        choices=TryOnRecord.AIEngine.choices,
        default=TryOnRecord.AIEngine.SEEDDANCE
    )

    def validate(self, data):
        """验证：必须有 avatar_key 和 clothing_uuids"""
        # 验证头像 key
        avatar_key = data.get('avatar_key', '')
        if not avatar_key:
            raise serializers.ValidationError('请提供 avatar_key')
        
        # 验证服装
        clothing_uuids = data.get('clothing_uuids', '')
        if not clothing_uuids:
            raise serializers.ValidationError('请提供服装 UUID 或 key')
        
        # 解析 clothing_uuids（支持 JSON 数组或逗号分隔字符串）
        import json
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
        
        if len(uuids) == 0:
            raise serializers.ValidationError('请至少选择一件服装')
        
        if len(uuids) > 6:
            raise serializers.ValidationError('最多选择 6 件服装')
        
        data['clothing_uuids'] = uuids
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
