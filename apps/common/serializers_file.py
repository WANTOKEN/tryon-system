from rest_framework import serializers
from .models import FileRecord


class FileRecordSerializer(serializers.ModelSerializer):
    """文件记录序列化器（精简版）"""

    url = serializers.SerializerMethodField()

    def get_url(self, obj):
        return f"/api/v1/file/{obj.id}/"

    class Meta:
        model = FileRecord
        fields = [
            "id",
            "url",
            "storage_type",
            "storage_key",
            "content_type",
            "file_size",
            "file_ext",
            "width",
            "height",
        ]
        read_only_fields = fields


class FileDetailSerializer(serializers.ModelSerializer):
    """文件详细信息序列化器"""

    url = serializers.SerializerMethodField()
    storage_url = serializers.SerializerMethodField()

    def get_url(self, obj):
        return f"/api/v1/file/{obj.id}/"

    def get_storage_url(self, obj):
        from apps.common.services.storage_service import storage_service

        return storage_service.get_signed_url_from_url(obj.access_url)

    class Meta:
        model = FileRecord
        fields = [
            "id",
            "url",
            "storage_url",
            "storage_type",
            "storage_key",
            "access_url",
            "content_type",
            "file_size",
            "file_ext",
            "width",
            "height",
            "md5_hash",
            "folder",
            "file_category",
            "is_public",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class FileSecureUrlSerializer(serializers.Serializer):
    """文件真实地址请求序列化器（内部/AI调用）"""

    file_id = serializers.UUIDField(required=False, help_text="文件唯一标识")
    storage_key = serializers.CharField(required=False, help_text="存储路径")
    expires = serializers.IntegerField(default=3600, help_text="签名 URL 过期时间（秒）")

    def validate(self, data):
        if not data.get("file_id") and not data.get("storage_key"):
            raise serializers.ValidationError("必须提供 file_id 或 storage_key")
        return data


class FileSecureUrlResponseSerializer(serializers.Serializer):
    """文件真实地址响应序列化器"""

    url = serializers.URLField(help_text="文件真实访问地址")
    storage_type = serializers.CharField(help_text="存储类型")
    expires_at = serializers.DateTimeField(help_text="过期时间")
