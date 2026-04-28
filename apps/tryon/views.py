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
from apps.tryon.serializers import TryOnRecordSerializer, TryOnGenerateSerializer, TryOnStatusSerializer, TryOnSaveSerializer
from apps.wardrobe.models import Clothing
from .models import TryOnRecord, TryOnClothing
from .services import TryOnService

logger = logging.getLogger(__name__)


def get_client_ip(request):
    """获取客户端 IP"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '')


class TryOnGenerateView(APIView):
    """提交试穿任务"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = TryOnGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        avatar_key = serializer.validated_data['avatar_key']
        clothing_uuids = serializer.validated_data['clothing_uuids']
        session_id = serializer.validated_data['session_id']
        ai_engine_name = serializer.validated_data.get('ai_engine', 'seeddance')

        # 检查配额
        merchant = request.user
        if merchant.quota_remaining <= 0:
            raise QuotaExceededException()

        # 处理头像：通过 key 解析 URL
        from apps.common.utils.url_utils import get_url_by_key
        
        if RecordPrefix.is_tryon_uuid(avatar_key):
            # 历史记录 UUID
            try:
                history_record = TryOnRecord.objects.get(
                    uuid=avatar_key,
                    merchant_id=merchant.id,
                    is_deleted=False
                )
                avatar_url = history_record.avatar_url
                avatar_storage_key = history_record.avatar_key
            except TryOnRecord.DoesNotExist:
                raise ResourceNotFoundException(ErrorMessage.HISTORY_NOT_FOUND)
        elif ContentKey.is_valid(avatar_key):
            # 内容 Key: "local:xxx" 或 "oss:xxx"
            avatar_url = ContentKey.resolve_or_raise(
                avatar_key, 
                tenant_id=str(merchant.uuid),
                resource_name='头像'
            )
            avatar_storage_key = avatar_key
        else:
            # 存储路径: "wardrobe/xxx.jpg"
            avatar_url = get_url_by_key(avatar_key)
            avatar_storage_key = avatar_key
        
        # 分离数据库服装 UUID 和 key 形式的服装标识
        db_clothing_uuids = []
        key_clothing_urls = []  # 通过 key 复用的服装 URL
        
        logger.info(f"[TryOn] 收到的 clothing_uuids: {clothing_uuids}")
        
        for uuid_or_key in clothing_uuids:
            if uuid_or_key.startswith('key:'):
                # key: 形式，通过 ContentKey 复用
                content_key = uuid_or_key[4:]  # 去掉 "key:" 前缀
                logger.info(f"[TryOn] 检测到 key 形式的服装: content_key={content_key}")
                if ContentKey.is_valid(content_key):
                    url = ContentKey.resolve_or_raise(
                        content_key,
                        tenant_id=str(merchant.uuid),
                        resource_name='服装'
                    )
                    key_clothing_urls.append(url)
                    logger.info(f"[TryOn] 通过 key 复用服装成功: key={content_key}, url={url}")
                else:
                    # 无效的 key，跳过
                    logger.warning(f"[TryOn] 无效的 content_key，跳过: {content_key}")
            else:
                # 普通 UUID
                db_clothing_uuids.append(uuid_or_key)
        
        logger.info(f"[TryOn] 数据库服装 UUIDs: {db_clothing_uuids}")
        logger.info(f"[TryOn] 通过 key 复用的服装 URLs: {key_clothing_urls}")
        
        # 获取数据库中的服装
        db_clothes = []
        if db_clothing_uuids:
            db_clothes = list(Clothing.objects.filter(
                uuid__in=db_clothing_uuids,
                merchant_id=merchant.id,
                is_active=True,
                is_deleted=False
            ))

        # 准备服装文件列表
        clothing_files = []
        
        # 添加数据库服装 (已上传到 OSS 的 URL，TryOnService 会自动生成预签名)
        clothing_urls = [c.image_url for c in db_clothes]
        # 添加通过 key 复用的服装 URL
        clothing_urls.extend(key_clothing_urls)

        # 构建服装 key 列表（用于前端复用）
        clothing_keys = []
        # 数据库服装的 key
        from apps.common.utils.url_utils import get_key_from_url
        from apps.common.constants import ContentKeyPrefix
        import os
        import re
        
        for c in db_clothes:
            if c.file_hash:
                # file_hash 已经是 content_key 格式（storage_type:md5）
                clothing_keys.append(c.file_hash)
            else:
                # 从 URL 中提取 MD5 生成 content_key
                storage_key = get_key_from_url(c.image_url)
                if storage_key:
                    filename = os.path.basename(storage_key)
                    filename_without_ext = os.path.splitext(filename)[0]
                    
                    # 检查文件名是否是 MD5 格式（32位十六进制）
                    if len(filename_without_ext) == 32 and re.match(r'^[a-f0-9]{32}$', filename_without_ext):
                        storage_type = ContentKeyPrefix.OSS if 'oss' in c.image_url.lower() else ContentKeyPrefix.LOCAL
                        content_key = ContentKey.from_md5(filename_without_ext, storage_type)
                        clothing_keys.append(content_key)
                    else:
                        clothing_keys.append('')
                else:
                    clothing_keys.append('')
        # 通过 key 复用的服装 key
        for uuid_or_key in clothing_uuids:
            if uuid_or_key.startswith('key:'):
                clothing_keys.append(uuid_or_key[4:])  # 去掉 "key:" 前缀

        # 构建服装信息列表（用于 AI prompt 优化）
        clothing_info_list = []
        
        # 数据库服装的信息
        for c in db_clothes:
            clothing_info_list.append({
                'category': c.category,
                'subcategory': c.subcategory,
                'name': c.name,
            })
        
        # 通过 key 复用的服装（没有 category 信息）
        for _ in key_clothing_urls:
            clothing_info_list.append({
                'category': '',
                'subcategory': '',
                'name': '',
            })

        # 使用 TryOnService 创建任务
        service = TryOnService(engine_name=ai_engine_name)
        
        try:
            result = service.create_task(
                avatar_image=avatar_url,
                clothes_images=clothing_urls,
                tenant_id=str(merchant.uuid),
                clothing_info=clothing_info_list,
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
                avatar_key=result.get('avatar_key', avatar_storage_key),
                ai_engine=ai_engine_name,
                ip_address=get_client_ip(request),
                device_info=request.META.get('HTTP_USER_AGENT', '')[:200],
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
                    'result_url': get_private_url(record.result_url),
                    'estimated_time': 0,
                })

        # 清理旧记录（同一会话最多保留 20 条）
        self._cleanup_old_records(merchant, session_id)

        # 合并服装 keys：数据库/key复用的服装 + 自定义服装
        all_clothes_keys = clothing_keys + result.get('clothes_keys', [])

        return ApiResponse.success({
            'record_uuid': record.uuid,
            'task_id': record.task_id,
            'status': record.status,
            'estimated_time': 50,  # AI 生成预计 40-60 秒
            'sse_url': f'/api/v1/tryon/records/{record.uuid}/sse/',
            'avatar_key': result.get('avatar_key') or avatar_storage_key,  # 头像 key（供前端复用）
            'clothes_keys': all_clothes_keys,  # 服装 key 列表（供前端复用）
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
            return '处理失败，请稍后重试'
        
        # 错误信息映射表
        error_mappings = {
            # URL 相关错误
            'localhost': '图片地址无效，请重新上传图片',
            '本地地址': '图片地址无效，请重新上传图片',
            '内网地址': '图片地址无效，请重新上传图片',
            '公网可访问': '图片地址无效，请重新上传图片',
            'HTTP(S) 协议': '图片地址格式错误，请重新上传',
            
            # 任务相关错误
            '无效的任务 ID': '任务处理失败，请重试',
            '任务不存在': '任务已过期或不存在',
            
            # 配置相关错误
            '配置不完整': '服务暂时不可用，请稍后重试',
            '已熔断': '服务繁忙，请稍后重试',
            
            # API 相关错误
            'API 未返回结果': 'AI 服务响应异常，请重试',
            '生成试穿图像失败': 'AI 生成失败，请重试',
            
            # 通用错误
            '下载失败': '图片下载失败，请重试',
            '存储': '图片存储失败，请重试',
        }
        
        # 检查是否包含关键技术关键词
        error_lower = error_message.lower()
        for keyword, friendly_msg in error_mappings.items():
            if keyword.lower() in error_lower:
                return friendly_msg
        
        # 如果错误信息包含技术细节（如 URL、路径等），返回通用错误
        if 'http://' in error_message or 'https://' in error_message:
            return '图片处理失败，请重新上传'
        if '/' in error_message and '.' in error_message:
            return '处理失败，请稍后重试'
        
        # 返回原错误信息（如果已经是用户友好的）
        return error_message

    def get(self, request, uuid):
        try:
            record = TryOnRecord.objects.get(uuid=uuid, merchant_id=request.user.id)
        except TryOnRecord.DoesNotExist:
            raise ResourceNotFoundException('试穿记录')

        # 如果已完成或失败，直接返回
        if record.status in [TryOnRecord.Status.COMPLETED, TryOnRecord.Status.FAILED]:
            logger.info(f"[TryOnStatus] 已完成记录: result_url={record.result_url}")
            return ApiResponse.success({
                'record_uuid': record.uuid,
                'status': record.status,
                'progress': 100 if record.status == TryOnRecord.Status.COMPLETED else 0,
                'result_url': get_private_url(record.result_url),
                'result_thumb_url': get_private_url(record.result_thumb_url),
                'error_message': self._get_user_friendly_error(record.error_message),
                'processing_time': float(record.processing_time) if record.processing_time else None
            })

        # 如果 task_id 为空，说明任务提交时就失败了，直接返回失败状态
        if not record.task_id:
            return ApiResponse.success({
                'record_uuid': record.uuid,
                'status': TryOnRecord.Status.FAILED,
                'progress': 0,
                'result_url': None,
                'result_thumb_url': None,
                'error_message': self._get_user_friendly_error(record.error_message),
                'processing_time': None
            })

        # 使用 TryOnService 查询状态
        service = TryOnService(engine_name=record.ai_engine)
        result = service.query_status(record.task_id)

        # 更新记录状态
        if result['status'] == 'completed':
            record.status = TryOnRecord.Status.COMPLETED
            logger.info(f"[TryOnStatus] 更新 result_url: {result.get('result_url')}")
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
            # 只有当数据库中没有错误信息时，才使用引擎返回的错误信息
            if not record.error_message:
                record.error_message = result.get('error_message', '处理失败')

        record.save()

        return ApiResponse.success({
            'record_uuid': record.uuid,
            'status': record.status,
            'progress': result.get('progress', 0),
            'result_url': get_private_url(record.result_url) if record.status == TryOnRecord.Status.COMPLETED else None,
            'result_thumb_url': get_private_url(record.result_thumb_url) if record.status == TryOnRecord.Status.COMPLETED else None,
            'error_message': self._get_user_friendly_error(record.error_message),
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
