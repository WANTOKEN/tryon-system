"""
Common app views
"""

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from .models import ModelPhoto
from .serializers import ModelPhotoSerializer
from .utils.response import ApiResponse
from .services.storage_service import storage_service


class ModelPhotosView(APIView):
    """
    获取模特照片列表
    """

    permission_classes = []

    def get(self, request):
        # 获取所有启用的模特照片
        model_photos = ModelPhoto.objects.filter(is_active=True).order_by("sort_order", "id")

        # 序列化数据
        serializer = ModelPhotoSerializer(model_photos, many=True)

        # 为每个模特照片生成签名 URL
        model_photos_with_signed_urls = []
        for model_photo in serializer.data:
            if model_photo.get("image_url"):
                # 只有非公开文件才需要生成签名 URL
                if not model_photo.get("is_public", True):
                    # 生成签名 URL
                    signed_url = storage_service.get_signed_url_from_url(model_photo["image_url"])
                    model_photo["image_url"] = signed_url
                    if model_photo.get("image_thumb_url"):
                        model_photo["image_thumb_url"] = storage_service.get_signed_url_from_url(
                            model_photo["image_thumb_url"]
                        )
            model_photos_with_signed_urls.append(model_photo)

        return ApiResponse.success(model_photos_with_signed_urls)


class SignedUrlView(APIView):
    """
    生成签名 URL
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        生成签名 URL

        请求体：
        {
            "url": "https://example.com/image.jpg",
            "expires": 3600
        }
        """
        url = request.data.get("url")
        expires = request.data.get("expires", 3600)

        if not url:
            return ApiResponse.error("URL 不能为空")

        try:
            # 生成签名 URL
            signed_url = storage_service.get_signed_url_from_url(url, expires)
            return ApiResponse.success({"signed_url": signed_url})
        except Exception as e:
            return ApiResponse.error(f"生成签名 URL 失败: {str(e)}")
