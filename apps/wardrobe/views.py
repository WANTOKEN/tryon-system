"""
衣橱视图
"""
from django.utils import timezone
from django.db.models import Count
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.common.utils.response import ApiResponse
from apps.common.utils.pagination import CustomPageNumberPagination
from .models import Clothing, PresetClothing
from .serializers import (
    ClothingSerializer, ClothingUploadSerializer,
    PresetClothingSerializer
)


# 分类配置
CATEGORIES_CONFIG = {
    'tops': {'name_zh': '上装', 'name_tw': '上裝', 'name_en': 'Tops',
             'subcategories': ['t-shirt', 'shirt', 'blouse', 'sweater', 'hoodie']},
    'bottoms': {'name_zh': '下装', 'name_tw': '下裝', 'name_en': 'Bottoms',
                'subcategories': ['jeans', 'pants', 'shorts', 'skirt', 'leggings']},
    'dresses': {'name_zh': '连衣裙', 'name_tw': '連衣裙', 'name_en': 'Dresses',
                'subcategories': ['mini', 'midi', 'maxi', 'casual', 'formal']},
    'outerwear': {'name_zh': '外套', 'name_tw': '外套', 'name_en': 'Outerwear',
                  'subcategories': ['jacket', 'coat', 'blazer', 'cardigan', 'vest']},
    'shoes': {'name_zh': '鞋', 'name_tw': '鞋', 'name_en': 'Shoes',
              'subcategories': ['sneakers', 'heels', 'boots', 'sandals', 'loafers']},
    'accessories': {'name_zh': '配饰', 'name_tw': '配飾', 'name_en': 'Accessories',
                    'subcategories': ['hat', 'scarf', 'bag', 'belt', 'jewelry']},
}

# 二级分类多语言映射
SUBCATEGORY_I18N = {
    # 上装
    't-shirt': {'zh-CN': 'T恤', 'zh-TW': 'T恤', 'en': 'T-Shirts'},
    'shirt': {'zh-CN': '衬衫', 'zh-TW': '襯衫', 'en': 'Shirts'},
    'blouse': {'zh-CN': '女衬衫', 'zh-TW': '女襯衫', 'en': 'Blouses'},
    'sweater': {'zh-CN': '针织衫', 'zh-TW': '針織衫', 'en': 'Sweaters'},
    'hoodie': {'zh-CN': '卫衣', 'zh-TW': '衛衣', 'en': 'Hoodies'},
    # 下装
    'jeans': {'zh-CN': '牛仔裤', 'zh-TW': '牛仔褲', 'en': 'Jeans'},
    'pants': {'zh-CN': '休闲裤', 'zh-TW': '休閒褲', 'en': 'Pants'},
    'shorts': {'zh-CN': '短裤', 'zh-TW': '短褲', 'en': 'Shorts'},
    'skirt': {'zh-CN': '半身裙', 'zh-TW': '半身裙', 'en': 'Skirts'},
    'leggings': {'zh-CN': '打底裤', 'zh-TW': '打底褲', 'en': 'Leggings'},
    # 连衣裙
    'mini': {'zh-CN': '迷你裙', 'zh-TW': '迷你裙', 'en': 'Mini'},
    'midi': {'zh-CN': '中长裙', 'zh-TW': '中長裙', 'en': 'Midi'},
    'maxi': {'zh-CN': '长裙', 'zh-TW': '長裙', 'en': 'Maxi'},
    'casual': {'zh-CN': '休闲裙', 'zh-TW': '休閒裙', 'en': 'Casual'},
    'formal': {'zh-CN': '礼服裙', 'zh-TW': '禮服裙', 'en': 'Formal'},
    # 外套
    'jacket': {'zh-CN': '夹克', 'zh-TW': '夾克', 'en': 'Jackets'},
    'coat': {'zh-CN': '大衣', 'zh-TW': '大衣', 'en': 'Coats'},
    'blazer': {'zh-CN': '西装', 'zh-TW': '西裝', 'en': 'Blazers'},
    'cardigan': {'zh-CN': '开衫', 'zh-TW': '開衫', 'en': 'Cardigans'},
    'vest': {'zh-CN': '马甲', 'zh-TW': '馬甲', 'en': 'Vests'},
    # 鞋
    'sneakers': {'zh-CN': '运动鞋', 'zh-TW': '運動鞋', 'en': 'Sneakers'},
    'heels': {'zh-CN': '高跟鞋', 'zh-TW': '高跟鞋', 'en': 'Heels'},
    'boots': {'zh-CN': '靴子', 'zh-TW': '靴子', 'en': 'Boots'},
    'sandals': {'zh-CN': '凉鞋', 'zh-TW': '涼鞋', 'en': 'Sandals'},
    'loafers': {'zh-CN': '乐福鞋', 'zh-TW': '樂福鞋', 'en': 'Loafers'},
    # 配饰
    'hat': {'zh-CN': '帽子', 'zh-TW': '帽子', 'en': 'Hats'},
    'scarf': {'zh-CN': '围巾', 'zh-TW': '圍巾', 'en': 'Scarves'},
    'bag': {'zh-CN': '包袋', 'zh-TW': '包袋', 'en': 'Bags'},
    'belt': {'zh-CN': '腰带', 'zh-TW': '腰帶', 'en': 'Belts'},
    'jewelry': {'zh-CN': '首饰', 'zh-TW': '首飾', 'en': 'Jewelry'},
}


def get_subcategory_name(subcategory_id: str, lang: str = 'zh-CN') -> str:
    """获取二级分类的本地化名称"""
    i18n = SUBCATEGORY_I18N.get(subcategory_id, {})
    return i18n.get(lang, i18n.get('zh-CN', subcategory_id))


def get_category_name(category_id: str, lang: str = 'zh-CN') -> str:
    """获取分类名称"""
    config = CATEGORIES_CONFIG.get(category_id, {})
    if lang == 'zh-TW':
        return config.get('name_tw', category_id)
    elif lang == 'en':
        return config.get('name_en', category_id)
    return config.get('name_zh', category_id)


def get_language(request) -> str:
    """获取请求语言"""
    accept_language = request.META.get('HTTP_ACCEPT_LANGUAGE', 'zh-CN')
    if 'zh-TW' in accept_language:
        return 'zh-TW'
    elif 'en' in accept_language:
        return 'en'
    return 'zh-CN'


class ClothingListView(APIView):
    """服装列表"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Clothing.objects.filter(
            merchant_id=request.user.id,
            is_active=True,
            is_deleted=False
        )

        # 筛选参数
        category = request.query_params.get('category')
        subcategory = request.query_params.get('subcategory')
        source = request.query_params.get('source')
        is_active = request.query_params.get('is_active', 'true').lower() == 'true'

        if category:
            queryset = queryset.filter(category=category)
        if subcategory:
            queryset = queryset.filter(subcategory=subcategory)
        if source:
            queryset = queryset.filter(source=source)

        queryset = queryset.filter(is_active=is_active)

        # 分页
        paginator = CustomPageNumberPagination()
        page = paginator.paginate_queryset(queryset, request)

        serializer = ClothingSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class ClothingUploadView(APIView):
    """上传服装"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ClothingUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        image = serializer.validated_data['image']
        name = serializer.validated_data['name']
        category = serializer.validated_data['category']
        subcategory = serializer.validated_data['subcategory']
        color = serializer.validated_data.get('color', '#000000')

        # 上传图片到 OSS
        from apps.common.services.oss_service import oss_service
        import os

        # 生成文件名
        ext = os.path.splitext(image.name)[1]
        filename = f"clothing{ext}"

        # 上传到 OSS (自动 MD5 去重)
        oss_key, image_url, is_duplicate = oss_service.upload_file(
            file=image,
            filename=filename,
            folder='clothing',
            user_id=str(request.user.uuid),
            content_type=image.content_type or 'image/jpeg',
            skip_duplicate=True
        )
        image_thumb_url = image_url  # TODO: 生成缩略图
        file_hash = oss_key  # 使用 oss_key 作为文件标识

        # 创建服装记录
        clothing = Clothing.objects.create(
            merchant_id=request.user.id,
            name=name,
            category=category,
            subcategory=subcategory,
            color=color,
            image_url=image_url,
            image_thumb_url=image_thumb_url,
            source=Clothing.Source.WARDROBE,
            file_hash=file_hash
        )

        return ApiResponse.success(ClothingSerializer(clothing).data, message='上传成功')


class ClothingDeleteView(APIView):
    """删除服装"""
    permission_classes = [IsAuthenticated]

    def delete(self, request, uuid):
        try:
            clothing = Clothing.objects.get(uuid=uuid, merchant_id=request.user.id)
        except Clothing.DoesNotExist:
            return ApiResponse.not_found('服装不存在')

        # 预设服装不可删除
        if clothing.source == Clothing.Source.PRESET:
            return ApiResponse.error('预设服装不可删除')

        # 软删除
        clothing.is_deleted = True
        clothing.deleted_at = timezone.now()
        clothing.save(update_fields=['is_deleted', 'deleted_at'])

        return ApiResponse.success(message='已删除')


class CategoriesView(APIView):
    """获取分类配置"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        lang = get_language(request)

        # 获取用户服装数量
        clothing_counts = Clothing.objects.filter(
            merchant_id=request.user.id,
            is_active=True,
            is_deleted=False
        ).values('category', 'subcategory').annotate(count=Count('id'))

        # 构建统计字典
        count_dict = {}
        for item in clothing_counts:
            key = (item['category'], item['subcategory'])
            count_dict[key] = item['count']

        # 构建分类结构
        categories = []
        for cat_id, cat_config in CATEGORIES_CONFIG.items():
            subcategories = []
            for subcat in cat_config['subcategories']:
                count = count_dict.get((cat_id, subcat), 0)
                subcategories.append({
                    'id': subcat,
                    'name': get_subcategory_name(subcat, lang),  # 使用多语言名称
                    'count': count
                })

            categories.append({
                'id': cat_id,
                'name': get_category_name(cat_id, lang),
                'subcategories': subcategories
            })

        return ApiResponse.success(categories)
