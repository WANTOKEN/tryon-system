"""
衣橱视图 - 重构版
"""

from io import BytesIO
from django.utils import timezone
from django.db.models import Count
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.common.utils.response import ApiResponse
from apps.common.utils.pagination import CustomPageNumberPagination
from .models import Clothing
from .serializers import ClothingSerializer, ClothingUploadSerializer

# 分类配置 - 与前端保持一致
CATEGORIES_CONFIG = {
    "tops": {"name_zh": "上装", "name_en": "Upper", "name_tw": "上裝"},
    "bottoms": {"name_zh": "下装", "name_en": "Lower", "name_tw": "下裝"},
    "dresses": {"name_zh": "连衣裙", "name_en": "Dress", "name_tw": "連衣裙"},
    "outerwear": {"name_zh": "外套", "name_en": "Outerwear", "name_tw": "外套"},
    "shoes": {"name_zh": "鞋履", "name_en": "Shoes", "name_tw": "鞋履"},
    "accessories": {"name_zh": "配饰", "name_en": "Accessories", "name_tw": "配飾"},
}

SUBCATEGORY_I18N = {
    # 上装
    "t-shirt": {"zh-CN": "T恤", "zh-TW": "T恤", "en": "T-shirts"},
    "shirt": {"zh-CN": "衬衫", "zh-TW": "襯衫", "en": "Shirts"},
    "blouse": {"zh-CN": "雪纺衫", "zh-TW": "雪紡衫", "en": "Blouses"},
    "sweater": {"zh-CN": "毛衣", "zh-TW": "毛衣", "en": "Sweaters"},
    "hoodie": {"zh-CN": "卫衣", "zh-TW": "衛衣", "en": "Hoodies"},
    # 下装
    "pants": {"zh-CN": "长裤", "zh-TW": "長褲", "en": "Pants"},
    "shorts": {"zh-CN": "短裤", "zh-TW": "短褲", "en": "Shorts"},
    "skirt": {"zh-CN": "半身裙", "zh-TW": "半身裙", "en": "Skirts"},
    "jeans": {"zh-CN": "牛仔裤", "zh-TW": "牛仔褲", "en": "Jeans"},
    # 连衣裙
    "casual-dress": {"zh-CN": "休闲连衣裙", "zh-TW": "休閒連衣裙", "en": "Casual Dresses"},
    "formal-dress": {"zh-CN": "正式连衣裙", "zh-TW": "正式連衣裙", "en": "Formal Dresses"},
    "maxi-dress": {"zh-CN": "长裙", "zh-TW": "長裙", "en": "Maxi Dresses"},
    # 外套
    "coat": {"zh-CN": "大衣", "zh-TW": "大衣", "en": "Coats"},
    "jacket": {"zh-CN": "夹克", "zh-TW": "夾克", "en": "Jackets"},
    "blazer": {"zh-CN": "西装外套", "zh-TW": "西裝外套", "en": "Blazers"},
    "cardigan": {"zh-CN": "开衫", "zh-TW": "開衫", "en": "Cardigans"},
    # 鞋履
    "sneakers": {"zh-CN": "运动鞋", "zh-TW": "運動鞋", "en": "Sneakers"},
    "heels": {"zh-CN": "高跟鞋", "zh-TW": "高跟鞋", "en": "Heels"},
    "boots": {"zh-CN": "靴子", "zh-TW": "靴子", "en": "Boots"},
    "sandals": {"zh-CN": "凉鞋", "zh-TW": "涼鞋", "en": "Sandals"},
    "loafers": {"zh-CN": "乐福鞋", "zh-TW": "樂福鞋", "en": "Loafers"},
    # 配饰
    "hat": {"zh-CN": "帽子", "zh-TW": "帽子", "en": "Hats"},
    "scarf": {"zh-CN": "围巾", "zh-TW": "圍巾", "en": "Scarves"},
    "bag": {"zh-CN": "包袋", "zh-TW": "包袋", "en": "Bags"},
    "belt": {"zh-CN": "腰带", "zh-TW": "腰帶", "en": "Belts"},
    "jewelry": {"zh-CN": "首饰", "zh-TW": "首飾", "en": "Jewelry"},
}


def get_subcategory_name(subcategory_id: str, lang: str = "zh-CN") -> str:
    """获取二级分类的本地化名称"""
    i18n = SUBCATEGORY_I18N.get(subcategory_id, {})
    return i18n.get(lang, i18n.get("zh-CN", subcategory_id))


def get_category_name(category_id: str, lang: str = "zh-CN") -> str:
    """获取分类名称"""
    config = CATEGORIES_CONFIG.get(category_id, {})
    if lang == "zh-TW":
        return config.get("name_tw", category_id)
    elif lang == "en":
        return config.get("name_en", category_id)
    return config.get("name_zh", category_id)


def get_language(request) -> str:
    """获取请求语言"""
    accept_language = request.META.get("HTTP_ACCEPT_LANGUAGE", "zh-CN")
    if "zh-TW" in accept_language:
        return "zh-TW"
    elif "en" in accept_language:
        return "en"
    return "zh-CN"


class ClothingListView(APIView):
    """服装列表"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Clothing.objects.filter(merchant_id=request.user.id, is_active=True, is_deleted=False)

        # 筛选参数
        category = request.query_params.get("category")
        subcategory = request.query_params.get("subcategory")
        source = request.query_params.get("source")
        is_active = request.query_params.get("is_active", "true").lower() == "true"

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
        if not serializer.is_valid():
            return ApiResponse.error(serializer.errors)

        data = serializer.validated_data
        image = data.get("image")
        name = data.get("name", "未命名服装")
        category = data.get("category", "upper")
        subcategory = data.get("subcategory", "t-shirt")
        color = data.get("color", "#000000")
        price = data.get("price", 0)
        sizes = data.get("sizes", [])

        if not image:
            return ApiResponse.error("请上传服装图片")

        # 读取图片文件
        image_file = BytesIO(image.read())
        filename = image.name

        # 获取存储服务
        from apps.common.services.storage_service import storage_service

        # 上传到存储服务
        storage_key, image_url, is_duplicate, content_key, file_id = storage_service.upload_file(
            file_obj=image_file,
            filename=filename,
            folder="clothing",
            tenant_id=str(request.user.uuid),
            content_type=image.content_type or "image/jpeg",
            file_category="clothing",
            skip_duplicate=True,
            source="merchant_upload",
        )

        # 创建服装记录
        clothing = Clothing.objects.create(
            merchant_id=request.user.id,
            name=name,
            category=category,
            subcategory=subcategory,
            color=color,
            price=price,
            sizes=sizes,
            source=Clothing.Source.WARDROBE,
        )

        # 关联文件记录
        if file_id:
            from apps.common.models import FileRecord

            try:
                file_record = FileRecord.objects.get(id=file_id)
                clothing.file = file_record
                clothing.save()
            except FileRecord.DoesNotExist:
                pass

        return ApiResponse.success(ClothingSerializer(clothing).data, message="上传成功")


class ClothingDetailView(APIView):
    """服装详情、更新"""

    permission_classes = [IsAuthenticated]

    def get(self, request, uuid):
        try:
            clothing = Clothing.objects.get(id=uuid, merchant_id=request.user.id, is_deleted=False)
        except Clothing.DoesNotExist:
            return ApiResponse.not_found("服装不存在")

        serializer = ClothingSerializer(clothing)
        return ApiResponse.success(serializer.data)

    def put(self, request, uuid):
        try:
            clothing = Clothing.objects.get(id=uuid, merchant_id=request.user.id, is_deleted=False)
        except Clothing.DoesNotExist:
            return ApiResponse.not_found("服装不存在")

        serializer = ClothingDetailSerializer(clothing, data=request.data, partial=True)
        if not serializer.is_valid():
            return ApiResponse.error(serializer.errors)

        serializer.save()
        return ApiResponse.success(serializer.data, message="更新成功")

    def delete(self, request, uuid):
        try:
            clothing = Clothing.objects.get(id=uuid, merchant_id=request.user.id)
        except Clothing.DoesNotExist:
            return ApiResponse.not_found("服装不存在")

        clothing.is_deleted = True
        clothing.deleted_at = timezone.now()
        clothing.save(update_fields=["is_deleted", "deleted_at"])

        return ApiResponse.success(message="已删除")


class ClothingCreateView(APIView):
    """创建服装（通过URL）"""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ClothingDetailSerializer(data=request.data)
        if not serializer.is_valid():
            return ApiResponse.error(serializer.errors)

        data = serializer.validated_data
        clothing = Clothing.objects.create(
            merchant_id=request.user.id,
            name=data.get("name", "未命名服装"),
            category=data.get("category", "tops"),
            subcategory=data.get("subcategory", "t-shirt"),
            color=data.get("color", "#000000"),
            price=data.get("price", 0),
            sizes=data.get("sizes", []),
            source=Clothing.Source.WARDROBE,
            is_active=data.get("is_active", True),
        )

        return ApiResponse.success(ClothingSerializer(clothing).data, message="创建成功")


class CategoriesView(APIView):
    """获取分类列表"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        lang = get_language(request)

        result = []
        for category_id, config in CATEGORIES_CONFIG.items():
            # 获取该分类下的二级分类
            subcategories = []
            for sub_id, i18n in SUBCATEGORY_I18N.items():
                # 判断二级分类属于哪个一级分类
                if category_id == "tops" and sub_id in ["t-shirt", "shirt", "blouse", "sweater", "hoodie"]:
                    subcategories.append({"id": sub_id, "name": i18n.get(lang, i18n.get("zh-CN", sub_id))})
                elif category_id == "bottoms" and sub_id in ["pants", "shorts", "skirt", "jeans"]:
                    subcategories.append({"id": sub_id, "name": i18n.get(lang, i18n.get("zh-CN", sub_id))})
                elif category_id == "dresses" and sub_id in ["casual-dress", "formal-dress", "maxi-dress"]:
                    subcategories.append({"id": sub_id, "name": i18n.get(lang, i18n.get("zh-CN", sub_id))})
                elif category_id == "outerwear" and sub_id in ["coat", "jacket", "blazer", "cardigan"]:
                    subcategories.append({"id": sub_id, "name": i18n.get(lang, i18n.get("zh-CN", sub_id))})
                elif category_id == "shoes" and sub_id in ["sneakers", "heels", "boots", "sandals", "loafers"]:
                    subcategories.append({"id": sub_id, "name": i18n.get(lang, i18n.get("zh-CN", sub_id))})
                elif category_id == "accessories" and sub_id in ["hat", "scarf", "bag", "belt", "jewelry"]:
                    subcategories.append({"id": sub_id, "name": i18n.get(lang, i18n.get("zh-CN", sub_id))})

            result.append(
                {
                    "id": category_id,
                    "name": get_category_name(category_id, lang),
                    "subcategories": subcategories,
                }
            )

        return ApiResponse.success(result)
