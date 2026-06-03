"""
文件接口视图 - 重构版
"""

import os
import logging
from django.http import HttpResponse, Http404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from .models import FileRecord
from .utils.file_id_utils import parse_file_id

logger = logging.getLogger(__name__)


class FileAccessView(APIView):
    """
    统一文件访问接口
    - 前端使用此接口访问图片，不暴露真实存储地址
    - 支持本地和 OSS 文件
    - 允许匿名访问（图片需要在前端展示）
    - 代理模式：后端获取文件内容后直接返回，不暴露 OSS 地址
    - OSS 获取失败时自动 fallback 到本地副本
    """

    permission_classes = [AllowAny]

    def get(self, request, file_id):
        try:
            uuid_str, _ = parse_file_id(file_id)
        except ValueError:
            raise Http404("无效的文件ID格式")

        try:
            record = FileRecord.objects.get(id=file_id, is_deleted=False)
        except FileRecord.DoesNotExist:
            raise Http404("文件不存在")

        if record.storage_type == "oss":
            response = self._serve_oss_file(record)
            if response is not None:
                return response
            return self._serve_local_file(record)
        else:
            return self._serve_local_file(record)

    def _serve_oss_file(self, record):
        try:
            from apps.common.services.storage.factory import StorageFactory

            oss_backend = StorageFactory.get_backend("oss")
            if not oss_backend.enabled:
                return None

            result = oss_backend.bucket.get_object(record.storage_key)
            content = result.read()

            if not content:
                return None

            content_type = result.headers.get("Content-Type", record.content_type or "application/octet-stream")

            response = HttpResponse(content, content_type=content_type)
            response["Cache-Control"] = "public, max-age=3600"
            return response
        except Exception as e:
            logger.warning(f"[FileAccess] OSS 获取失败，尝试本地 fallback: file_id={record.id}, error={e}")
            return None

    def _serve_local_file(self, record):
        from django.conf import settings

        media_root = str(settings.MEDIA_ROOT)
        file_path = os.path.join(media_root, record.storage_key)
        if not os.path.exists(file_path):
            raise Http404("文件不存在")

        with open(file_path, "rb") as f:
            content = f.read()

        response = HttpResponse(content, content_type=record.content_type or "application/octet-stream")
        response["Cache-Control"] = "public, max-age=3600"
        return response


class FileInfoView(APIView):
    """获取文件详细信息"""

    def get(self, request, file_id):
        try:
            record = FileRecord.objects.get(id=file_id, is_deleted=False)
        except FileRecord.DoesNotExist:
            return Response({"error": "文件不存在"}, status=status.HTTP_404_NOT_FOUND)

        return Response(
            {
                "id": str(record.id),
                "storage_type": record.storage_type,
                "folder": record.folder,
                "file_category": record.file_category,
                "file_size": record.file_size,
                "content_type": record.content_type,
                "width": record.width,
                "height": record.height,
                "is_public": record.is_public,
                "url": f"/api/v1/file/{record.id}/",
                "created_at": record.created_at,
                "updated_at": record.updated_at,
            }
        )


class FileByKeyView(APIView):
    """通过 storage_key 查询文件"""

    def get(self, request, storage_key):
        try:
            record = FileRecord.objects.get(storage_key=storage_key, is_deleted=False)
        except FileRecord.DoesNotExist:
            return Response({"error": "文件不存在"}, status=status.HTTP_404_NOT_FOUND)

        return Response(
            {
                "id": str(record.id),
                "url": f"/api/v1/file/{record.id}/",
                "storage_type": record.storage_type,
                "content_type": record.content_type,
            }
        )


class FileListView(APIView):
    """文件列表查询"""

    def get(self, request):
        tenant_id = request.query_params.get("tenant_id", "")
        folder = request.query_params.get("folder", "")
        file_category = request.query_params.get("category", "")

        query = FileRecord.objects.filter(is_deleted=False)

        if tenant_id:
            query = query.filter(tenant_id=tenant_id)
        if folder:
            query = query.filter(folder=folder)
        if file_category:
            query = query.filter(file_category=file_category)

        records = query[:100]

        return Response(
            [
                {
                    "id": str(r.id),
                    "url": f"/api/v1/file/{r.id}/",
                    "folder": r.folder,
                    "file_category": r.file_category,
                    "file_size": r.file_size,
                    "content_type": r.content_type,
                    "created_at": r.created_at,
                }
                for r in records
            ]
        )


class FileSecureUrlView(APIView):
    """
    获取文件真实地址（内部/AI调用）
    返回真实的 OSS URL 或本地路径
    """

    def post(self, request):
        file_id = request.data.get("file_id")
        if not file_id:
            return Response({"error": "缺少 file_id 参数"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            record = FileRecord.objects.get(id=file_id, is_deleted=False)
        except FileRecord.DoesNotExist:
            return Response({"error": "文件不存在"}, status=status.HTTP_404_NOT_FOUND)

        from apps.common.services.storage_service import storage_service

        if record.storage_type == "oss":
            # 返回签名 URL
            secure_url = storage_service.get_signed_url(record.storage_key)
        else:
            # 返回本地路径
            secure_url = record.access_url

        return Response(
            {
                "file_id": str(record.id),
                "secure_url": secure_url,
                "storage_type": record.storage_type,
                "content_type": record.content_type,
            }
        )


class FileBulkSecureUrlView(APIView):
    """批量获取文件真实地址"""

    def post(self, request):
        file_ids = request.data.get("file_ids", [])
        if not file_ids:
            return Response({"error": "缺少 file_ids 参数"}, status=status.HTTP_400_BAD_REQUEST)

        from apps.common.services.storage_service import storage_service

        results = []
        for file_id in file_ids:
            try:
                record = FileRecord.objects.get(id=file_id, is_deleted=False)

                if record.storage_type == "oss":
                    secure_url = storage_service.get_signed_url(record.storage_key)
                else:
                    secure_url = record.access_url

                results.append(
                    {
                        "file_id": str(record.id),
                        "secure_url": secure_url,
                        "storage_type": record.storage_type,
                        "content_type": record.content_type,
                    }
                )
            except FileRecord.DoesNotExist:
                results.append(
                    {
                        "file_id": file_id,
                        "error": "文件不存在",
                    }
                )

        return Response(results)
