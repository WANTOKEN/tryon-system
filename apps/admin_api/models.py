"""
Admin API 模型
"""
from django.db import models
from django.conf import settings


class AdminOperationLog(models.Model):
    """管理员操作日志"""
    
    class ActionType(models.TextChoices):
        CREATE = 'create', '创建'
        UPDATE = 'update', '更新'
        DELETE = 'delete', '删除'
        LOGIN = 'login', '登录'
        LOGOUT = 'logout', '登出'
        QUOTA_ADJUST = 'quota_adjust', '配额调整'
        QUOTA_RESET = 'quota_reset', '配额重置'
        STATUS_CHANGE = 'status_change', '状态变更'
    
    id = models.BigAutoField(primary_key=True)
    admin_id = models.BigIntegerField(db_index=True, verbose_name='管理员ID')
    admin_username = models.CharField(max_length=50, verbose_name='管理员用户名')
    action = models.CharField(max_length=20, choices=ActionType.choices, verbose_name='操作类型')
    target_type = models.CharField(max_length=50, verbose_name='目标类型', help_text='如 Merchant, TryOnRecord')
    target_id = models.CharField(max_length=50, blank=True, default='', verbose_name='目标ID')
    target_name = models.CharField(max_length=100, blank=True, default='', verbose_name='目标名称')
    detail = models.JSONField(default=dict, verbose_name='操作详情')
    ip_address = models.CharField(max_length=45, blank=True, default='', verbose_name='IP地址')
    user_agent = models.CharField(max_length=500, blank=True, default='', verbose_name='User Agent')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    
    class Meta:
        db_table = 'admin_operation_log'
        verbose_name = '管理员操作日志'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['admin_id', 'created_at']),
            models.Index(fields=['action', 'created_at']),
            models.Index(fields=['target_type', 'target_id']),
        ]
    
    def __str__(self):
        return f"{self.admin_username} - {self.action} - {self.target_type}"
    
    @classmethod
    def log(cls, request, action: str, target_type: str, target_id: str = '', 
            target_name: str = '', detail: dict = None):
        """记录操作日志"""
        user = request.user if hasattr(request, 'user') else None
        if not user or not user.is_authenticated:
            return None
        
        return cls.objects.create(
            admin_id=user.id,
            admin_username=user.username,
            action=action,
            target_type=target_type,
            target_id=str(target_id),
            target_name=target_name,
            detail=detail or {},
            ip_address=getattr(request, 'META', {}).get('REMOTE_ADDR', ''),
            user_agent=getattr(request, 'META', {}).get('HTTP_USER_AGENT', '')[:500],
        )


class SystemConfig(models.Model):
    """系统配置表"""
    
    class ConfigType(models.TextChoices):
        STRING = 'string', '字符串'
        INTEGER = 'integer', '整数'
        FLOAT = 'float', '浮点数'
        BOOLEAN = 'boolean', '布尔值'
        JSON = 'json', 'JSON对象'
    
    id = models.BigAutoField(primary_key=True)
    key = models.CharField(max_length=100, unique=True, db_index=True, verbose_name='配置键')
    value = models.TextField(verbose_name='配置值')
    value_type = models.CharField(max_length=20, choices=ConfigType.choices, default=ConfigType.STRING, verbose_name='值类型')
    description = models.CharField(max_length=255, blank=True, default='', verbose_name='配置描述')
    is_public = models.BooleanField(default=False, verbose_name='是否公开', help_text='公开配置可被前端访问')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        db_table = 'admin_system_config'
        verbose_name = '系统配置'
        verbose_name_plural = verbose_name
    
    def __str__(self):
        return f"{self.key} = {self.value}"
    
    @classmethod
    def get_value(cls, key: str, default=None):
        """获取配置值"""
        try:
            config = cls.objects.get(key=key)
            return cls._parse_value(config.value, config.value_type)
        except cls.DoesNotExist:
            return default
    
    @classmethod
    def set_value(cls, key: str, value, value_type: str = 'string', description: str = '', is_public: bool = False):
        """设置配置值"""
        str_value = cls._to_string(value, value_type)
        return cls.objects.update_or_create(
            key=key,
            defaults={
                'value': str_value,
                'value_type': value_type,
                'description': description,
                'is_public': is_public,
            }
        )
    
    @staticmethod
    def _parse_value(value: str, value_type: str):
        """解析配置值"""
        import json
        if value_type == 'integer':
            return int(value)
        elif value_type == 'float':
            return float(value)
        elif value_type == 'boolean':
            return value.lower() in ('true', '1', 'yes')
        elif value_type == 'json':
            return json.loads(value)
        return value
    
    @staticmethod
    def _to_string(value, value_type: str) -> str:
        """转换为字符串存储"""
        import json
        if value_type == 'json':
            return json.dumps(value, ensure_ascii=False)
        elif value_type == 'boolean':
            return 'true' if value else 'false'
        return str(value)


class QuotaHistory(models.Model):
    """配额变更历史"""
    
    id = models.BigAutoField(primary_key=True)
    merchant_id = models.BigIntegerField(db_index=True, verbose_name='商家ID')
    change_type = models.CharField(max_length=20, verbose_name='变更类型', help_text='如 adjust, reset, deduct')
    old_total = models.PositiveIntegerField(verbose_name='原总配额')
    new_total = models.PositiveIntegerField(verbose_name='新总配额')
    old_used = models.PositiveIntegerField(verbose_name='原已用配额')
    new_used = models.PositiveIntegerField(verbose_name='新已用配额')
    reason = models.CharField(max_length=255, blank=True, default='', verbose_name='变更原因')
    operator_id = models.BigIntegerField(null=True, blank=True, verbose_name='操作人ID')
    operator_name = models.CharField(max_length=50, blank=True, default='', verbose_name='操作人名称')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    
    class Meta:
        db_table = 'admin_quota_history'
        verbose_name = '配额变更历史'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['merchant_id', 'created_at']),
        ]
    
    def __str__(self):
        return f"Merchant {self.merchant_id} - {self.change_type}"
