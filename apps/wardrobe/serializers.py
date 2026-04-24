"""
衣橱序列化器
"""
from rest_framework import serializers
from .models import Clothing, PresetClothing
from apps.common.utils.url_utils import get_full_url, get_key_from_url
from apps.common.utils.content_key import ContentKey
from apps.common.constants import ContentKeyPrefix


class ClothingSerializer(serializers.ModelSerializer):
    """服装序列化器"""
    
    image_url = serializers.SerializerMethodField()
    image_thumb_url = serializers.SerializerMethodField()
    image_key = serializers.SerializerMethodField()  # OSS key，供前端复用

    class Meta:
        model = Clothing
        fields = [
            'uuid', 'category', 'subcategory', 'name', 'color',
            'image_url', 'image_thumb_url', 'image_key', 'source', 'sort_order'
        ]
    
    def get_image_url(self, obj):
        """获取完整的图片 URL（预签名）"""
        return get_full_url(obj.image_url)
    
    def get_image_thumb_url(self, obj):
        """获取完整的缩略图 URL（预签名）"""
        return get_full_url(obj.image_thumb_url)
    
    def get_image_key(self, obj):
        """
        获取图片的唯一 key，供前端复用
        
        返回 ContentKey 格式: {storage_type}:{md5}
        - 相同内容 = 相同 MD5 = 相同 key
        - 带存储类型前缀，确保精确解析
        """
        # 优先使用 file_hash (MD5)
        if obj.file_hash:
            storage_type = ContentKeyPrefix.OSS if 'oss' in obj.image_url.lower() else ContentKeyPrefix.LOCAL
            return ContentKey.from_md5(obj.file_hash, storage_type)
        
        # 回退：从 URL 提取存储路径并生成 ContentKey
        storage_key = get_key_from_url(obj.image_url)
        if storage_key:
            storage_type = ContentKeyPrefix.OSS if 'oss' in obj.image_url.lower() else ContentKeyPrefix.LOCAL
            return ContentKey.from_md5(storage_key, storage_type)
        
        return None


class ClothingDetailSerializer(ClothingSerializer):
    """服装详情序列化器 - 用于 Admin 管理"""
    id = serializers.IntegerField(read_only=True)
    category_text = serializers.CharField(source='get_category_display', read_only=True)
    source_text = serializers.CharField(source='get_source_display', read_only=True)

    class Meta(ClothingSerializer.Meta):
        fields = [
            'id', 'uuid', 'merchant_id', 'category', 'category_text', 'subcategory',
            'name', 'color', 'image_url', 'image_thumb_url', 'image_key',
            'sort_order', 'is_active', 'source', 'source_text', 'created_at', 'updated_at'
        ]


class ClothingUploadSerializer(serializers.Serializer):
    """服装上传序列化器"""
    image = serializers.ImageField(required=True)
    name = serializers.CharField(max_length=30)
    category = serializers.ChoiceField(choices=Clothing.Category.choices)
    subcategory = serializers.CharField(max_length=30)
    color = serializers.CharField(max_length=30, required=False, default='#000000')

    def validate_image(self, value):
        """验证图片"""
        if value.size > 10 * 1024 * 1024:  # 10MB
            raise serializers.ValidationError('图片大小不能超过 10MB')
        allowed_types = ['image/jpeg', 'image/png', 'image/webp']
        if value.content_type not in allowed_types:
            raise serializers.ValidationError('仅支持 JPG、PNG、WebP 格式')
        return value


class PresetClothingSerializer(serializers.ModelSerializer):
    """预设服装序列化器"""
    name = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = PresetClothing
        fields = ['category', 'subcategory', 'name', 'color', 'image_url', 'sort_order']

    def get_name(self, obj):
        lang = self.context.get('language', 'zh-CN')
        return obj.get_name(lang)
    
    def get_image_url(self, obj):
        """获取完整的图片 URL"""
        return get_full_url(obj.image_url)


class CategorySerializer(serializers.Serializer):
    """分类序列化器"""
    id = serializers.CharField()
    name = serializers.CharField()
    subcategories = serializers.ListField()


class SubcategorySerializer(serializers.Serializer):
    """子类序列化器"""
    id = serializers.CharField()
    name = serializers.CharField()
    count = serializers.IntegerField()
