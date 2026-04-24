"""
Admin API 序列化器
"""
from rest_framework import serializers
from .models import AdminOperationLog, SystemConfig, QuotaHistory


class AdminOperationLogSerializer(serializers.ModelSerializer):
    """管理员操作日志序列化器"""
    action_text = serializers.CharField(source='get_action_display', read_only=True)
    
    class Meta:
        model = AdminOperationLog
        fields = [
            'id', 'admin_id', 'admin_username', 'action', 'action_text',
            'target_type', 'target_id', 'target_name', 'detail',
            'ip_address', 'user_agent', 'created_at'
        ]
        read_only_fields = fields


class SystemConfigSerializer(serializers.ModelSerializer):
    """系统配置序列化器"""
    value_type_text = serializers.CharField(source='get_value_type_display', read_only=True)
    parsed_value = serializers.SerializerMethodField()
    
    class Meta:
        model = SystemConfig
        fields = [
            'id', 'key', 'value', 'value_type', 'value_type_text',
            'parsed_value', 'description', 'is_public', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_parsed_value(self, obj):
        """获取解析后的值"""
        return SystemConfig._parse_value(obj.value, obj.value_type)


class SystemConfigBatchSerializer(serializers.Serializer):
    """批量配置更新序列化器"""
    configs = serializers.DictField(
        child=serializers.CharField(),
        help_text='配置键值对'
    )


class QuotaHistorySerializer(serializers.ModelSerializer):
    """配额变更历史序列化器"""
    
    class Meta:
        model = QuotaHistory
        fields = [
            'id', 'merchant_id', 'change_type', 'old_total', 'new_total',
            'old_used', 'new_used', 'reason', 'operator_id', 'operator_name', 'created_at'
        ]
        read_only_fields = fields


class QuotaAdjustSerializer(serializers.Serializer):
    """配额调整序列化器"""
    quota_total = serializers.IntegerField(min_value=0, help_text='新的总配额')
    reason = serializers.CharField(max_length=255, required=False, default='', help_text='调整原因')


class QuotaResetSerializer(serializers.Serializer):
    """配额重置序列化器"""
    reason = serializers.CharField(max_length=255, required=False, default='', help_text='重置原因')


class AdminUserCreateSerializer(serializers.Serializer):
    """创建管理员序列化器"""
    username = serializers.CharField(max_length=50)
    phone = serializers.CharField(max_length=20)
    password = serializers.CharField(min_length=6, max_length=128)
    is_superuser = serializers.BooleanField(default=False)
    store_name = serializers.CharField(max_length=100, required=False, default='')


class AdminUserUpdateSerializer(serializers.Serializer):
    """更新管理员序列化器"""
    phone = serializers.CharField(max_length=20, required=False)
    password = serializers.CharField(min_length=6, max_length=128, required=False)
    is_staff = serializers.BooleanField(required=False)
    is_superuser = serializers.BooleanField(required=False)
    is_active = serializers.BooleanField(required=False)
    store_name = serializers.CharField(max_length=100, required=False)
