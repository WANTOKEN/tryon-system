"""
自定义分页工具
"""
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class CustomPageNumberPagination(PageNumberPagination):
    """自定义分页器"""
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 200
    page_query_param = 'page'

    def get_paginated_response(self, data):
        return Response({
            'success': True,
            'data': {
                'items': data,
                'total': self.page.paginator.count,
                'page': self.page.number,
                'page_size': self.get_page_size(self.request),
                'total_pages': self.page.paginator.num_pages,
            }
        })

    def get_paginated_response_schema(self, schema):
        return {
            'type': 'object',
            'properties': {
                'success': {'type': 'boolean'},
                'data': {
                    'type': 'object',
                    'properties': {
                        'items': {'type': 'array'},
                        'total': {'type': 'integer'},
                        'page': {'type': 'integer'},
                        'page_size': {'type': 'integer'},
                        'total_pages': {'type': 'integer'},
                    },
                },
            },
        }
