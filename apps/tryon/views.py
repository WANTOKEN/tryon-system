"""
试穿视图
"""
import os
import base64
from io import BytesIO
from django.conf import settings
from django.utils import timezone
from django.core.files.storage import default_storage
from django.db import transaction
from django.db.models import F
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from apps.common.utils.response import ApiResponse
from apps.common.utils.pagination import CustomPageNumberPagination
from apps.common.utils.cache_utils import QuotaCache
from apps.common.exceptions import QuotaExceededException, ResourceNotFoundException
from apps.accounts.models import Merchant
from apps.tryon.serializers import get_full_url
from apps.wardrobe.models import Clothing
from .models import TryOnRecord, TryOnClothing
from .serializers import (
    TryOnRecordSerializer, TryOnGenerateSerializer,
    TryOnStatusSerializer, TryOnSaveSerializer
)
from .services import TryOnService


def get_client_ip(request):
    """获取客户端 IP"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '')


def save_base64_image(base64_data, folder, filename_prefix):
    """保存 Base64 图片到存储"""
    # 解析 Base64
    if base64_data.startswith('data:'):
        # 格式: data:image/png;base64,xxxxx
        header, data = base64_data.split(',', 1)
        # 获取扩展名
        if 'png' in header:
            ext = '.png'
        elif 'jpeg' in header or 'jpg' in header:
            ext = '.jpg'
        elif 'webp' in header:
            ext = '.webp'
        else:
            ext = '.jpg'
    else:
        data = base64_data
        ext = '.jpg'
    
    # 解码
    image_data = base64.b64decode(data)
    image_file = BytesIO(image_data)
    
    # 生成文件路径
    filename = f"{folder}/{filename_prefix}{ext}"
    
    # 保存
    path = default_storage.save(filename, image_file)
    return f"{settings.MEDIA_URL}{path}"


class TryOnGenerateView(APIView):
    """提交试穿任务"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = TryOnGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        avatar = serializer.validated_data['avatar']
        clothing_uuids = serializer.validated_data.get('clothing_uuids', [])
        custom_clothes = serializer.validated_data.get('custom_clothes', [])
        session_id = serializer.validated_data['session_id']
        ai_engine_name = serializer.validated_data.get('ai_engine', 'aliyun')

        # 检查配额
        merchant = request.user
        if merchant.quota_remaining <= 0:
            raise QuotaExceededException()

        # 获取数据库中的服装
        db_clothes = []
        if clothing_uuids:
            db_clothes = list(Clothing.objects.filter(
                uuid__in=clothing_uuids,
                merchant_id=merchant.id,
                is_active=True,
                is_deleted=False
            ))

        # 准备服装文件列表
        clothing_files = []
        
        # 添加数据库服装 (已上传到 OSS 的 URL)
        clothing_urls = [c.image_url for c in db_clothes]

        # 处理自定义服装
        for idx, custom in enumerate(custom_clothes):
            image_data = custom['image']
            
            # 如果是 URL，直接使用
            if image_data.startswith('http'):
                clothing_urls.append(image_data)
                continue
            
            # Base64 图片，转换为文件对象
            if image_data.startswith('data:'):
                header, data = image_data.split(',', 1)
                if 'png' in header:
                    ext = '.png'
                elif 'jpeg' in header or 'jpg' in header:
                    ext = '.jpg'
                elif 'webp' in header:
                    ext = '.webp'
                else:
                    ext = '.jpg'
            else:
                data = image_data
                ext = '.jpg'
            
            image_bytes = base64.b64decode(data)
            image_file = BytesIO(image_bytes)
            image_file.name = f"custom_{idx}{ext}"
            clothing_files.append({
                'file': image_file,
                'name': custom.get('name', f'自定义服装{idx + 1}'),
                'category': custom.get('category', 'tops'),
                'subcategory': custom.get('subcategory', ''),
            })

        # 使用 TryOnService 创建任务
        service = TryOnService(engine_name=ai_engine_name)
        
        try:
            # 合并 clothing_urls 和 clothing_files
            # 将 clothing_files 转换为 image 对象列表
            clothes_images = list(clothing_urls)  # 复制 URL 列表
            clothes_images.extend([cf['file'] for cf in clothing_files])  # 添加文件对象
            
            result = service.create_task(
                avatar_image=avatar,
                clothes_images=clothes_images,
                tenant_id=str(merchant.uuid),
            )
        except Exception as e:
            return ApiResponse.error(str(e))

        # 使用事务保护创建操作
        with transaction.atomic():
            # 创建试穿记录
            record = TryOnRecord.objects.create(
                merchant_id=merchant.id,
                session_id=session_id,
                avatar_url=result['avatar_url'],
                ai_engine=ai_engine_name,
                ip_address=get_client_ip(request),
                device_info=request.META.get('HTTP_USER_AGENT', ''),
                task_id=result.get('task_id', ''),
                status=TryOnRecord.Status.PROCESSING,
            )

            # 批量创建服装关联（更高效）
            clothing_items = []
            
            # 数据库服装
            for clothing in db_clothes:
                clothing_items.append(TryOnClothing(
                    record_id=record.id,
                    clothing_id=clothing.uuid,
                    category=clothing.category,
                    subcategory=clothing.subcategory,
                    clothing_name=clothing.name,
                    clothing_color=clothing.color,
                    clothing_image=clothing.image_url
                ))

            # 自定义服装
            clothes_urls = result.get('clothes_urls', [])
            custom_clothes_urls = clothes_urls[len(db_clothes):] if len(db_clothes) < len(clothes_urls) else clothes_urls
            for idx, cf in enumerate(clothing_files):
                clothing_items.append(TryOnClothing(
                    record_id=record.id,
                    clothing_id=f"custom_{record.uuid}_{len(db_clothes) + idx}",
                    category=cf['category'],
                    subcategory=cf['subcategory'],
                    clothing_name=cf['name'],
                    clothing_color='#000000',
                    clothing_image=custom_clothes_urls[idx] if idx < len(custom_clothes_urls) else '',
                    is_custom=True
                ))

            # 批量插入
            if clothing_items:
                TryOnClothing.objects.bulk_create(clothing_items)

            # 如果同步引擎已经返回结果
            if result.get('result_url'):
                record.status = TryOnRecord.Status.COMPLETED
                record.result_url = result['result_url']
                record.quota_deducted = True
                record.save(update_fields=['status', 'result_url', 'quota_deducted'])

                # 原子扣减配额
                Merchant.objects.filter(id=merchant.id).update(
                    quota_used=F('quota_used') + 1
                )
                
                # 清除配额缓存
                QuotaCache.invalidate(merchant.id)

                return ApiResponse.success({
                    'record_uuid': record.uuid,
                    'task_id': record.task_id,
                    'status': record.status,
                    'result_url': get_full_url(record.result_url),
                    'estimated_time': 0,
                })

        # 清理旧记录（同一会话最多保留 20 条）
        # self._cleanup_old_records(merchant, session_id)

        return ApiResponse.success({
            'record_uuid': record.uuid,
            'task_id': record.task_id,
            'status': record.status,
            'estimated_time': 30,
            'sse_url': f'/api/v1/tryon/records/{record.uuid}/sse/'
        })

    def _cleanup_old_records(self, merchant, session_id):
        """清理旧记录"""
        records = TryOnRecord.objects.filter(
            merchant_id=merchant.id,
            session_id=session_id
        ).order_by('-created_at')

        if records.count() > 20:
            old_records = records[20:]
            for record in old_records:
                record.is_deleted = True
                record.deleted_at = timezone.now()
                record.save(update_fields=['is_deleted', 'deleted_at'])


class TryOnStatusView(APIView):
    """查询试穿状态"""
    permission_classes = [IsAuthenticated]

    def get(self, request, uuid):
        try:
            record = TryOnRecord.objects.get(uuid=uuid, merchant_id=request.user.id)
        except TryOnRecord.DoesNotExist:
            raise ResourceNotFoundException('试穿记录')

        # 如果已完成或失败，直接返回
        if record.status in [TryOnRecord.Status.COMPLETED, TryOnRecord.Status.FAILED]:
            return ApiResponse.success({
                'record_uuid': record.uuid,
                'status': record.status,
                'progress': 100 if record.status == TryOnRecord.Status.COMPLETED else 0,
                'result_url': get_full_url(record.result_url),
                'result_thumb_url': get_full_url(record.result_thumb_url),
                'error_message': record.error_message,
                'processing_time': float(record.processing_time) if record.processing_time else None
            })

        # 使用 TryOnService 查询状态
        service = TryOnService(engine_name=record.ai_engine)
        result = service.query_status(record.task_id)

        # 更新记录状态
        if result['status'] == 'completed':
            record.status = TryOnRecord.Status.COMPLETED
            record.result_url = result['result_url']
            record.processing_time = result.get('processing_time')

            # 原子扣减配额（成功后扣减）
            if not record.quota_deducted:
                Merchant.objects.filter(id=request.user.id).update(
                    quota_used=F('quota_used') + 1
                )
                record.quota_deducted = True
                # 清除配额缓存
                QuotaCache.invalidate(request.user.id)

        elif result['status'] == 'failed':
            record.status = TryOnRecord.Status.FAILED
            record.error_message = result.get('error_message', '处理失败')

        record.save()

        return ApiResponse.success({
            'record_uuid': record.uuid,
            'status': record.status,
            'progress': result.get('progress', 0),
            'result_url': get_full_url(record.result_url) if record.status == TryOnRecord.Status.COMPLETED else None,
            'result_thumb_url': get_full_url(record.result_thumb_url) if record.status == TryOnRecord.Status.COMPLETED else None,
            'error_message': record.error_message,
            'processing_time': float(record.processing_time) if record.processing_time else None
        })


class TryOnRecordListView(APIView):
    """试穿记录列表"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = TryOnRecord.objects.filter(
            merchant_id=request.user.id,
            is_deleted=False
        )

        # 筛选
        session_id = request.query_params.get('session_id')
        is_saved = request.query_params.get('is_saved')
        status_filter = request.query_params.get('status')

        if session_id:
            queryset = queryset.filter(session_id=session_id)
        if is_saved is not None:
            queryset = queryset.filter(is_saved=is_saved.lower() == 'true')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # 分页
        paginator = CustomPageNumberPagination()
        page = paginator.paginate_queryset(queryset, request)

        serializer = TryOnRecordSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class TryOnSaveView(APIView):
    """收藏/取消收藏"""
    permission_classes = [IsAuthenticated]

    def post(self, request, uuid):
        serializer = TryOnSaveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            record = TryOnRecord.objects.get(uuid=uuid, merchant_id=request.user.id)
        except TryOnRecord.DoesNotExist:
            raise ResourceNotFoundException('试穿记录')

        record.is_saved = serializer.validated_data['is_saved']
        record.save(update_fields=['is_saved'])

        return ApiResponse.success(
            {'is_saved': record.is_saved},
            message='已收藏' if record.is_saved else '已取消收藏'
        )


class TryOnDeleteView(APIView):
    """删除试穿记录（软删除）"""
    permission_classes = [IsAuthenticated]

    def delete(self, request, uuid):
        try:
            record = TryOnRecord.objects.get(uuid=uuid, merchant_id=request.user.id)
        except TryOnRecord.DoesNotExist:
            raise ResourceNotFoundException('试穿记录')

        # 软删除
        record.is_deleted = True
        record.deleted_at = timezone.now()
        record.save(update_fields=['is_deleted', 'deleted_at'])

        return ApiResponse.success(message='记录已删除')


class TryOnClearHistoryView(APIView):
    """清空试穿记录（软删除）"""
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        session_id = request.query_params.get('session_id')
        
        # 构建查询条件
        filters = {
            'merchant_id': request.user.id,
            'is_deleted': False
        }
        
        if session_id:
            # 按 session_id 清除特定顾客的记录
            filters['session_id'] = session_id
        
        # 软删除符合条件的记录
        count = TryOnRecord.objects.filter(**filters).update(
            is_deleted=True,
            deleted_at=timezone.now()
        )

        return ApiResponse.success({
            'deleted_count': count
        }, message=f'已清空 {count} 条记录')
