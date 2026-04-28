"""
试穿视图
"""
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework import serializers

from apps.common.utils.response import ApiResponse
from apps.common.services.storage_service import storage_service
from apps.common.constants import StorageFolder


class UploadAvatarSerializer(serializers.Serializer):
    """上传头像序列化器"""
    image = serializers.ImageField(required=True)

    def validate_image(self, value):
        """验证图片"""
        if value.size > 30 * 1024 * 1024:  # 30MB
            raise serializers.ValidationError('图片大小不能超过 30MB')
        allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/heic', 'image/heif']
        if value.content_type not in allowed_types:
            raise serializers.ValidationError('仅支持 JPG、PNG、WebP、GIF、BMP、HEIC、HEIF 格式')
        return value


class UploadClothingSerializer(serializers.Serializer):
    """上传服装序列化器"""
    image = serializers.ImageField(required=True)

    def validate_image(self, value):
        """验证图片"""
        if value.size > 30 * 1024 * 1024:  # 30MB
            raise serializers.ValidationError('图片大小不能超过 30MB')
        allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/heic', 'image/heif']
        if value.content_type not in allowed_types:
            raise serializers.ValidationError('仅支持 JPG、PNG、WebP、GIF、BMP、HEIC、HEIF 格式')
        return value


class UploadAvatarView(APIView):
    """上传头像图片"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = UploadAvatarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        image = serializer.validated_data['image']
        merchant = request.user

        # 上传到存储服务
        storage_key, url, is_duplicate, content_key = storage_service.upload_file(
            file_obj=image,
            filename=image.name,
            folder=StorageFolder.AVATARS,
            tenant_id=str(merchant.uuid),
            content_type=image.content_type or 'image/jpeg',
            file_category='avatar',
            skip_duplicate=True,
        )

        return ApiResponse.success({
            'image_key': content_key,  # 返回 content_key 供前端复用
            'image_url': url,
            'is_duplicate': is_duplicate,
        })


class UploadClothingView(APIView):
    """上传服装图片"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = UploadClothingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        image = serializer.validated_data['image']
        merchant = request.user

        # 上传到存储服务
        storage_key, url, is_duplicate, content_key = storage_service.upload_file(
            file_obj=image,
            filename=image.name,
            folder=StorageFolder.CLOTHING,
            tenant_id=str(merchant.uuid),
            content_type=image.content_type or 'image/jpeg',
            file_category='clothing',
            skip_duplicate=True,
        )

        return ApiResponse.success({
            'image_key': content_key,  # 返回 content_key 供前端复用
            'image_url': url,
            'is_duplicate': is_duplicate,
        })
