# Generated migration for admin_api models

from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='AdminOperationLog',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('admin_id', models.BigIntegerField(db_index=True, verbose_name='管理员ID')),
                ('admin_username', models.CharField(max_length=50, verbose_name='管理员用户名')),
                ('action', models.CharField(choices=[('create', '创建'), ('update', '更新'), ('delete', '删除'), ('login', '登录'), ('logout', '登出'), ('quota_adjust', '配额调整'), ('quota_reset', '配额重置'), ('status_change', '状态变更')], max_length=20, verbose_name='操作类型')),
                ('target_type', models.CharField(help_text='如 Merchant, TryOnRecord', max_length=50, verbose_name='目标类型')),
                ('target_id', models.CharField(blank=True, default='', max_length=50, verbose_name='目标ID')),
                ('target_name', models.CharField(blank=True, default='', max_length=100, verbose_name='目标名称')),
                ('detail', models.JSONField(default=dict, verbose_name='操作详情')),
                ('ip_address', models.CharField(blank=True, default='', max_length=45, verbose_name='IP地址')),
                ('user_agent', models.CharField(blank=True, default='', max_length=500, verbose_name='User Agent')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
            ],
            options={
                'verbose_name': '管理员操作日志',
                'verbose_name_plural': '管理员操作日志',
                'db_table': 'admin_operation_log',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='SystemConfig',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('key', models.CharField(db_index=True, max_length=100, unique=True, verbose_name='配置键')),
                ('value', models.TextField(verbose_name='配置值')),
                ('value_type', models.CharField(choices=[('string', '字符串'), ('integer', '整数'), ('float', '浮点数'), ('boolean', '布尔值'), ('json', 'JSON对象')], default='string', max_length=20, verbose_name='值类型')),
                ('description', models.CharField(blank=True, default='', max_length=255, verbose_name='配置描述')),
                ('is_public', models.BooleanField(default=False, help_text='公开配置可被前端访问', verbose_name='是否公开')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='更新时间')),
            ],
            options={
                'verbose_name': '系统配置',
                'verbose_name_plural': '系统配置',
                'db_table': 'admin_system_config',
            },
        ),
        migrations.CreateModel(
            name='QuotaHistory',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('merchant_id', models.BigIntegerField(db_index=True, verbose_name='商家ID')),
                ('change_type', models.CharField(help_text='如 adjust, reset, deduct', max_length=20, verbose_name='变更类型')),
                ('old_total', models.PositiveIntegerField(verbose_name='原总配额')),
                ('new_total', models.PositiveIntegerField(verbose_name='新总配额')),
                ('old_used', models.PositiveIntegerField(verbose_name='原已用配额')),
                ('new_used', models.PositiveIntegerField(verbose_name='新已用配额')),
                ('reason', models.CharField(blank=True, default='', max_length=255, verbose_name='变更原因')),
                ('operator_id', models.BigIntegerField(blank=True, null=True, verbose_name='操作人ID')),
                ('operator_name', models.CharField(blank=True, default='', max_length=50, verbose_name='操作人名称')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
            ],
            options={
                'verbose_name': '配额变更历史',
                'verbose_name_plural': '配额变更历史',
                'db_table': 'admin_quota_history',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='adminoperationlog',
            index=models.Index(fields=['admin_id', 'created_at'], name='idx_admin_time'),
        ),
        migrations.AddIndex(
            model_name='adminoperationlog',
            index=models.Index(fields=['action', 'created_at'], name='idx_action_time'),
        ),
        migrations.AddIndex(
            model_name='adminoperationlog',
            index=models.Index(fields=['target_type', 'target_id'], name='idx_target'),
        ),
        migrations.AddIndex(
            model_name='quotahistory',
            index=models.Index(fields=['merchant_id', 'created_at'], name='idx_merchant_time'),
        ),
    ]
