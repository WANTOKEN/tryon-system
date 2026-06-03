"""
公共序列化器 - 重构版
"""

from rest_framework import serializers
from .models import ModelPhoto


class ModelPhotoSerializer(serializers.ModelSerializer):
    """模特照片序列化器"""

    image_url = serializers.SerializerMethodField()
    image_thumb_url = serializers.SerializerMethodField()
    file_id = serializers.SerializerMethodField()

    def get_image_url(self, obj):
        """获取文件访问 URL（不暴露真实存储地址）"""
        if obj.file:
            return f"/api/v1/file/{obj.file.id}/"
        return ""

    def get_image_thumb_url(self, obj):
        """获取缩略图文件访问 URL"""
        return self.get_image_url(obj)

    def get_file_id(self, obj):
        """获取文件ID"""
        return str(obj.file.id) if obj.file else None

    class Meta:
        model = ModelPhoto
        fields = [
            "id",
            "image_url",
            "image_thumb_url",
            "file_id",
            "sort_order",
            "is_active",
            "created_at",
            "updated_at",
        ]
