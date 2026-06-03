"""
试穿视图
"""

import logging
from django.utils import timezone
from django.db import transaction
from django.db.models import F
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from apps.common.utils.response import ApiResponse
from apps.common.utils.pagination import CustomPageNumberPagination
from apps.common.utils.cache_utils import QuotaCache
from apps.common.exceptions import QuotaExceededException, ResourceNotFoundException
from apps.common.constants import RecordPrefix, ErrorMessage
from apps.common.utils.content_key import ContentKey
from apps.common.utils.url_utils import get_private_url
from apps.accounts.models import Merchant
from apps.tryon.serializers import (
    TryOnRecordSerializer,
    TryOnGenerateSerializer,
    TryOnStatusSerializer,
    TryOnSaveSerializer,
)
from apps.wardrobe.models import Clothing
from .models import TryOnRecord, TryOnClothing
from .services import TryOnService

logger = logging.getLogger(__name__)


def get_client_ip(request):
    """获取客户端 IP"""
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


class TryOnGenerateView(APIView):
    """提交试穿任务

    新逻辑：
    1. 形象：通过 avatar_key 查找图片URL（系统模特或用户上传）
    2. 服装：通过 clothing_ids 查询数据库获取图片URL
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = TryOnGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        avatar_key = serializer.validated_data.get("avatar_key", "")
        model_key = serializer.validated_data.get("model_key", "")
        avatar_source = serializer.validated_data.get("avatar_source", TryOnRecord.AvatarSource.USER)
        clothing_ids = serializer.validated_data["clothing_ids"]
        clothing_info_str = serializer.validated_data.get("clothing_info", "[]")
        session_id = serializer.validated_data["session_id"]
        ai_engine_name = serializer.validated_data.get("ai_engine", "seeddance")

        # 解析服装详细信息
        import json

        try:
            clothing_info_list = json.loads(clothing_info_str) if clothing_info_str else []
            if not isinstance(clothing_info_list, list):
                clothing_info_list = []
        except json.JSONDecodeError:
            clothing_info_list = []

        logger.info(
            f"[TryOn] 解析服装信息: clothing_info_str={clothing_info_str[:100] if clothing_info_str else 'empty'}, count={len(clothing_info_list)}"
        )

        # 检查配额
        merchant = request.user
        if merchant.quota_remaining <= 0:
            raise QuotaExceededException()

        # ========== 1. 处理头像：根据 avatar_source 区分处理 ==========
        from apps.common.utils.url_utils import get_url_by_key
        from apps.common.models import ModelPhoto
        from django.conf import settings

        avatar_url = None

        if avatar_source == TryOnRecord.AvatarSource.SYSTEM:
            # ===== 系统模特 =====
            # 使用 model_key 查找模特
            logger.info(f"[TryOn] 使用系统模特，model_key={model_key}")

            # 尝试通过 ID 查找
            try:
                model_id = int(model_key)
                model_photo = ModelPhoto.objects.filter(id=model_id, is_active=True).first()
                if model_photo:
                    # 通过 FileRecord 获取头像 URL
                    if model_photo.file:
                        avatar_url = f"/api/v1/file/{model_photo.file.id}/"
                    else:
                        avatar_url = ""
                    logger.info(f"[TryOn] 找到模特照片: id={model_id}")
            except (ValueError, TypeError):
                pass

            # 如果没找到，尝试通过 model: 前缀查找
            if not avatar_url and model_key.startswith("model:"):
                try:
                    model_id = int(model_key.replace("model:", ""))
                    model_photo = ModelPhoto.objects.filter(id=model_id, is_active=True).first()
                    if model_photo:
                        if model_photo.file:
                            avatar_url = f"/api/v1/file/{model_photo.file.id}/"
                        else:
                            avatar_url = ""
                        logger.info(f"[TryOn] 找到模特照片: id={model_id}")
                except (ValueError, TypeError):
                    pass

            # 如果还是没找到，尝试 ContentKey 解析（兼容旧数据）
            if not avatar_url and ContentKey.is_valid(model_key):
                avatar_url = ContentKey.resolve_or_raise(
                    model_key, tenant_id=getattr(settings, "SYSTEM_TENANT_ID", "system"), resource_name="模特照片"
                )

            if not avatar_url:
                raise ResourceNotFoundException("模特照片")

        elif avatar_source == TryOnRecord.AvatarSource.HISTORY:
            # ===== 历史记录 =====
            # avatar_key 是 TryOnRecord 的 UUID
            logger.info(f"[TryOn] 从历史记录复用头像，uuid={avatar_key}")
            try:
                history_record = TryOnRecord.objects.get(uuid=avatar_key, merchant_id=merchant.id, is_deleted=False)
                # 通过 FileRecord 获取头像URL
                if history_record.avatar_file:
                    avatar_url = f"/api/v1/file/{history_record.avatar_file.id}/"
                else:
                    avatar_url = history_record.avatar_url or ""
                # 从历史记录推断 source
                avatar_source = history_record.avatar_source
            except TryOnRecord.DoesNotExist:
                raise ResourceNotFoundException(ErrorMessage.HISTORY_NOT_FOUND)

        else:
            # ===== 用户上传 =====
            # avatar_key 是 ContentKey、存储路径或文件ID
            logger.info(f"[TryOn] 使用用户上传头像，avatar_key={avatar_key}")

            if ContentKey.is_valid(avatar_key):
                # Content Key: "local:xxx" 或 "oss:xxx"
                avatar_url = ContentKey.resolve_or_raise(
                    avatar_key, tenant_id=str(merchant.uuid), resource_name="用户头像"
                )
            elif len(avatar_key) == 36 and avatar_key.count("-") == 4:
                # 可能是文件ID（UUID格式）
                avatar_url = f"/api/v1/file/{avatar_key}/"
            else:
                # 存储路径: "avatars/xxx.jpg"
                avatar_url = get_url_by_key(avatar_key)

        if not avatar_url:
            raise ResourceNotFoundException("头像图片")

        logger.info(f"[TryOn] 头像解析成功: source={avatar_source}, url={avatar_url[:50]}...")

        # ========== 2. 处理服装：通过 clothing_ids 查询数据库获取图片 ==========
        logger.info(f"[TryOn] 收到的 clothing_ids: {clothing_ids}")

        # 查询数据库获取服装信息
        db_clothes = list(
            Clothing.objects.filter(uuid__in=clothing_ids, merchant_id=merchant.id, is_active=True, is_deleted=False)
        )

        # 检查是否所有服装都找到了
        found_ids = {str(c.uuid) for c in db_clothes}
        missing_ids = set(clothing_ids) - found_ids
        if missing_ids:
            logger.warning(f"[TryOn] 未找到的服装ID: {missing_ids}")

        # 按传入的顺序排列服装
        clothes_dict = {str(c.uuid): c for c in db_clothes}
        ordered_clothes = [clothes_dict.get(id_str) for id_str in clothing_ids if id_str in clothes_dict]

        # 获取服装图片URL列表（通过FileRecord）
        clothing_urls = []
        clothing_file_ids = []

        for c in ordered_clothes:
            if c.file:
                clothing_urls.append(f"/api/v1/file/{c.file.id}/")
                clothing_file_ids.append(str(c.file.id))
            elif c.image_url:
                clothing_urls.append(c.image_url)
                clothing_file_ids.append("")
            else:
                clothing_urls.append("")
                clothing_file_ids.append("")

        # 过滤无效URL
        clothing_urls = [url for url in clothing_urls if url]

        if not clothing_urls:
            return ApiResponse.error("未找到有效的服装图片")

        logger.info(f"[TryOn] 找到 {len(clothing_urls)} 件服装")

        # 如果前端没有传递服装详细信息，则从数据库构建
        if not clothing_info_list:
            clothing_info_list = []

            # 数据库服装的信息
            for c in ordered_clothes:
                clothing_info_list.append(
                    {
                        "uuid": str(c.uuid),
                        "category": c.category,
                        "subcategory": c.subcategory,
                        "name": c.name,
                        "color": c.color or "#000000",
                        "is_custom": False,
                    }
                )

        # 使用 TryOnService 创建任务（内部已保存记录和服装信息）
        service = TryOnService(engine_name=ai_engine_name)

        try:
            result = service.create_task(
                avatar_image=avatar_url,
                clothes_images=clothing_urls,
                tenant_id=str(merchant.uuid),
                clothing_info=clothing_info_list,
                avatar_source=avatar_source,  # 传递头像来源
                merchant_id=merchant.id,
                session_id=session_id,
                ip_address=get_client_ip(request),
                device_info=request.META.get("HTTP_USER_AGENT", "")[:200],
            )
        except Exception as e:
            return ApiResponse.error(str(e))

        # 获取 create_task 创建的记录
        record_uuid = result.get("record_uuid")
        record = TryOnRecord.objects.filter(uuid=record_uuid).first()

        if not record:
            return ApiResponse.error("创建试穿记录失败")

        # 如果同步引擎已经返回结果
        if result.get("result_url"):
            # 原子扣减配额
            Merchant.objects.filter(id=merchant.id).update(quota_used=F("quota_used") + 1)

            # 清除配额缓存
            QuotaCache.invalidate(merchant.id)

            return ApiResponse.success(
                {
                    "record_uuid": record.uuid,
                    "task_id": record.task_id,
                    "status": record.status,
                    "result_url": get_private_url(record.result_url),
                    "estimated_time": 0,
                }
            )

        # 清理旧记录（同一会话最多保留 20 条）
        self._cleanup_old_records(merchant, session_id)

        return ApiResponse.success(
            {
                "record_uuid": record.uuid,
                "task_id": record.task_id,
                "status": record.status,
                "estimated_time": result.get("estimated_time", 40),  # 使用引擎返回的预计时间，默认为40秒
                "sse_url": f"/api/v1/tryon/records/{record.uuid}/sse/",
                "avatar_key": result.get("avatar_key", ""),  # 头像 key（供前端复用）
                "avatar_file_id": result.get("avatar_file_id", ""),
                "clothes_keys": result.get("clothes_keys", []),  # 服装 key 列表（供前端复用）
                "clothes_file_ids": result.get("clothes_file_ids", []),
            }
        )

    def _cleanup_old_records(self, merchant, session_id):
        """清理旧记录"""
        records = TryOnRecord.objects.filter(merchant_id=merchant.id, session_id=session_id).order_by("-created_at")

        if records.count() > 20:
            old_records = records[20:]
            for record in old_records:
                record.is_deleted = True
                record.deleted_at = timezone.now()
                record.save(update_fields=["is_deleted", "deleted_at"])


class TryOnStatusView(APIView):
    """查询试穿状态"""

    permission_classes = [IsAuthenticated]

    @staticmethod
    def _get_user_friendly_error(error_message: str) -> str:
        """
        将技术性错误转换为用户友好的错误信息

        Args:
            error_message: 原始错误信息

        Returns:
            用户友好的错误信息
        """
        if not error_message:
            return "处理失败，请稍后重试"

        # 错误信息映射表
        error_mappings = {
            # URL 相关错误
            "localhost": "图片地址无效，请重新上传图片",
            "本地地址": "图片地址无效，请重新上传图片",
            "内网地址": "图片地址无效，请重新上传图片",
            "公网可访问": "图片地址无效，请重新上传图片",
            "HTTP(S) 协议": "图片地址格式错误，请重新上传",
            # 任务相关错误
            "无效的任务 ID": "任务处理失败，请重试",
            "任务不存在": "任务已过期或不存在",
            # 配置相关错误
            "配置不完整": "服务暂时不可用，请稍后重试",
            "已熔断": "服务繁忙，请稍后重试",
            # API 相关错误
            "API 未返回结果": "AI 服务响应异常，请重试",
            "生成试穿图像失败": "AI 生成失败，请重试",
            # 通用错误
            "下载失败": "图片下载失败，请重试",
            "存储": "图片存储失败，请重试",
        }

        # 检查是否包含关键技术关键词
        error_lower = error_message.lower()
        for keyword, friendly_msg in error_mappings.items():
            if keyword.lower() in error_lower:
                return friendly_msg

        # 如果错误信息包含技术细节（如 URL、路径等），返回通用错误
        if "http://" in error_message or "https://" in error_message:
            return "图片处理失败，请重新上传"
        if "/" in error_message and "." in error_message:
            return "处理失败，请稍后重试"

        # 返回原错误信息（如果已经是用户友好的）
        return error_message

    def get(self, request, uuid):
        try:
            record = TryOnRecord.objects.get(uuid=uuid, merchant_id=request.user.id)
        except TryOnRecord.DoesNotExist:
            raise ResourceNotFoundException("试穿记录")

        # 如果已完成或失败，直接返回
        if record.status in [TryOnRecord.Status.COMPLETED, TryOnRecord.Status.FAILED]:
            logger.info(f"[TryOnStatus] 已完成记录: result_url={record.result_url}")

            # 如果状态是 COMPLETED 但 result_url 为空，视为失败
            is_actually_failed = record.status == TryOnRecord.Status.COMPLETED and not record.result_url

            return ApiResponse.success(
                {
                    "record_uuid": record.uuid,
                    "status": TryOnRecord.Status.FAILED if is_actually_failed else record.status,
                    "progress": 100 if record.status == TryOnRecord.Status.COMPLETED and not is_actually_failed else 0,
                    "result_url": get_private_url(record.result_url) if not is_actually_failed else None,
                    "result_thumb_url": get_private_url(record.result_thumb_url) if not is_actually_failed else None,
                    "error_message": (
                        self._get_user_friendly_error(record.error_message)
                        if (record.status == TryOnRecord.Status.FAILED or is_actually_failed)
                        else None
                    ),
                    "processing_time": float(record.processing_time) if record.processing_time else None,
                }
            )

        # 如果 task_id 为空，说明任务提交时就失败了，直接返回失败状态
        if not record.task_id:
            return ApiResponse.success(
                {
                    "record_uuid": record.uuid,
                    "status": TryOnRecord.Status.FAILED,
                    "progress": 0,
                    "result_url": None,
                    "result_thumb_url": None,
                    "error_message": self._get_user_friendly_error(record.error_message),
                    "processing_time": None,
                }
            )

        # 使用 TryOnService 查询状态
        service = TryOnService(engine_name=record.ai_engine)
        result = service.query_status(record.task_id)

        # 更新记录状态
        if result["status"] == "completed":
            # 如果 result_url 为空，视为失败
            if not result.get("result_url"):
                record.status = TryOnRecord.Status.FAILED
                if not record.error_message:
                    record.error_message = result.get("error_message", "生成失败，未获取到结果图片")
            else:
                record.status = TryOnRecord.Status.COMPLETED
                logger.info(f"[TryOnStatus] 更新 result_url: {result.get('result_url')}")
                record.result_url = result["result_url"]
                record.processing_time = result.get("processing_time")

                # 原子扣减配额（成功后扣减）
                if not record.quota_deducted:
                    Merchant.objects.filter(id=request.user.id).update(quota_used=F("quota_used") + 1)
                    record.quota_deducted = True
                    # 清除配额缓存
                    QuotaCache.invalidate(request.user.id)

        elif result["status"] == "failed":
            record.status = TryOnRecord.Status.FAILED
            # 只有当数据库中没有错误信息时，才使用引擎返回的错误信息
            if not record.error_message:
                record.error_message = result.get("error_message", "处理失败")

        record.save()

        return ApiResponse.success(
            {
                "record_uuid": record.uuid,
                "status": record.status,
                "progress": result.get("progress", 0),
                "result_url": (
                    get_private_url(record.result_url) if record.status == TryOnRecord.Status.COMPLETED else None
                ),
                "result_thumb_url": (
                    get_private_url(record.result_thumb_url) if record.status == TryOnRecord.Status.COMPLETED else None
                ),
                "error_message": self._get_user_friendly_error(record.error_message),
                "processing_time": float(record.processing_time) if record.processing_time else None,
            }
        )


class TryOnRecordListView(APIView):
    """试穿记录列表"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        import logging

        logger = logging.getLogger("tryon")

        try:
            logger.info(
                f"[TryOnRecordList] user={request.user.id}, session_id={request.query_params.get('session_id')}"
            )

            queryset = TryOnRecord.objects.filter(merchant_id=request.user.id, is_deleted=False)

            logger.info(f"[TryOnRecordList] queryset count={queryset.count()}")

            # 筛选
            session_id = request.query_params.get("session_id")
            is_saved = request.query_params.get("is_saved")
            status_filter = request.query_params.get("status")

            if session_id:
                queryset = queryset.filter(session_id=session_id)
                logger.info(f"[TryOnRecordList] filtered by session_id={session_id}, count={queryset.count()}")
            if is_saved is not None:
                queryset = queryset.filter(is_saved=is_saved.lower() == "true")
            if status_filter:
                queryset = queryset.filter(status=status_filter)

            # 分页
            paginator = CustomPageNumberPagination()
            page = paginator.paginate_queryset(queryset, request)

            logger.info(f"[TryOnRecordList] page size={len(page) if page else 0}")

            serializer = TryOnRecordSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)
        except Exception as e:
            logger.exception(f"[TryOnRecordList] Error: {e}")
            raise


class TryOnSaveView(APIView):
    """收藏/取消收藏"""

    permission_classes = [IsAuthenticated]

    def post(self, request, uuid):
        logger.info(f"[TryOnSave] 收到收藏请求: uuid={uuid}, user={request.user.id}, data={request.data}")

        serializer = TryOnSaveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        is_saved_value = serializer.validated_data["is_saved"]
        logger.info(f"[TryOnSave] 解析到 is_saved: {is_saved_value}")

        try:
            record = TryOnRecord.objects.get(uuid=uuid, merchant_id=request.user.id)
            logger.info(f"[TryOnSave] 找到记录: id={record.id}, 当前 is_saved={record.is_saved}")
        except TryOnRecord.DoesNotExist:
            logger.error(f"[TryOnSave] 记录不存在: uuid={uuid}, user={request.user.id}")
            raise ResourceNotFoundException("试穿记录")

        record.is_saved = is_saved_value
        record.save(update_fields=["is_saved"])

        logger.info(f"[TryOnSave] 收藏状态已更新: uuid={uuid}, is_saved={record.is_saved}")

        return ApiResponse.success({"is_saved": record.is_saved}, message="已收藏" if record.is_saved else "已取消收藏")


class TryOnDeleteView(APIView):
    """删除试穿记录（软删除）"""

    permission_classes = [IsAuthenticated]

    def delete(self, request, uuid):
        try:
            record = TryOnRecord.objects.get(uuid=uuid, merchant_id=request.user.id)
        except TryOnRecord.DoesNotExist:
            raise ResourceNotFoundException("试穿记录")

        # 软删除
        record.is_deleted = True
        record.deleted_at = timezone.now()
        record.save(update_fields=["is_deleted", "deleted_at"])

        return ApiResponse.success(message="记录已删除")


class TryOnClearHistoryView(APIView):
    """清空试穿记录（软删除）"""

    permission_classes = [IsAuthenticated]

    def delete(self, request):
        session_id = request.query_params.get("session_id")

        # 构建查询条件
        filters = {"merchant_id": request.user.id, "is_deleted": False}

        if session_id:
            # 按 session_id 清除特定顾客的记录
            filters["session_id"] = session_id

        # 软删除符合条件的记录
        count = TryOnRecord.objects.filter(**filters).update(is_deleted=True, deleted_at=timezone.now())

        return ApiResponse.success({"deleted_count": count}, message=f"已清空 {count} 条记录")
