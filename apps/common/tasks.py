"""
定时任务模块
包含文件清理、数据统计等定时任务
"""

import logging
from datetime import timedelta
from django.utils import timezone

from apps.common.services.storage_service import storage_service

logger = logging.getLogger('tasks')


def cleanup_orphan_files():
    """
    清理未关联的文件记录（孤儿文件）
    
    检查所有 FileRecord，找出没有被任何业务模型关联的文件，
    删除文件记录和实际存储的文件。
    
    执行频率：建议每天执行一次
    """
    from apps.common.models import FileRecord
    from apps.wardrobe.models import Clothing
    from apps.tryon.models import TryOnRecord
    from apps.common.models import ModelPhoto
    
    logger.info("开始清理孤儿文件...")
    
    try:
        # 获取所有文件ID
        all_file_ids = set(FileRecord.objects.filter(is_deleted=False).values_list('id', flat=True))
        logger.info(f"总文件数: {len(all_file_ids)}")
        
        if not all_file_ids:
            logger.info("没有文件需要清理")
            return
        
        # 获取已关联的文件ID
        used_file_ids = set()
        
        # 服装关联的文件
        clothing_files = Clothing.objects.filter(file__isnull=False).values_list('file_id', flat=True)
        used_file_ids.update(clothing_files)
        logger.info(f"服装关联文件数: {len(clothing_files)}")
        
        # 试穿记录头像文件
        avatar_files = TryOnRecord.objects.filter(avatar_file__isnull=False).values_list('avatar_file_id', flat=True)
        used_file_ids.update(avatar_files)
        logger.info(f"试穿头像文件数: {len(avatar_files)}")
        
        # 试穿记录结果文件
        result_files = TryOnRecord.objects.filter(result_file__isnull=False).values_list('result_file_id', flat=True)
        used_file_ids.update(result_files)
        logger.info(f"试穿结果文件数: {len(result_files)}")
        
        # 模特照片关联的文件
        model_files = ModelPhoto.objects.filter(file__isnull=False).values_list('file_id', flat=True)
        used_file_ids.update(model_files)
        logger.info(f"模特照片文件数: {len(model_files)}")
        
        # 计算孤儿文件
        orphan_file_ids = all_file_ids - used_file_ids
        logger.info(f"孤儿文件数: {len(orphan_file_ids)}")
        
        # 删除孤儿文件
        deleted_count = 0
        for file_id in orphan_file_ids:
            try:
                record = FileRecord.objects.get(id=file_id)
                
                # 删除实际存储的文件
                try:
                    storage_service.delete_file(record.storage_key, record.storage_type)
                except Exception as e:
                    logger.warning(f"删除存储文件失败 {record.storage_key}: {e}")
                
                # 软删除记录
                record.is_deleted = True
                record.deleted_at = timezone.now()
                record.save()
                
                deleted_count += 1
                logger.info(f"已清理孤儿文件: {record.id} - {record.storage_key}")
                
            except FileRecord.DoesNotExist:
                continue
            except Exception as e:
                logger.error(f"清理孤儿文件失败 {file_id}: {e}")
        
        logger.info(f"孤儿文件清理完成，共清理 {deleted_count} 个文件")
        
    except Exception as e:
        logger.error(f"清理孤儿文件任务失败: {e}")


def cleanup_expired_temp_files():
    """
    清理过期的临时文件
    
    删除超过24小时的临时文件记录和实际文件
    
    执行频率：建议每小时执行一次
    """
    from apps.common.models import FileRecord
    
    logger.info("开始清理过期临时文件...")
    
    try:
        expire_time = timezone.now() - timedelta(hours=24)
        expired_records = FileRecord.objects.filter(
            file_category='temp',
            is_deleted=False,
            created_at__lt=expire_time
        )
        
        deleted_count = 0
        for record in expired_records:
            try:
                # 删除实际存储的文件
                try:
                    storage_service.delete_file(record.storage_key, record.storage_type)
                except Exception as e:
                    logger.warning(f"删除存储文件失败 {record.storage_key}: {e}")
                
                # 软删除记录
                record.is_deleted = True
                record.deleted_at = timezone.now()
                record.save()
                
                deleted_count += 1
                
            except Exception as e:
                logger.error(f"清理过期临时文件失败 {record.id}: {e}")
        
        logger.info(f"过期临时文件清理完成，共清理 {deleted_count} 个文件")
        
    except Exception as e:
        logger.error(f"清理过期临时文件任务失败: {e}")


def run_periodic_tasks():
    """
    执行所有定期任务（用于测试）
    """
    cleanup_orphan_files()
    cleanup_expired_temp_files()


if __name__ == '__main__':
    # 测试运行
    import os
    import sys
    
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
    
    import django
    django.setup()
    
    run_periodic_tasks()