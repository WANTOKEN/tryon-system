"""
衣橱序列化器 - 重构版
"""

from rest_framework import serializers
from .models import Clothing


class ClothingSerializer(serializers.ModelSerializer):
    """服装序列化器"""

    uuid = serializers.UUIDField(source='id', read_only=True)
    image_url = serializers.SerializerMethodField()
    image_thumb_url = serializers.SerializerMethodField()
    file_id = serializers.SerializerMethodField()

    class Meta:
        model = Clothing
        fields = [
            "id",
            "uuid",
            "category",
            "subcategory",
            "name",
            "color",
            "price",
            "sizes",
            "image_url",
            "image_thumb_url",
            "file_id",
            "source",
            "is_active",
            "created_at",
        ]

    def get_image_url(self, obj):
        if obj.file:
            return f"/api/v1/file/{obj.file.id}/"
        return ""

    def get_image_thumb_url(self, obj):
        if obj.file:
            return f"/api/v1/file/{obj.file.id}/"
        return ""

    def get_file_id(self, obj):
        return str(obj.file.id) if obj.file else None


class ClothingDetailSerializer(ClothingSerializer):
    """服装详情序列化器 - 用于 Admin 管理"""

    id = serializers.UUIDField(read_only=True)
    merchant_id = serializers.IntegerField(read_only=True)
    image = serializers.ImageField(required=False, write_only=True)

    class Meta(ClothingSerializer.Meta):
        fields = [
            "id",
            "uuid",
            "merchant_id",
            "category",
            "subcategory",
            "name",
            "color",
            "price",
            "sizes",
            "image",
            "image_url",
            "image_thumb_url",
            "file_id",
            "is_active",
            "source",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "merchant_id", "created_at", "updated_at"]


class ClothingUploadSerializer(serializers.Serializer):
    """服装上传序列化器"""

    image = serializers.ImageField(required=True)
    name = serializers.CharField(max_length=200, required=False, default="未命名服装")
    category = serializers.CharField(max_length=50)
    subcategory = serializers.CharField(max_length=50)
    color = serializers.CharField(max_length=50, required=False, default="#000000")
    price = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=0.00)
    sizes = serializers.ListField(child=serializers.CharField(), required=False, default=[])

    def validate_image(self, value):
        """验证图片"""
        if value.size > 30 * 1024 * 1024:  # 30MB
            raise serializers.ValidationError("图片大小不能超过 30MB")
        allowed_types = [
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/webp",
            "image/gif",
            "image/bmp",
            "image/heic",
            "image/heif",
        ]
        if value.content_type not in allowed_types:
            raise serializers.ValidationError("仅支持 JPG、PNG、WebP、GIF、BMP、HEIC、HEIF 格式")
        return value


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
