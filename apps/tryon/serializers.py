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
    name = serializers.SerializerMethodField()
    color = serializers.SerializerMethodField()
    is_available = serializers.SerializerMethodField()

    class Meta:
        model = TryOnClothing
        fields = ['id', 'clothing_id', 'category', 'subcategory', 'clothing_name', 'clothing_color', 
                  'clothing_image', 'is_custom', 'name', 'color', 'is_available']

    def get_clothing_image(self, obj):
        return get_full_url(obj.clothing_image)

    def get_name(self, obj):
        """获取服装名称（优先从关联表获取，如自定义服装）"""
        # 如果是自定义服装，使用记录的名称
        if obj.is_custom:
            return obj.clothing_name
        
        # 尝试从数据库查询最新信息
        try:
            from apps.wardrobe.models import Clothing
            clothing = Clothing.objects.filter(uuid=obj.clothing_id).first()
            if clothing:
                return clothing.name
        except Exception:
            pass
        
        # 返回记录的名称
        return obj.clothing_name

    def get_color(self, obj):
        """获取服装颜色"""
        if obj.is_custom:
            return obj.clothing_color
        
        try:
            from apps.wardrobe.models import Clothing
            clothing = Clothing.objects.filter(uuid=obj.clothing_id).first()
            if clothing:
                return clothing.color
        except Exception:
            pass
        
        return obj.clothing_color

    def get_is_available(self, obj):
        """检查服装是否仍然可用（未下架）"""
        if obj.is_custom:
            return True
        
        try:
            from apps.wardrobe.models import Clothing
            return Clothing.objects.filter(uuid=obj.clothing_id, is_active=True).exists()
        except Exception:
            return False


class TryOnRecordSerializer(serializers.ModelSerializer):
    """试穿记录序列化器"""
    clothing = serializers.SerializerMethodField()  # 手动查询关联服装
    avatar_url = serializers.SerializerMethodField()
    avatar_key = serializers.CharField(read_only=True)  # 返回 key 供前端复用
    result_url = serializers.SerializerMethodField()
    result_key = serializers.CharField(read_only=True)  # 返回 key 供前端复用
    result_thumb_url = serializers.SerializerMethodField()
    status_text = serializers.CharField(source='get_status_display', read_only=True)
    merchant_name = serializers.SerializerMethodField()

    class Meta:
        model = TryOnRecord
        fields = [
            'id', 'uuid', 'merchant_id', 'merchant_name', 'session_id', 'avatar_url', 'avatar_key', 'avatar_source', 'result_url', 'result_key', 'result_thumb_url',
            'status', 'status_text', 'ai_engine', 'is_saved', 'clothing',
            'processing_time', 'error_message', 'ip_address', 'device_info', 'created_at'
        ]

    def get_clothing(self, obj):
        """手动查询关联的服装数据"""
        try:
            clothing_items = TryOnClothing.objects.filter(record_id=obj.id)
            return TryOnClothingSerializer(clothing_items, many=True).data
        except Exception as e:
            import logging
            logger = logging.getLogger('tryon')
            logger.error(f"[get_clothing] Error: {e}")
            return []

    def get_merchant_name(self, obj):
        """获取商户名称"""
        try:
            from django.apps import apps
            Merchant = apps.get_model('accounts', 'Merchant')
            merchant = Merchant.objects.filter(id=obj.merchant_id).first()
            if merchant:
                return merchant.store_name or merchant.username
        except Exception:
            pass
        return f"商户{obj.merchant_id}"

    def get_avatar_url(self, obj):
        try:
            return get_full_url(obj.avatar_url)
        except Exception as e:
            import logging
            logger = logging.getLogger('tryon')
            logger.error(f"[get_avatar_url] Error: {e}, url={obj.avatar_url}")
            return obj.avatar_url

    def get_result_url(self, obj):
        try:
            return get_full_url(obj.result_url)
        except Exception as e:
            import logging
            logger = logging.getLogger('tryon')
            logger.error(f"[get_result_url] Error: {e}, url={obj.result_url}")
            return obj.result_url

    def get_result_thumb_url(self, obj):
        try:
            return get_full_url(obj.result_thumb_url)
        except Exception as e:
            import logging
            logger = logging.getLogger('tryon')
            logger.error(f"[get_result_thumb_url] Error: {e}, url={obj.result_thumb_url}")
            return obj.result_thumb_url


class TryOnGenerateSerializer(serializers.Serializer):
    """提交试穿任务序列化器
    
    新逻辑：
    1. 形象：通过 avatar_key 查找图片（用户上传），或通过 model_key 查找模特
    2. 服装：通过 clothing_ids 查找数据库获取图片
    """
    # 头像：用户上传的图片 key（当 avatar_source=user 时使用）
    avatar_key = serializers.CharField(required=False, allow_blank=True, help_text='用户上传头像的key')

    # 模特key：系统模特的ID或key（当 avatar_source=system 时使用）
    model_key = serializers.CharField(required=False, allow_blank=True, help_text='系统模特的ID或key')

    # 头像来源：system-系统模特, user-用户上传, history-历史记录
    avatar_source = serializers.ChoiceField(
        choices=TryOnRecord.AvatarSource.choices,
        default=TryOnRecord.AvatarSource.USER,
        help_text='头像来源：system-系统模特, user-用户上传, history-历史记录'
    )

    # 服装ID列表：统一传服装ID，通过ID查询数据库获取图片（逗号分隔或JSON数组）
    clothing_ids = serializers.CharField(required=True, allow_blank=False, help_text='服装ID列表（逗号分隔或JSON数组）')

    # 服装详细信息（JSON字符串，可选，用于补充信息）
    clothing_info = serializers.CharField(required=False, allow_blank=True, help_text='服装详细信息JSON字符串')

    session_id = serializers.CharField(required=True)
    ai_engine = serializers.ChoiceField(
        choices=TryOnRecord.AIEngine.choices,
        default=TryOnRecord.AIEngine.SEEDDANCE
    )

    def validate(self, data):
        """验证：根据 avatar_source 验证对应的 key"""
        avatar_source = data.get('avatar_source', TryOnRecord.AvatarSource.USER)
        avatar_key = data.get('avatar_key', '')
        model_key = data.get('model_key', '')
        
        # 根据来源验证对应的 key
        if avatar_source == TryOnRecord.AvatarSource.SYSTEM:
            # 系统模特必须有 model_key
            if not model_key:
                raise serializers.ValidationError('请提供模特key')
        elif avatar_source == TryOnRecord.AvatarSource.USER:
            # 用户上传必须有 avatar_key
            if not avatar_key:
                raise serializers.ValidationError('请提供头像图片key')
        elif avatar_source == TryOnRecord.AvatarSource.HISTORY:
            # 历史记录必须有 avatar_key（历史记录的UUID）
            if not avatar_key:
                raise serializers.ValidationError('请提供历史记录key')
        
        # 验证服装ID列表
        clothing_ids_str = data.get('clothing_ids', '')
        if not clothing_ids_str:
            raise serializers.ValidationError('请提供服装ID')
        
        # 解析 clothing_ids（支持 JSON 数组或逗号分隔字符串）
        import json
        clothing_ids = []
        if clothing_ids_str:
            try:
                # 尝试 JSON 解析
                parsed = json.loads(clothing_ids_str)
                if isinstance(parsed, list):
                    clothing_ids = [str(item).strip() for item in parsed if item]
                else:
                    clothing_ids = [id_str.strip() for id_str in str(parsed).split(',') if id_str.strip()]
            except json.JSONDecodeError:
                # 回退到逗号分隔
                clothing_ids = [id_str.strip() for id_str in clothing_ids_str.split(',') if id_str.strip()]
        
        if len(clothing_ids) == 0:
            raise serializers.ValidationError('请至少选择一件服装')
        
        if len(clothing_ids) > 6:
            raise serializers.ValidationError('最多选择 6 件服装')
        
        data['clothing_ids'] = clothing_ids
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
