from rest_framework import routers, viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import authenticate
from django.conf import settings
from django.db import models
from django.db.models import Sum, Count, Avg, Q
from django.utils import timezone
from datetime import timedelta

from apps.accounts.models import Merchant
from apps.tryon.models import TryOnRecord, TryOnClothing
from apps.common.models import FileUploadRecord
from .models import AdminOperationLog, SystemConfig, QuotaHistory
from .serializers import (
    AdminOperationLogSerializer, SystemConfigSerializer, SystemConfigBatchSerializer,
    QuotaHistorySerializer, QuotaAdjustSerializer, QuotaResetSerializer,
    AdminUserCreateSerializer, AdminUserUpdateSerializer
)


# ==================== Admin Authentication ====================

@api_view(['GET'])
@permission_classes([AllowAny])
def get_public_key(request):
    """获取 RSA 公钥（用于密码加密）"""
    from .rsa_utils import get_or_create_rsa_keys
    _, public_key = get_or_create_rsa_keys()
    return Response({'public_key': public_key})


@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def admin_login(request):
    """管理员登录（支持 RSA 加密密码）"""
    username = request.data.get('username')
    password = request.data.get('password')
    encrypted = request.data.get('encrypted', False)
    
    if not username or not password:
        return Response({'message': '用户名和密码不能为空'}, status=status.HTTP_400_BAD_REQUEST)
    
    # 如果密码是加密的，先解密
    if encrypted:
        try:
            from .rsa_utils import decrypt_password
            password = decrypt_password(password)
        except Exception:
            return Response({'message': '密码解密失败'}, status=status.HTTP_400_BAD_REQUEST)
    
    user = authenticate(username=username, password=password)
    
    if user is None:
        return Response({'message': '用户名或密码错误'}, status=status.HTTP_401_UNAUTHORIZED)
    
    if not user.is_staff:
        return Response({'message': '无管理员权限'}, status=status.HTTP_403_FORBIDDEN)
    
    # 记录登录日志
    AdminOperationLog.log(
        request, 
        AdminOperationLog.ActionType.LOGIN,
        'AdminUser', 
        str(user.id), 
        user.username,
        {'login_type': 'admin'}
    )
    
    # 更新最后登录时间
    user.last_login_at = timezone.now()
    user.last_login_ip = request.META.get('REMOTE_ADDR', '')
    user.save(update_fields=['last_login_at', 'last_login_ip'])
    
    # 生成 JWT Token
    from rest_framework_simplejwt.tokens import RefreshToken
    refresh = RefreshToken.for_user(user)
    
    return Response({
        'access_token': str(refresh.access_token),
        'refresh_token': str(refresh),
        'user': {
            'id': user.id,
            'username': user.username,
            'phone': user.phone,
            'store_name': user.store_name,
            'is_superuser': user.is_superuser,
        }
    })


# ==================== Admin ViewSets ====================

class IsAdminUser(permissions.BasePermission):
    """自定义管理员权限"""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_staff


class MerchantAdminViewSet(viewsets.ModelViewSet):
    """商家管理 - Admin"""
    permission_classes = [IsAdminUser]
    queryset = Merchant.objects.all()
    
    def get_serializer_class(self):
        from apps.accounts.serializers import MerchantSerializer
        return MerchantSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get('search')
        status_filter = self.request.query_params.get('status')
        
        if search:
            queryset = queryset.filter(username__icontains=search) | queryset.filter(store_name__icontains=search)
        if status_filter is not None:
            try:
                queryset = queryset.filter(status=int(status_filter))
            except ValueError:
                pass
        return queryset.order_by('-created_at')
    
    def perform_create(self, serializer):
        super().perform_create(serializer)
        merchant = serializer.instance
        AdminOperationLog.log(
            self.request,
            AdminOperationLog.ActionType.CREATE,
            'Merchant',
            str(merchant.id),
            merchant.store_name or merchant.username,
            {'username': merchant.username, 'phone': merchant.phone}
        )
    
    def perform_update(self, serializer):
        super().perform_update(serializer)
        merchant = serializer.instance
        AdminOperationLog.log(
            self.request,
            AdminOperationLog.ActionType.UPDATE,
            'Merchant',
            str(merchant.id),
            merchant.store_name or merchant.username,
        )
    
    def perform_destroy(self, instance):
        AdminOperationLog.log(
            self.request,
            AdminOperationLog.ActionType.DELETE,
            'Merchant',
            str(instance.id),
            instance.store_name or instance.username,
        )
        super().perform_destroy(instance)
    
    @action(detail=True, methods=['patch'], url_path='quota')
    def adjust_quota(self, request, pk=None):
        """调整商家配额"""
        merchant = self.get_object()
        serializer = QuotaAdjustSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        new_quota = serializer.validated_data['quota_total']
        reason = serializer.validated_data.get('reason', '')
        
        # 记录历史
        QuotaHistory.objects.create(
            merchant_id=merchant.id,
            change_type='adjust',
            old_total=merchant.quota_total,
            new_total=new_quota,
            old_used=merchant.quota_used,
            new_used=merchant.quota_used,
            reason=reason,
            operator_id=request.user.id,
            operator_name=request.user.username,
        )
        
        # 更新配额
        merchant.quota_total = new_quota
        merchant.save(update_fields=['quota_total'])
        
        # 记录操作日志
        AdminOperationLog.log(
            request,
            AdminOperationLog.ActionType.QUOTA_ADJUST,
            'Merchant',
            str(merchant.id),
            merchant.store_name or merchant.username,
            {'old_quota': merchant.quota_total, 'new_quota': new_quota, 'reason': reason}
        )
        
        return Response({
            'id': merchant.id,
            'quota_total': merchant.quota_total,
            'quota_used': merchant.quota_used,
            'quota_remaining': merchant.quota_remaining,
        })
    
    @action(detail=True, methods=['post'], url_path='reset-quota')
    def reset_quota(self, request, pk=None):
        """重置商家配额"""
        merchant = self.get_object()
        serializer = QuotaResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        reason = serializer.validated_data.get('reason', '管理员手动重置')
        
        # 记录历史
        QuotaHistory.objects.create(
            merchant_id=merchant.id,
            change_type='reset',
            old_total=merchant.quota_total,
            new_total=merchant.quota_total,
            old_used=merchant.quota_used,
            new_used=0,
            reason=reason,
            operator_id=request.user.id,
            operator_name=request.user.username,
        )
        
        # 重置配额
        merchant.reset_quota()
        merchant.save(update_fields=['quota_used', 'quota_reset_at'])
        
        # 记录操作日志
        AdminOperationLog.log(
            request,
            AdminOperationLog.ActionType.QUOTA_RESET,
            'Merchant',
            str(merchant.id),
            merchant.store_name or merchant.username,
            {'reason': reason}
        )
        
        return Response({
            'id': merchant.id,
            'quota_total': merchant.quota_total,
            'quota_used': merchant.quota_used,
            'quota_remaining': merchant.quota_remaining,
            'quota_reset_at': merchant.quota_reset_at,
        })
    
    @action(detail=True, methods=['get'], url_path='quota-history')
    def quota_history(self, request, pk=None):
        """获取商家配额变更历史"""
        merchant = self.get_object()
        days = int(request.query_params.get('days', 30))
        since = timezone.now() - timedelta(days=days)
        
        history = QuotaHistory.objects.filter(
            merchant_id=merchant.id,
            created_at__gte=since
        ).order_by('-created_at')
        
        serializer = QuotaHistorySerializer(history, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['patch'], url_path='status')
    def change_status(self, request, pk=None):
        """更改商家状态"""
        merchant = self.get_object()
        new_status = request.data.get('status')
        
        if new_status not in [0, 1, 2]:
            return Response({'message': '无效的状态值'}, status=status.HTTP_400_BAD_REQUEST)
        
        old_status = merchant.status
        merchant.status = new_status
        merchant.save(update_fields=['status'])
        
        # 记录操作日志
        AdminOperationLog.log(
            request,
            AdminOperationLog.ActionType.STATUS_CHANGE,
            'Merchant',
            str(merchant.id),
            merchant.store_name or merchant.username,
            {'old_status': old_status, 'new_status': new_status}
        )
        
        return Response({
            'id': merchant.id,
            'status': merchant.status,
            'status_text': merchant.get_status_display(),
        })


class TryOnRecordAdminViewSet(viewsets.ModelViewSet):
    """试穿记录管理 - Admin
    
    - 超级管理员：查看所有试穿记录
    - 普通管理员（商家）：仅查看自己的试穿记录
    """
    permission_classes = [IsAdminUser]
    queryset = TryOnRecord.objects.all()
    
    def get_serializer_class(self):
        from apps.tryon.serializers import TryOnRecordSerializer
        return TryOnRecordSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # 数据隔离：非超管只能查看自己的数据
        if not self.request.user.is_superuser:
            queryset = queryset.filter(merchant_id=self.request.user.id)
        
        # 筛选参数
        merchant_id = self.request.query_params.get('merchant_id')
        status_filter = self.request.query_params.get('status')
        
        # 超管可以按 merchant_id 筛选
        if self.request.user.is_superuser and merchant_id:
            queryset = queryset.filter(merchant_id=merchant_id)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        return queryset.order_by('-created_at')


class ClothingAdminViewSet(viewsets.ModelViewSet):
    """服装库管理 - Admin (使用 wardrobe.Clothing 模型)
    
    - 超级管理员：查看所有服装
    - 普通管理员（商家）：仅查看和管理自己的服装
    """
    permission_classes = [IsAdminUser]
    
    def get_queryset(self):
        from apps.wardrobe.models import Clothing
        queryset = Clothing.objects.filter(is_deleted=False)
        
        # 数据隔离：非超管只能查看自己的服装
        if not self.request.user.is_superuser:
            queryset = queryset.filter(merchant_id=self.request.user.id)
        
        # 筛选参数
        name = self.request.query_params.get('name')
        category = self.request.query_params.get('category')
        merchant_id = self.request.query_params.get('merchant_id')
        is_active = self.request.query_params.get('is_active')
        
        if name:
            queryset = queryset.filter(name__icontains=name)
        if category:
            queryset = queryset.filter(category=category)
        # 超管可以按 merchant_id 筛选
        if self.request.user.is_superuser and merchant_id:
            queryset = queryset.filter(merchant_id=merchant_id)
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active == 'true')
        return queryset.order_by('-created_at')
    
    def get_serializer_class(self):
        from apps.wardrobe.serializers import ClothingDetailSerializer
        return ClothingDetailSerializer
    
    def perform_destroy(self, instance):
        """软删除"""
        instance.is_deleted = True
        instance.deleted_at = timezone.now()
        instance.save()
    
    @action(detail=False, methods=['post'])
    def upload(self, request):
        """上传服装图片 (Admin)
        
        - 超级管理员：可以为任意商家上传服装
        - 普通管理员（商家）：只能为自己上传服装
        """
        from apps.wardrobe.models import Clothing
        from apps.wardrobe.serializers import ClothingUploadSerializer, ClothingSerializer
        from apps.common.services.oss_service import oss_service
        import os
        
        serializer = ClothingUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        image = serializer.validated_data['image']
        name = serializer.validated_data['name']
        category = serializer.validated_data['category']
        subcategory = serializer.validated_data['subcategory']
        color = serializer.validated_data.get('color', '#000000')
        
        # 数据隔离：非超管只能上传自己的服装
        if request.user.is_superuser:
            merchant_id = request.data.get('merchant_id', request.user.id)
        else:
            merchant_id = request.user.id  # 商家只能上传自己的服装
        
        # 生成文件名
        ext = os.path.splitext(image.name)[1]
        filename = f"clothing{ext}"
        
        # 上传到 OSS (自动 MD5 去重，自动记录到 FileUploadRecord)
        oss_key, image_url, is_duplicate, file_md5 = oss_service.upload_file(
            file_obj=image,
            filename=filename,
            folder='clothing',
            tenant_id=str(request.user.uuid),
            content_type=image.content_type or 'image/jpeg',
            file_category='clothing',
            skip_duplicate=True,
            ref_type='Clothing',
            source='admin_upload'
        )
        image_thumb_url = image_url  # TODO: 生成缩略图
        file_hash = file_md5
        
        # 创建服装记录
        clothing = Clothing.objects.create(
            merchant_id=merchant_id,
            name=name,
            category=category,
            subcategory=subcategory,
            color=color,
            image_url=image_url,
            image_thumb_url=image_thumb_url,
            source=Clothing.Source.WARDROBE,
            file_hash=file_hash
        )
        
        # 记录操作日志
        AdminOperationLog.log(
            request,
            AdminOperationLog.ActionType.CREATE,
            'Clothing',
            str(clothing.id),
            clothing.name,
            {'category': category, 'merchant_id': merchant_id}
        )
        
        return Response(ClothingSerializer(clothing).data, status=status.HTTP_201_CREATED)


class FileUploadAdminViewSet(viewsets.ModelViewSet):
    """文件管理 - Admin (支持批量操作)"""
    permission_classes = [IsAdminUser]
    queryset = FileUploadRecord.objects.all()
    
    def get_serializer_class(self):
        from apps.common.serializers import FileUploadRecordSerializer, FileBatchActionSerializer
        if self.action == 'batch_action':
            return FileBatchActionSerializer
        return FileUploadRecordSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # 过滤参数
        storage_type = self.request.query_params.get('storage_type')
        file_category = self.request.query_params.get('file_category')
        tenant_id = self.request.query_params.get('tenant_id')
        folder = self.request.query_params.get('folder')
        is_deleted = self.request.query_params.get('is_deleted')
        search = self.request.query_params.get('search')
        
        if storage_type:
            queryset = queryset.filter(storage_type=storage_type)
        if file_category:
            queryset = queryset.filter(file_category=file_category)
        if tenant_id:
            queryset = queryset.filter(tenant_id=tenant_id)
        if folder:
            queryset = queryset.filter(folder=folder)
        if is_deleted is not None:
            queryset = queryset.filter(is_deleted=is_deleted == 'true')
        if search:
            queryset = queryset.filter(
                models.Q(storage_key__icontains=search) |
                models.Q(md5_hash__icontains=search) |
                models.Q(tenant_id__icontains=search)
            )
        
        return queryset.order_by('-created_at')
    
    @action(methods=['post'], detail=False, url_path='batch-action')
    def batch_action(self, request):
        """
        批量操作文件
        
        请求体:
        {
            "ids": [1, 2, 3],
            "action": "soft_delete" | "restore" | "hard_delete"
        }
        """
        from apps.common.serializers import FileBatchActionSerializer
        from apps.common.services.storage_service import storage_service
        
        serializer = FileBatchActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        ids = serializer.validated_data['ids']
        action_type = serializer.validated_data['action']
        
        # 获取记录
        records = FileUploadRecord.objects.filter(id__in=ids)
        if not records.exists():
            return Response({
                'success': False,
                'message': '未找到匹配的文件记录'
            }, status=status.HTTP_404_NOT_FOUND)
        
        actual_ids = list(records.values_list('id', flat=True))
        
        if action_type == 'soft_delete':
            # 软删除：只标记，不删除实际文件
            count = records.update(
                is_deleted=True,
                deleted_at=timezone.now()
            )
            return Response({
                'success': True,
                'message': f'已软删除 {count} 个文件',
                'affected_ids': actual_ids,
                'action': 'soft_delete'
            })
        
        elif action_type == 'restore':
            # 恢复软删除
            count = records.update(
                is_deleted=False,
                deleted_at=None
            )
            return Response({
                'success': True,
                'message': f'已恢复 {count} 个文件',
                'affected_ids': actual_ids,
                'action': 'restore'
            })
        
        elif action_type == 'hard_delete':
            # 永久删除：删除实际文件 + 数据库记录
            files_to_delete = list(records.values('id', 'storage_key', 'storage_type'))
            
            # 批量删除存储文件
            delete_result = storage_service.delete_files(files_to_delete)
            
            # 删除数据库记录
            deleted_count, _ = records.delete()
            
            return Response({
                'success': True,
                'message': f'已永久删除 {deleted_count} 个文件（存储删除: {delete_result["deleted"]}, 失败: {delete_result["failed"]}）',
                'affected_ids': actual_ids,
                'action': 'hard_delete',
                'storage_result': {
                    'deleted': delete_result['deleted'],
                    'failed': delete_result['failed']
                }
            })
        
        return Response({
            'success': False,
            'message': f'未知操作类型: {action_type}'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(methods=['post'], detail=False, url_path='cleanup-deleted')
    def cleanup_deleted(self, request):
        """
        清理已软删除的文件（永久删除所有 is_deleted=True 的记录）
        
        可选参数:
        - days: 清理多少天前软删除的文件，默认 7 天
        """
        from apps.common.services.storage_service import storage_service
        
        days = int(request.query_params.get('days', 7))
        cutoff = timezone.now() - timezone.timedelta(days=days)
        
        # 获取要清理的记录
        records = FileUploadRecord.objects.filter(
            is_deleted=True,
            deleted_at__lt=cutoff
        )
        
        if not records.exists():
            return Response({
                'success': True,
                'message': '没有需要清理的文件',
                'deleted_count': 0
            })
        
        # 收集文件信息
        files_to_delete = list(records.values('id', 'storage_key', 'storage_type'))
        actual_ids = list(records.values_list('id', flat=True))
        
        # 批量删除存储文件
        delete_result = storage_service.delete_files(files_to_delete)
        
        # 删除数据库记录
        deleted_count, _ = records.delete()
        
        return Response({
            'success': True,
            'message': f'已清理 {deleted_count} 个软删除文件',
            'deleted_count': deleted_count,
            'affected_ids': actual_ids,
            'storage_result': {
                'deleted': delete_result['deleted'],
                'failed': delete_result['failed']
            }
        })
    
    @action(methods=['get'], detail=False, url_path='stats')
    def stats(self, request):
        """获取文件统计信息"""
        from django.db.models import Sum, Count
        
        # 总体统计
        total_stats = FileUploadRecord.objects.aggregate(
            total_files=Count('id'),
            total_size=Sum('file_size'),
            deleted_files=Count('id', filter=models.Q(is_deleted=True)),
            deleted_size=Sum('file_size', filter=models.Q(is_deleted=True))
        )
        
        # 按存储类型统计
        by_storage = FileUploadRecord.objects.values('storage_type').annotate(
            count=Count('id'),
            size=Sum('file_size')
        )
        
        # 按文件类型统计
        by_category = FileUploadRecord.objects.values('file_category').annotate(
            count=Count('id'),
            size=Sum('file_size')
        )
        
        return Response({
            'total_files': total_stats['total_files'] or 0,
            'total_size': total_stats['total_size'] or 0,
            'deleted_files': total_stats['deleted_files'] or 0,
            'deleted_size': total_stats['deleted_size'] or 0,
            'by_storage': list(by_storage),
            'by_category': list(by_category)
        })


class AdminUserViewSet(viewsets.ModelViewSet):
    """管理员用户管理"""
    permission_classes = [IsAdminUser]
    queryset = Merchant.objects.filter(is_staff=True)
    lookup_field = 'id'
    
    def get_serializer_class(self):
        if self.action == 'create':
            return AdminUserCreateSerializer
        return AdminUserUpdateSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(username__icontains=search)
        return queryset.order_by('-created_at')
    
    def list(self, request):
        """获取管理员列表"""
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        if page is not None:
            data = [{
                'id': m.id,
                'username': m.username,
                'phone': m.phone,
                'store_name': m.store_name,
                'is_superuser': m.is_superuser,
                'is_active': m.is_active,
                'last_login_at': m.last_login_at,
                'created_at': m.created_at,
            } for m in page]
            return self.get_paginated_response(data)
        
        data = [{
            'id': m.id,
            'username': m.username,
            'phone': m.phone,
            'store_name': m.store_name,
            'is_superuser': m.is_superuser,
            'is_active': m.is_active,
            'last_login_at': m.last_login_at,
            'created_at': m.created_at,
        } for m in queryset]
        return Response(data)
    
    def create(self, request):
        """创建管理员"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        data = serializer.validated_data
        
        # 检查用户名是否已存在
        if Merchant.objects.filter(username=data['username']).exists():
            return Response({'message': '用户名已存在'}, status=status.HTTP_400_BAD_REQUEST)
        
        # 创建管理员
        merchant = Merchant.objects.create_superuser(
            username=data['username'],
            phone=data['phone'],
            password=data['password'],
            store_name=data.get('store_name', ''),
        )
        if not data.get('is_superuser', False):
            merchant.is_superuser = False
            merchant.save(update_fields=['is_superuser'])
        
        # 记录操作日志
        AdminOperationLog.log(
            request,
            AdminOperationLog.ActionType.CREATE,
            'AdminUser',
            str(merchant.id),
            merchant.username,
            {'is_superuser': merchant.is_superuser}
        )
        
        return Response({
            'id': merchant.id,
            'username': merchant.username,
            'phone': merchant.phone,
            'is_superuser': merchant.is_superuser,
        }, status=status.HTTP_201_CREATED)
    
    def partial_update(self, request, *args, **kwargs):
        """更新管理员"""
        instance = self.get_object()
        serializer = self.get_serializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        
        data = serializer.validated_data
        
        if 'password' in data:
            instance.set_password(data['password'])
            del data['password']
        
        for key, value in data.items():
            setattr(instance, key, value)
        
        instance.save()
        
        # 记录操作日志
        AdminOperationLog.log(
            request,
            AdminOperationLog.ActionType.UPDATE,
            'AdminUser',
            str(instance.id),
            instance.username,
            {'updated_fields': list(data.keys())}
        )
        
        return Response({
            'id': instance.id,
            'username': instance.username,
            'phone': instance.phone,
            'is_superuser': instance.is_superuser,
            'is_active': instance.is_active,
        })
    
    def destroy(self, request, *args, **kwargs):
        """删除管理员"""
        instance = self.get_object()
        
        # 不能删除自己
        if instance.id == request.user.id:
            return Response({'message': '不能删除自己的账号'}, status=status.HTTP_400_BAD_REQUEST)
        
        # 不能删除超级管理员
        if instance.is_superuser and not request.user.is_superuser:
            return Response({'message': '无权删除超级管理员'}, status=status.HTTP_403_FORBIDDEN)
        
        AdminOperationLog.log(
            request,
            AdminOperationLog.ActionType.DELETE,
            'AdminUser',
            str(instance.id),
            instance.username,
        )
        
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class OperationLogViewSet(viewsets.ReadOnlyModelViewSet):
    """操作日志管理"""
    permission_classes = [IsAdminUser]
    queryset = AdminOperationLog.objects.all()
    serializer_class = AdminOperationLogSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        admin_id = self.request.query_params.get('admin_id')
        action = self.request.query_params.get('action')
        target_type = self.request.query_params.get('target_type')
        days = self.request.query_params.get('days', '7')
        
        if admin_id:
            queryset = queryset.filter(admin_id=admin_id)
        if action:
            queryset = queryset.filter(action=action)
        if target_type:
            queryset = queryset.filter(target_type=target_type)
        
        try:
            days = int(days)
            since = timezone.now() - timedelta(days=days)
            queryset = queryset.filter(created_at__gte=since)
        except ValueError:
            pass
        
        return queryset


class SystemConfigViewSet(viewsets.ModelViewSet):
    """系统配置管理"""
    permission_classes = [IsAdminUser]
    queryset = SystemConfig.objects.all()
    serializer_class = SystemConfigSerializer
    lookup_field = 'key'
    
    def get_queryset(self):
        queryset = super().get_queryset()
        is_public = self.request.query_params.get('is_public')
        if is_public is not None:
            queryset = queryset.filter(is_public=is_public.lower() == 'true')
        return queryset.order_by('key')
    
    @action(detail=False, methods=['get'], url_path='grouped')
    def grouped(self, request):
        """获取分组配置"""
        configs = self.get_queryset()
        
        # 定义分组
        groups = {
            'basic': ['site_name', 'admin_email', 'site_description'],
            'ai': ['ai_engine', 'ai_timeout', 'ai_retry_count', 'ai_api_key'],
            'oss': ['oss_enabled', 'oss_type', 'oss_bucket', 'oss_endpoint', 'oss_access_key', 'oss_secret_key'],
            'storage': ['storage_type', 'storage_max_size_mb', 'storage_cleanup_days'],
            'quota': ['default_quota', 'quota_reset_day'],
        }
        
        result = {}
        for group_name, keys in groups.items():
            result[group_name] = []
            for key in keys:
                try:
                    config = configs.get(key=key)
                    result[group_name].append(SystemConfigSerializer(config).data)
                except SystemConfig.DoesNotExist:
                    result[group_name].append({
                        'key': key,
                        'value': '',
                        'value_type': 'string',
                        'description': '',
                        'is_public': False,
                    })
        
        # 其他配置
        known_keys = set(k for keys in groups.values() for k in keys)
        other_configs = configs.exclude(key__in=known_keys)
        result['other'] = SystemConfigSerializer(other_configs, many=True).data
        
        return Response(result)
    
    @action(detail=False, methods=['post'], url_path='batch')
    def batch_update(self, request):
        """批量更新配置"""
        configs = request.data.get('configs', {})
        
        updated = []
        for key, value in configs.items():
            value_type = request.data.get('value_types', {}).get(key, 'string')
            description = request.data.get('descriptions', {}).get(key, '')
            is_public = request.data.get('is_public', {}).get(key, False)
            
            config, created = SystemConfig.set_value(
                key=key,
                value=value,
                value_type=value_type,
                description=description,
                is_public=is_public,
            )
            updated.append(key)
        
        # 记录操作日志
        AdminOperationLog.log(
            request,
            AdminOperationLog.ActionType.UPDATE,
            'SystemConfig',
            '',
            '批量更新配置',
            {'updated_keys': updated}
        )
        
        return Response({'updated': updated})


# ==================== System Info ====================

@api_view(['GET'])
@permission_classes([AllowAny])
def system_info(request):
    """获取系统信息"""
    import sys
    import django
    
    return Response({
        'version': '1.0.0',
        'python_version': f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}',
        'django_version': django.get_version(),
        'database': settings.DATABASES['default']['ENGINE'].split('.')[-1],
        'cache': getattr(settings, 'CACHES', {}).get('default', {}).get('BACKEND', 'Unknown').split('.')[-1],
        'storage': settings.STORAGE_TYPE if hasattr(settings, 'STORAGE_TYPE') else 'Local',
        'ai_engine': 'SeedDance (ByteDance)',
    })


@api_view(['GET'])
def system_stats(request):
    """获取系统统计
    
    - 超级管理员：查看全局统计数据
    - 普通管理员（商家）：仅查看自己账号的数据
    """
    # 权限检查
    if not request.user or not request.user.is_authenticated:
        return Response({'message': '未登录'}, status=status.HTTP_401_UNAUTHORIZED)
    
    if not request.user.is_staff:
        return Response({'message': '无管理员权限'}, status=status.HTTP_403_FORBIDDEN)
    
    today = timezone.now().date()
    
    from apps.wardrobe.models import Clothing
    from django.db.models.functions import TruncDate
    
    # 判断是否为超级管理员
    is_superuser = request.user.is_superuser
    
    if is_superuser:
        # === 超级管理员：全局统计 ===
        total_merchants = Merchant.objects.count()
        active_merchants = Merchant.objects.filter(status=1).count()
        total_tryon_records = TryOnRecord.objects.count()
        total_clothing = Clothing.objects.filter(is_deleted=False).count()
        
        # 今日统计
        today_records = TryOnRecord.objects.filter(created_at__date=today)
        
        # 存储统计
        storage_stats = FileUploadRecord.objects.aggregate(
            total_size=Sum('file_size'),
            total_count=Count('id')
        )
        total_storage_bytes = storage_stats['total_size'] or 0
        total_files = storage_stats['total_count'] or 0
        
        # 试穿趋势（最近7天）
        seven_days_ago = today - timedelta(days=7)
        trend_data = TryOnRecord.objects.filter(
            created_at__date__gte=seven_days_ago
        ).annotate(
            date=TruncDate('created_at')
        ).values('date').annotate(
            count=Count('id'),
            success_count=Count('id', filter=Q(status='completed'))
        ).order_by('date')
        
        tryon_trend = [
            {
                'date': item['date'].isoformat() if item['date'] else '',
                'count': item['count'],
                'success_count': item['success_count']
            }
            for item in trend_data
        ]
        
        # AI 引擎统计
        engine_data = TryOnRecord.objects.filter(
            ai_engine__isnull=False
        ).exclude(
            ai_engine=''
        ).values('ai_engine').annotate(
            count=Count('id'),
            avg_time=Avg('processing_time')
        ).order_by('-count')[:5]
        
        engine_stats = [
            {
                'engine': item['ai_engine'],
                'count': item['count'],
                'avg_time': item['avg_time'] or 0
            }
            for item in engine_data
        ]
    else:
        # === 普通管理员（商家）：仅自己的数据 ===
        merchant_id = request.user.id
        
        # 该商家的统计
        total_merchants = 1  # 自己
        active_merchants = 1 if request.user.status == 1 else 0
        total_tryon_records = TryOnRecord.objects.filter(merchant_id=merchant_id).count()
        total_clothing = Clothing.objects.filter(
            merchant_id=merchant_id,
            is_deleted=False
        ).count()
        
        # 今日统计（仅该商家）
        today_records = TryOnRecord.objects.filter(
            merchant_id=merchant_id,
            created_at__date=today
        )
        
        # 存储统计（仅该商家）
        storage_stats = FileUploadRecord.objects.filter(
            tenant_id=str(request.user.uuid)
        ).aggregate(
            total_size=Sum('file_size'),
            total_count=Count('id')
        )
        total_storage_bytes = storage_stats['total_size'] or 0
        total_files = storage_stats['total_count'] or 0
        
        # 试穿趋势（最近7天，仅该商家）
        seven_days_ago = today - timedelta(days=7)
        trend_data = TryOnRecord.objects.filter(
            merchant_id=merchant_id,
            created_at__date__gte=seven_days_ago
        ).annotate(
            date=TruncDate('created_at')
        ).values('date').annotate(
            count=Count('id'),
            success_count=Count('id', filter=Q(status='completed'))
        ).order_by('date')
        
        tryon_trend = [
            {
                'date': item['date'].isoformat() if item['date'] else '',
                'count': item['count'],
                'success_count': item['success_count']
            }
            for item in trend_data
        ]
        
        # AI 引擎统计（仅该商家）
        engine_data = TryOnRecord.objects.filter(
            merchant_id=merchant_id,
            ai_engine__isnull=False
        ).exclude(
            ai_engine=''
        ).values('ai_engine').annotate(
            count=Count('id'),
            avg_time=Avg('processing_time')
        ).order_by('-count')[:5]
        
        engine_stats = [
            {
                'engine': item['ai_engine'],
                'count': item['count'],
                'avg_time': item['avg_time'] or 0
            }
            for item in engine_data
        ]
    
    # 今日统计（通用计算）
    today_tryon_count = today_records.count()
    today_success_count = today_records.filter(status='completed').count()
    today_success_rate = today_success_count / today_tryon_count if today_tryon_count > 0 else 0
    
    # 计算今日平均处理时间
    today_avg_time = today_records.filter(
        status='completed',
        processing_time__isnull=False
    ).aggregate(avg=Avg('processing_time'))['avg'] or 0
    
    # 额度统计
    if is_superuser:
        quota_total = 0
        quota_used = 0
        quota_remaining = 0
    else:
        quota_total = request.user.quota_total
        quota_used = request.user.quota_used
        quota_remaining = request.user.quota_remaining
    
    return Response({
        # 今日统计
        'today_tryon_count': today_tryon_count,
        'today_success_rate': today_success_rate,
        'today_avg_processing_time': today_avg_time,
        
        # 商家统计
        'total_merchants': total_merchants,
        'active_merchants': active_merchants,
        
        # 试穿记录统计
        'total_tryon_records': total_tryon_records,
        
        # 服装统计
        'total_clothing': total_clothing,
        
        # 存储统计
        'total_storage_bytes': total_storage_bytes,
        'total_files': total_files,
        
        # 额度统计 (商家专用)
        'quota_total': quota_total,
        'quota_used': quota_used,
        'quota_remaining': quota_remaining,
        
        # 趋势数据
        'tryon_trend': tryon_trend,
        
        # 引擎统计
        'engine_stats': engine_stats,
        
        # 是否为超级管理员（前端可根据此调整 UI）
        'is_superuser': is_superuser,
    })


# ==================== Router ====================

router = routers.DefaultRouter()
router.register(r'merchants', MerchantAdminViewSet, basename='admin-merchants')
router.register(r'tryon-records', TryOnRecordAdminViewSet, basename='admin-tryon-records')
router.register(r'clothing', ClothingAdminViewSet, basename='admin-clothing')
router.register(r'files', FileUploadAdminViewSet, basename='admin-files')
router.register(r'admin-users', AdminUserViewSet, basename='admin-users')
router.register(r'operation-logs', OperationLogViewSet, basename='operation-logs')
router.register(r'config', SystemConfigViewSet, basename='system-config')
