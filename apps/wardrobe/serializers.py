"""
衣橱序列化器
"""
from rest_framework import serializers
from .models import Clothing, PresetClothing
from apps.common.utils.url_utils import get_full_url


class ClothingSerializer(serializers.ModelSerializer):
    """服装序列化器"""
    
    image_url = serializers.SerializerMethodField()
    image_thumb_url = serializers.SerializerMethodField()

    class Meta:
        model = Clothing
        fields = [
            'uuid', 'category', 'subcategory', 'name', 'color',
            'image_url', 'image_thumb_url', 'source', 'sort_order'
        ]
    
    def get_image_url(self, obj):
        """获取完整的图片 URL"""
        return get_full_url(obj.image_url)
    
    def get_image_thumb_url(self, obj):
        """获取完整的缩略图 URL"""
        return get_full_url(obj.image_thumb_url)


class ClothingDetailSerializer(ClothingSerializer):
    """服装详情序列化器"""

    class Meta(ClothingSerializer.Meta):
        fields = ClothingSerializer.Meta.fields + ['is_active', 'created_at']


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
