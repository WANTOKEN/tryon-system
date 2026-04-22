# -*- coding: utf-8 -*-
"""
从 OSSFileCache 迁移到统一的 FileUploadRecord 表

新增字段:
- tenant_id: 租户隔离
- file_category: 文件用途分类
- file_ext, width, height: 文件属性
- ref_type, ref_id: 业务关联
- source, client_ip: 来源追踪

索引优化:
- idx_tenant_md5: 租户 + MD5（去重查询）
- idx_tenant_folder: 租户 + 文件夹
- idx_tenant_category: 租户 + 分类
- idx_storage_folder: 存储类型 + 文件夹
- idx_last_access: 最后访问时间
- idx_created: 创建时间
- idx_ref: 业务关联

约束:
- uq_tenant_md5: 租户 + MD5 唯一
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = False

    dependencies = [
        ('common', '0001_oss_file_cache'),
    ]

    operations = [
        # 创建新的统一上传记录表
        migrations.CreateModel(
            name='FileUploadRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='更新时间')),
                # 核心字段
                ('md5_hash', models.CharField(db_index=True, max_length=32, verbose_name='文件 MD5', help_text='用于去重，相同 MD5 复用已有文件')),
                ('storage_type', models.CharField(choices=[('local', '本地存储'), ('oss', '阿里云 OSS')], default='local', max_length=10, verbose_name='存储类型')),
                ('storage_key', models.CharField(max_length=500, verbose_name='存储路径', help_text='本地: 相对路径; OSS: object key')),
                ('access_url', models.CharField(max_length=1000, verbose_name='访问 URL', help_text='本地: /media/xxx; OSS: 公网 URL')),
                # 租户字段
                ('tenant_id', models.CharField(db_index=True, max_length=50, verbose_name='租户 ID', help_text='商户/用户标识，用于隔离')),
                # 分类字段
                ('folder', models.CharField(db_index=True, max_length=100, verbose_name='存储文件夹', help_text='如 avatars, clothes, results')),
                ('file_category', models.CharField(choices=[('avatar', '人物照片'), ('clothing', '服装图片'), ('result', '试穿结果'), ('other', '其他')], default='other', max_length=20, verbose_name='文件用途')),
                # 文件属性
                ('file_size', models.PositiveIntegerField(default=0, verbose_name='文件大小(字节)')),
                ('content_type', models.CharField(blank=True, default='', max_length=100, verbose_name='文件类型')),
                ('file_ext', models.CharField(blank=True, default='', max_length=10, verbose_name='文件扩展名', help_text='如 .png, .jpg, .webp')),
                ('width', models.PositiveIntegerField(default=0, verbose_name='图片宽度', help_text='仅图片类型有效')),
                ('height', models.PositiveIntegerField(default=0, verbose_name='图片高度', help_text='仅图片类型有效')),
                # 统计字段
                ('hit_count', models.PositiveIntegerField(default=0, verbose_name='命中次数', help_text='相同 MD5 的重复上传次数')),
                ('last_accessed_at', models.DateTimeField(auto_now=True, verbose_name='最后访问时间')),
                # 业务关联
                ('ref_type', models.CharField(blank=True, default='', max_length=30, verbose_name='关联类型', help_text='如 tryon_record, clothing')),
                ('ref_id', models.CharField(blank=True, default='', max_length=50, verbose_name='关联 ID', help_text='关联对象的 UUID 或 ID')),
                # 来源追踪
                ('source', models.CharField(blank=True, default='', max_length=30, verbose_name='上传来源', help_text='如 web, api, import')),
                ('client_ip', models.CharField(blank=True, default='', max_length=45, verbose_name='客户端 IP')),
            ],
            options={
                'verbose_name': '文件上传记录',
                'verbose_name_plural': '文件上传记录',
                'db_table': 'common_file_upload_record',
                'ordering': ['-created_at'],
            },
            bases=(models.Model,),
        ),
        # 添加索引
        migrations.AddIndex(
            model_name='fileuploadrecord',
            index=models.Index(fields=['tenant_id', 'md5_hash'], name='idx_tenant_md5'),
        ),
        migrations.AddIndex(
            model_name='fileuploadrecord',
            index=models.Index(fields=['tenant_id', 'folder'], name='idx_tenant_folder'),
        ),
        migrations.AddIndex(
            model_name='fileuploadrecord',
            index=models.Index(fields=['tenant_id', 'file_category'], name='idx_tenant_category'),
        ),
        migrations.AddIndex(
            model_name='fileuploadrecord',
            index=models.Index(fields=['storage_type', 'folder'], name='idx_storage_folder'),
        ),
        migrations.AddIndex(
            model_name='fileuploadrecord',
            index=models.Index(fields=['-last_accessed_at'], name='idx_last_access'),
        ),
        migrations.AddIndex(
            model_name='fileuploadrecord',
            index=models.Index(fields=['-created_at'], name='idx_created'),
        ),
        migrations.AddIndex(
            model_name='fileuploadrecord',
            index=models.Index(fields=['ref_type', 'ref_id'], name='idx_ref'),
        ),
        # 添加唯一约束
        migrations.AddConstraint(
            model_name='fileuploadrecord',
            constraint=models.UniqueConstraint(fields=['tenant_id', 'md5_hash'], name='uq_tenant_md5'),
        ),
        # 删除旧的 OSSFileCache 表
        migrations.DeleteModel(
            name='OSSFileCache',
        ),
    ]
