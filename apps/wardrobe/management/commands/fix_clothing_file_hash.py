"""
修复服装记录的 file_hash 字段

为所有 file_hash 为空的服装记录补充 content_key（格式: storage_type:md5）
"""
from django.core.management.base import BaseCommand
from apps.wardrobe.models import Clothing
from apps.common.utils.url_utils import get_key_from_url
from apps.common.constants import ContentKeyPrefix
from apps.common.utils.content_key import ContentKey
import os
import re


class Command(BaseCommand):
    help = '修复服装记录的 file_hash 字段'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            dest='dry_run',
            default=False,
            help='只显示将要修复的记录，不实际修改',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        # 查找所有服装，检查 file_hash 状态
        all_clothings = Clothing.objects.all()
        
        total = all_clothings.count()
        self.stdout.write(f'总共有 {total} 条服装记录')
        
        # 统计 file_hash 状态
        empty_hash = all_clothings.filter(file_hash='')
        none_hash = all_clothings.filter(file_hash__isnull=True)
        has_hash = all_clothings.exclude(file_hash='').exclude(file_hash__isnull=True)
        
        self.stdout.write(f'- file_hash 为空字符串: {empty_hash.count()} 条')
        self.stdout.write(f'- file_hash 为 NULL: {none_hash.count()} 条')
        self.stdout.write(f'- file_hash 有值: {has_hash.count()} 条')
        
        # 显示前几条记录的详细信息
        self.stdout.write('\n前 5 条记录详情:')
        for clothing in all_clothings[:5]:
            self.stdout.write(f'  - {clothing.name}: file_hash="{clothing.file_hash}", image_url={clothing.image_url[:80]}...')
        
        if empty_hash.count() == 0 and none_hash.count() == 0:
            self.stdout.write(self.style.SUCCESS('\n所有记录的 file_hash 都有值'))
            return
        
        # 修复 file_hash 为空的记录
        clothings = empty_hash | none_hash
        fixed_count = 0
        skipped_count = 0
        
        for clothing in clothings:
            storage_key = get_key_from_url(clothing.image_url)
            
            if storage_key:
                filename = os.path.basename(storage_key)
                filename_without_ext = os.path.splitext(filename)[0]
                
                # 检查文件名是否是 MD5 格式（32位十六进制）
                if len(filename_without_ext) == 32 and re.match(r'^[a-f0-9]{32}$', filename_without_ext):
                    # 生成 content_key（格式: storage_type:md5）
                    storage_type = ContentKeyPrefix.OSS if 'oss' in clothing.image_url.lower() else ContentKeyPrefix.LOCAL
                    content_key = ContentKey.from_md5(filename_without_ext, storage_type)
                    
                    if dry_run:
                        self.stdout.write(f'[DRY-RUN] 将修复: {clothing.name} (UUID: {clothing.uuid}, content_key: {content_key})')
                    else:
                        clothing.file_hash = content_key
                        clothing.save(update_fields=['file_hash'])
                        self.stdout.write(f'已修复: {clothing.name} (UUID: {clothing.uuid}, content_key: {content_key})')
                    fixed_count += 1
                else:
                    self.stdout.write(
                        self.style.WARNING(f'跳过: {clothing.name} (文件名不是 MD5 格式: {filename})')
                    )
                    skipped_count += 1
            else:
                self.stdout.write(
                    self.style.WARNING(f'跳过: {clothing.name} (无法从 URL 提取 key)')
                )
                skipped_count += 1
        
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f'修复完成: 成功 {fixed_count} 条，跳过 {skipped_count} 条'))
        
        if dry_run:
            self.stdout.write(self.style.WARNING('这是预览模式，未实际修改数据库'))
