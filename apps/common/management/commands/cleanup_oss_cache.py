"""
清理 OSS 文件缓存管理命令

用法:
    python manage.py cleanup_oss_cache --days=30
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from apps.common.models import OSSFileCache


class Command(BaseCommand):
    help = "清理旧的 OSS 文件缓存记录"

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=30, help="保留最近多少天的缓存记录,默认 30 天")
        parser.add_argument("--dry-run", action="store_true", help="仅显示将要删除的记录数,不实际删除")

    def handle(self, *args, **options):
        days = options["days"]
        dry_run = options["dry_run"]

        cutoff_date = timezone.now() - timedelta(days=days)

        # 查询将要删除的记录
        old_records = OSSFileCache.objects.filter(last_accessed_at__lt=cutoff_date)
        count = old_records.count()

        if dry_run:
            self.stdout.write(self.style.WARNING(f"[Dry Run] 将删除 {count} 条 {days} 天前未访问的缓存记录"))
            # 显示统计信息
            if count > 0:
                from django.db.models import Sum

                stats = old_records.aggregate(total_size=Sum("file_size"), total_uploads=Sum("upload_count"))
                self.stdout.write(f'总大小: {stats["total_size"] or 0} 字节')
                self.stdout.write(f'总上传次数: {stats["total_uploads"] or 0}')
        else:
            if count == 0:
                self.stdout.write(self.style.SUCCESS("没有需要清理的缓存记录"))
                return

            # 执行删除
            deleted_count, _ = old_records.delete()

            self.stdout.write(self.style.SUCCESS(f"成功清理 {deleted_count} 条缓存记录 (保留最近 {days} 天)"))
