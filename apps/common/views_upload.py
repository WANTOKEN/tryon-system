"""
统一文件上传接口
提供统一的文件上传入口，支持多类型文件上传
支持直接关联业务记录，避免孤儿文件问题
"""

import os
import json
import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, serializers
from rest_framework.permissions import IsAuthenticated
from django.core.exceptions import ValidationError as DjangoValidationError

from apps.common.services.storage_service import storage_service

logger = logging.getLogger('upload')


class FileUploadSerializer(serializers.Serializer):
    """文件上传序列化器"""
    file = serializers.FileField(required=True)
    folder = serializers.CharField(max_length=50, required=False, default="uploads")
    category = serializers.CharField(max_length=20, required=False, default="other")
    is_public = serializers.BooleanField(required=False, default=False)
    business_type = serializers.CharField(max_length=20, required=False, default="")
    business_data = serializers.JSONField(required=False, default=dict)

    ALLOWED_CONTENT_TYPES = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/bmp",
        "image/heic",
        "image/heif",
    ]
    
    ALLOWED_BUSINESS_TYPES = ['clothing', 'model', 'avatar', 'custom']
    
    MAX_FILE_SIZE = 30 * 1024 * 1024  # 30MB
    
    ALLOWED_FOLDERS = ['uploads', 'avatars', 'clothing', 'models', 'results', 'temp']
    
    ALLOWED_CATEGORIES = ['avatar', 'clothing', 'result', 'model', 'other']

    def validate_file(self, value):
        """验证文件"""
        # 检查文件是否存在
        if not value:
            raise serializers.ValidationError("请选择要上传的文件")
        
        # 检查文件大小
        if value.size > self.MAX_FILE_SIZE:
            raise serializers.ValidationError(f"文件大小不能超过 {self.MAX_FILE_SIZE // (1024 * 1024)}MB")
        
        # 检查文件类型（MIME类型）
        if value.content_type not in self.ALLOWED_CONTENT_TYPES:
            raise serializers.ValidationError(f"仅支持以下格式: {', '.join(self.ALLOWED_CONTENT_TYPES)}")
        
        # 检查文件扩展名
        ext = os.path.splitext(value.name)[1].lower()
        allowed_extensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.heic', '.heif']
        if ext and ext not in allowed_extensions:
            raise serializers.ValidationError(f"文件扩展名不支持，仅支持: {', '.join(allowed_extensions)}")
        
        # 验证文件内容（确保是有效的图片）
        try:
            from PIL import Image
            image = Image.open(value)
            image.verify()
            # 重置文件指针
            value.seek(0)
        except ImportError:
            pass  # PIL 未安装，跳过内容验证
        except Exception as e:
            raise serializers.ValidationError(f"无效的图片文件: {str(e)}")
        
        return value

    def validate_folder(self, value):
        """验证存储目录"""
        if value and value not in self.ALLOWED_FOLDERS:
            raise serializers.ValidationError(f"无效的存储目录，可选值: {', '.join(self.ALLOWED_FOLDERS)}")
        return value

    def validate_category(self, value):
        """验证文件分类"""
        if value and value not in self.ALLOWED_CATEGORIES:
            raise serializers.ValidationError(f"无效的文件分类，可选值: {', '.join(self.ALLOWED_CATEGORIES)}")
        return value

    def validate_business_type(self, value):
        """验证业务类型"""
        if value and value not in self.ALLOWED_BUSINESS_TYPES:
            raise serializers.ValidationError(f"无效的业务类型，可选值: {', '.join(self.ALLOWED_BUSINESS_TYPES)}")
        return value

    def validate_business_data(self, value):
        """验证业务数据"""
        if value:
            if not isinstance(value, dict):
                raise serializers.ValidationError("business_data 必须是 JSON 对象")
            # 验证业务数据的必要字段
            business_type = self.initial_data.get('business_type', '')
            if business_type == 'clothing':
                if not value.get('name'):
                    raise serializers.ValidationError("服装业务数据必须包含 name 字段")
                if not value.get('category'):
                    raise serializers.ValidationError("服装业务数据必须包含 category 字段")
        return value

    def validate(self, data):
        """综合验证"""
        business_type = data.get('business_type')
        business_data = data.get('business_data')
        
        # 如果指定了业务类型，必须提供对应的业务数据
        if business_type and business_type != 'custom' and not business_data:
            raise serializers.ValidationError({
                'business_data': "指定 business_type 时必须提供 business_data"
            })
        
        # 文件夹和分类的一致性检查
        folder = data.get('folder')
        category = data.get('category')
        if folder == 'avatars' and category != 'avatar':
            logger.warning(f"文件夹与分类不一致: folder={folder}, category={category}")
        
        return data


class UploadView(APIView):
    """
    统一文件上传接口
    
    POST /api/v1/common/upload/
    - 支持上传图片文件
    - 自动生成唯一文件名
    - 支持 MD5 去重
    - 支持直接关联业务记录，避免孤儿文件
    
    请求参数:
    - file: 要上传的文件
    - folder: 存储目录（可选，默认 uploads）
    - category: 文件分类（可选，默认 other）
    - is_public: 是否公开（可选，默认 false）
    - business_type: 业务类型（可选）: clothing/model/avatar/custom
    - business_data: 业务数据（可选，JSON格式）
    
    返回值:
    - success: 是否成功
    - file_id: 文件ID
    - url: 文件访问URL
    - is_duplicate: 是否为重复文件
    - business_id: 业务记录ID（如果创建了）
    - business_type: 业务类型
    - error_code: 错误码（失败时）
    - error_detail: 错误详情（失败时）
    """
    
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        # 1. 验证请求格式
        if not request.FILES:
            return Response({
                'success': False,
                'message': '请提供要上传的文件',
                'error_code': 'NO_FILE_PROVIDED',
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 2. 数据序列化验证
        serializer = FileUploadSerializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except serializers.ValidationError as e:
            logger.error(f"请求参数验证失败: {e.detail}")
            return Response({
                'success': False,
                'message': '请求参数验证失败',
                'error_code': 'VALIDATION_ERROR',
                'error_detail': e.detail,
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            file_obj = serializer.validated_data['file']
            folder = serializer.validated_data['folder']
            file_category = serializer.validated_data['category']
            is_public = serializer.validated_data['is_public']
            business_type = serializer.validated_data.get('business_type', '')
            business_data = serializer.validated_data.get('business_data', {})
            
            # 3. 获取租户ID
            tenant_id = str(getattr(request.user, 'uuid', '')) or str(request.user.id)
            if not tenant_id:
                return Response({
                    'success': False,
                    'message': '无法获取租户ID',
                    'error_code': 'TENANT_ID_MISSING',
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # 4. 生成文件名
            ext = os.path.splitext(file_obj.name)[1]
            filename = f"upload{ext}"
            
            # 5. 上传文件到存储服务
            try:
                storage_key, url, is_duplicate, content_key, file_id = storage_service.upload_file(
                    file_obj=file_obj,
                    filename=filename,
                    folder=folder,
                    tenant_id=tenant_id,
                    content_type=file_obj.content_type or "image/jpeg",
                    file_category=file_category,
                    skip_duplicate=True,
                    is_public=is_public,
                )
            except Exception as storage_error:
                logger.error(f"存储服务上传失败: {storage_error}")
                return Response({
                    'success': False,
                    'message': '文件上传失败，存储服务异常',
                    'error_code': 'STORAGE_ERROR',
                    'error_detail': str(storage_error),
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            # 6. 验证文件记录创建结果
            if not file_id:
                return Response({
                    'success': False,
                    'message': '文件上传失败，无法创建文件记录',
                    'error_code': 'FILE_RECORD_CREATE_FAILED',
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            # 7. 构建成功响应
            result = {
                'success': True,
                'file_id': file_id,
                'url': f'/api/v1/file/{file_id}/',
                'is_duplicate': is_duplicate,
            }
            
            # 8. 如果指定了业务类型，创建关联记录
            if business_type and file_id:
                business_id = self._create_business_record(request, file_id, business_type, business_data)
                if business_id:
                    result['business_id'] = business_id
                    result['business_type'] = business_type
                else:
                    logger.warning(f"业务记录创建失败，但文件已保存 file_id={file_id}")
            
            logger.info(f"文件上传成功: file_id={file_id}, business_type={business_type}")
            return Response(result)
        
        except Exception as e:
            logger.error(f"文件上传失败: {e}", exc_info=True)
            return Response({
                'success': False,
                'message': '文件上传失败',
                'error_code': 'UPLOAD_ERROR',
                'error_detail': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _create_business_record(self, request, file_id, business_type, business_data):
        """根据业务类型创建关联记录"""
        from apps.common.models import FileRecord, ModelPhoto
        from apps.wardrobe.models import Clothing
        
        file_record = FileRecord.objects.filter(id=file_id).first()
        if not file_record:
            logger.error(f"文件记录不存在: {file_id}")
            return None
        
        try:
            if business_type == 'clothing':
                return self._create_clothing_record(request, file_record, business_data)
            elif business_type == 'model':
                return self._create_model_photo_record(request, file_record, business_data)
            elif business_type == 'custom':
                return self._create_custom_record(request, file_record, business_data)
            
        except Exception as e:
            logger.error(f"创建业务记录失败 type={business_type}: {e}")
            return None
        
        return None
    
    def _create_clothing_record(self, request, file_record, business_data):
        """创建服装记录"""
        from apps.wardrobe.models import Clothing
        
        merchant_id = request.data.get('merchant_id', request.user.id)
        if not request.user.is_superuser:
            merchant_id = request.user.id
        
        clothing = Clothing.objects.create(
            merchant_id=merchant_id,
            name=business_data.get('name', '未命名服装'),
            category=business_data.get('category', 'other'),
            subcategory=business_data.get('subcategory', ''),
            color=business_data.get('color', '#000000'),
            price=business_data.get('price', 0.00),
            sizes=business_data.get('sizes', []),
            file=file_record,
            source=Clothing.Source.WARDROBE,
        )
        
        logger.info(f"创建服装记录成功: {clothing.id}")
        return str(clothing.id)
    
    def _create_model_photo_record(self, request, file_record, business_data):
        """创建模特照片记录"""
        model_photo = ModelPhoto.objects.create(
            file=file_record,
            sort_order=business_data.get('sort_order', 0),
            is_active=True,
        )
        
        logger.info(f"创建模特照片记录成功: {model_photo.id}")
        return str(model_photo.id)
    
    def _create_custom_record(self, request, file_record, business_data):
        """创建自定义记录（仅保存文件，不创建业务记录）"""
        logger.info(f"自定义文件上传成功: {file_record.id}")
        return str(file_record.id)