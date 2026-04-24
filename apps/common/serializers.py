from rest_framework import serializers
from .models import FileUploadRecord


class FileUploadRecordSerializer(serializers.ModelSerializer):
    """文件上传记录序列化器"""
    filename = serializers.SerializerMethodField()
    file_type = serializers.CharField(source='file_category', read_only=True)
    storage_type_text = serializers.CharField(source='get_storage_type_display', read_only=True)
    file_category_text = serializers.CharField(source='get_file_category_display', read_only=True)
    
    def get_filename(self, obj):
        """从 storage_key 提取文件名"""
        if obj.storage_key:
            return obj.storage_key.split('/')[-1]
        return f"{obj.md5_hash}.{obj.file_ext}"
    
    class Meta:
        model = FileUploadRecord
        fields = [
            'id',
            'filename',
            'file_type',
            'md5_hash',
            'storage_type',
            'storage_type_text',
            'storage_key',
            'access_url',
            'tenant_id',
            'folder',
            'file_category',
            'file_category_text',
            'file_size',
            'content_type',
            'file_ext',
            'width',
            'height',
            'hit_count',
            'ref_type',
            'ref_id',
            'source',
            'client_ip',
            'is_deleted',
            'deleted_at',
            'created_at',
            'updated_at',
            'last_accessed_at',
        ]
        read_only_fields = fields  # 所有字段只读


class FileBatchActionSerializer(serializers.Serializer):
    """批量操作序列化器"""
    ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=True,
        help_text='文件 ID 列表'
    )
    action = serializers.ChoiceField(
        choices=['soft_delete', 'restore', 'hard_delete'],
        required=True,
        help_text='操作类型: soft_delete=软删除, restore=恢复, hard_delete=永久删除'
    )
