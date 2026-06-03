from django.utils.deprecation import MiddlewareMixin


class MerchantDataIsolationMiddleware(MiddlewareMixin):
    """商家数据隔离中间件"""

    def process_request(self, request):
        if hasattr(request, "user") and request.user.is_authenticated:
            if not request.user.is_superuser:
                request.merchant_filter = {"merchant_id": request.user.id}
            else:
                request.merchant_filter = {}
        return None
