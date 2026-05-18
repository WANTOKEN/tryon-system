"""
试穿任务服务
整合存储上传和 AI 引擎调用
支持 OSS 和本地存储切换 (通过 STORAGE_TYPE 环境变量)
"""
import os
import logging
import time
from typing import Optional, Dict, Any, List

from django.db import transaction

from apps.common.constants import StorageFolder, DefaultValue, ContentKeyPrefix
from apps.common.services.storage_service import storage_service
from apps.common.utils.content_key import ContentKey
from apps.common.exceptions import AIEngineException, OssException
from apps.tryon.ai_engines import AIEngineFactory
from apps.tryon.models import TryOnRecord, TryOnClothing

logger = logging.getLogger('tryon')


class TryOnService:
    """
    试穿任务服务
    
    工作流程:
    1. 用户上传图片 (人物/服装)
    2. 图片上传到存储服务获取公网 URL
    3. 将 URL 传给 AI 引擎生成试穿结果
    4. (可选) 将结果图片下载并存储
    """
    
    def __init__(self, engine_name: Optional[str] = None):
        """
        初始化服务
        
        Args:
            engine_name: AI 引擎名称，默认使用配置的默认引擎
        """
        self.engine_name = engine_name or os.getenv('AI_ENGINE_DEFAULT', DefaultValue.AI_ENGINE)
        self.engine = AIEngineFactory.get(self.engine_name)
    
    def _upload_image(
        self,
        image_data,
        folder: str,
        tenant_id: str = '',
        file_category: str = 'other',
        content_type: str = 'image/png',
        skip_duplicate: bool = True
    ) -> Dict[str, Any]:
        """
        上传图片到存储服务并返回信息

        Args:
            image_data: 图片数据 (文件对象/base64/URL)
            folder: 存储文件夹
            tenant_id: 租户 ID（用于去重隔离）
            file_category: 文件用途分类
            content_type: 内容类型
            skip_duplicate: 是否跳过重复文件（MD5 去重）

        Returns:
            {
                'url': 访问 URL,
                'key': 存储路径,
                'content_key': 内容 Key（格式: storage_type:md5，用于复用）,
                'is_duplicate': 是否重复,
            }
        """
        # 根据输入类型处理
        if isinstance(image_data, str):
            if image_data.startswith('data:'):
                # Base64 数据 URL
                key, url, is_duplicate, content_key = storage_service.upload_from_base64(
                    image_data,
                    folder=folder,
                    tenant_id=tenant_id,
                    content_type=content_type,
                    file_category=file_category,
                    skip_duplicate=skip_duplicate
                )
                return {'url': url, 'key': key, 'content_key': content_key, 'is_duplicate': is_duplicate}
            elif image_data.startswith('http'):
                # 已经是 URL，直接返回
                return {
                    'url': image_data,
                    'key': '',
                    'content_key': '',
                    'is_duplicate': False,
                }
            else:
                # 假设是纯 Base64 字符串（不带 data: 前缀）
                # 添加前缀以便 storage_service 识别
                if not image_data.startswith('data:'):
                    image_data = f'data:{content_type};base64,{image_data}'
                key, url, is_duplicate, content_key = storage_service.upload_from_base64(
                    image_data,
                    folder=folder,
                    tenant_id=tenant_id,
                    content_type=content_type,
                    file_category=file_category,
                    skip_duplicate=skip_duplicate
                )
                return {'url': url, 'key': key, 'content_key': content_key, 'is_duplicate': is_duplicate}

        elif hasattr(image_data, 'read'):
            # 文件对象
            filename = getattr(image_data, 'name', 'image.png')
            key, url, is_duplicate, content_key = storage_service.upload_file(
                image_data,
                filename=filename,
                folder=folder,
                tenant_id=tenant_id,
                content_type=content_type,
                file_category=file_category,
                skip_duplicate=skip_duplicate
            )
            return {'url': url, 'key': key, 'content_key': content_key, 'is_duplicate': is_duplicate}

        else:
            raise OssException(f'不支持的图片数据类型: {type(image_data)}')
    
    def _get_signed_url(self, url: str, expires: int = 3600) -> str:
        """
        获取带签名的临时访问 URL
        
        Args:
            url: 原 URL
            expires: 过期时间（秒），默认 1 小时
        
        Returns:
            签名 URL 或原 URL（本地存储）
        """
        if not url:
            return url
        
        return storage_service.get_signed_url_from_url(url, expires)
    
    def create_task(
        self,
        avatar_image,
        clothes_images: list,
        tenant_id: str = '',
        prompt: Optional[str] = None,
        skip_duplicate: bool = True,
        clothing_info: Optional[List[Dict]] = None,
        avatar_source: str = 'user',
        **kwargs
    ) -> Dict[str, Any]:
        """
        创建试穿任务

        Args:
            avatar_image: 人物照片 (文件对象/base64/URL)
            clothes_images: 服装图片列表
            tenant_id: 租户 ID（用于去重隔离）
            prompt: 自定义提示词
            skip_duplicate: 是否跳过重复文件（MD5 去重）
            clothing_info: 服装信息列表，每项包含 category, subcategory 等
            avatar_source: 头像来源 (system/user/history)
            **kwargs: 额外参数传递给引擎

        Returns:
            {
                'task_id': str,
                'success': bool,
                'error_message': str,
                'result_url': str,  # 如果同步完成
                'avatar_url': str,
                'clothes_urls': list,
                'duplicate_stats': {'avatar': bool, 'clothes': list},
            }
        """
        duplicate_stats = {'avatar': False, 'clothes': []}

        try:
            # 1. 上传人物照片
            storage_type = 'OSS' if storage_service.is_oss else '本地'
            logger.info(f"[TryOnService] 上传人物照片 ({storage_type}), tenant_id={tenant_id}")
            avatar_result = self._upload_image(
                avatar_image,
                folder=StorageFolder.AVATARS,
                tenant_id=tenant_id,
                file_category='avatar',
                skip_duplicate=skip_duplicate
            )
            avatar_url = avatar_result['url']
            logger.info(f"[TryOnService] avatar_url from upload: {avatar_url}")
            avatar_content_key = avatar_result.get('content_key', '')
            # 如果返回的是纯 MD5（32位），转换为带前缀的 ContentKey
            # 如果已经是带前缀的 content_key，直接使用
            if avatar_content_key and len(avatar_content_key) == 32:
                storage_type = ContentKeyPrefix.OSS if storage_service.is_oss else ContentKeyPrefix.LOCAL
                avatar_content_key = ContentKey.from_md5(avatar_content_key, storage_type)
            # 否则 avatar_content_key 已经是 content_key，直接使用
            duplicate_stats['avatar'] = avatar_result['is_duplicate']

            # 2. 上传服装照片
            logger.info(f"[TryOnService] 上传服装照片, count={len(clothes_images)}")
            clothes_urls = []
            clothes_keys = []  # 服装的 image_key 列表（供前端复用）
            for i, clothes_image in enumerate(clothes_images):
                # 类型判断日志
                img_type = 'URL' if isinstance(clothes_image, str) else '文件对象'
                logger.info(f"[TryOnService] 服装 {i}: 类型={img_type}")

                result = self._upload_image(
                    clothes_image,
                    folder=StorageFolder.CLOTHING,
                    tenant_id=tenant_id,
                    file_category='clothing',
                    skip_duplicate=skip_duplicate
                )
                clothes_urls.append(result['url'])
                duplicate_stats['clothes'].append(result['is_duplicate'])
                
                # 获取 content_key（格式: storage_type:md5）
                content_key = result.get('content_key', '')
                if content_key:
                    # 如果是纯 MD5（32位），转换为带前缀的 ContentKey
                    if len(content_key) == 32:
                        storage_type = ContentKeyPrefix.OSS if storage_service.is_oss else ContentKeyPrefix.LOCAL
                        clothes_keys.append(ContentKey.from_md5(content_key, storage_type))
                    else:
                        # 已经是 content_key 格式，直接使用
                        clothes_keys.append(content_key)
                else:
                    clothes_keys.append('')

            # 记录去重统计
            dup_count = sum(1 for d in duplicate_stats['clothes'] if d)
            if duplicate_stats['avatar'] or dup_count > 0:
                logger.info(
                    f"[TryOnService] MD5 去重: avatar={'命中' if duplicate_stats['avatar'] else '新上传'}, "
                    f"clothes={dup_count}/{len(clothes_images)} 命中缓存"
                )

            # 3. 转换为带签名的临时 URL (供 AI 引擎访问)
            signed_avatar_url = self._get_signed_url(avatar_url)
            signed_clothes_urls = [self._get_signed_url(url) for url in clothes_urls]

            logger.info(
                f"[TryOnService] 生成签名 URL: avatar={signed_avatar_url}, "
                f"clothes_count={len(signed_clothes_urls)}"
            )

            # 4. 调用 AI 引擎
            logger.info(f"[TryOnService] 调用 AI 引擎: {self.engine_name}")
            
            start_time = time.time()

            result = self.engine.submit_task(
                avatar_url=signed_avatar_url,
                clothing_urls=signed_clothes_urls,
                prompt=prompt,
                clothing_info=clothing_info,
                tenant_id=tenant_id,
                **kwargs
            )
            
            processing_time = time.time() - start_time

            # 5. 保存到数据库
            record = self._save_record(
                merchant_id=kwargs.get('merchant_id', 0),
                session_id=kwargs.get('session_id', ''),
                avatar_url=avatar_url,
                avatar_key=avatar_content_key,  # 人物照片存储 key
                avatar_source=avatar_source,  # 头像来源
                clothes_urls=clothes_urls,
                clothes_keys=clothes_keys,  # 服装图片存储 key 列表
                result=result,
                processing_time=processing_time,
                ip_address=kwargs.get('ip_address', ''),
                device_info=kwargs.get('device_info', ''),
                user_agent=kwargs.get('user_agent', ''),
                clothing_info=clothing_info,  # 服装详细信息
            )

            # 添加 URL 信息到返回结果
            result['avatar_url'] = avatar_url
            result['avatar_key'] = avatar_content_key  # 带前缀的 MD5 key (如 "local:xxx" 或 "oss:xxx")
            result['clothes_urls'] = clothes_urls
            result['clothes_keys'] = clothes_keys  # 服装的 image_key 列表（供前端复用）
            result['engine'] = self.engine_name
            result['duplicate_stats'] = duplicate_stats
            result['record_id'] = record.id if record else None
            result['record_uuid'] = record.uuid if record else None

            # 打印返回的 keys（供前端复用）
            logger.info(f"[TryOnService] 返回 avatar_key: {avatar_content_key}")
            logger.info(f"[TryOnService] 返回 clothes_keys: {clothes_keys}")
            logger.info(f"[TryOnService] 去重统计: avatar={'命中缓存' if duplicate_stats['avatar'] else '新上传'}, clothes={[('命中缓存' if d else '新上传') for d in duplicate_stats['clothes']]}")

            return result

        except OssException as e:
            logger.error(f"[TryOnService] OSS 错误: {e.internal_message}")
            raise  # 重新抛出，让异常处理器统一处理
        except AIEngineException as e:
            logger.error(f"[TryOnService] AI 引擎错误: {e.internal_message}")
            raise  # 重新抛出，让异常处理器统一处理
        except Exception as e:
            logger.exception(f"[TryOnService] 未知错误: {e}")
            return {
                'task_id': '',
                'success': False,
                'error_message': f'服务异常: {str(e)}',
                'result_url': '',
                'avatar_url': '',
                'clothes_urls': [],
                'duplicate_stats': duplicate_stats,
            }
    
    def _save_record(
            self,
            merchant_id: int,
            session_id: str,
            avatar_url: str,
            avatar_key: str,
            avatar_source: str,
            clothes_urls: List[str],
            clothes_keys: List[str],
            result: Dict[str, Any],
            processing_time: float,
            ip_address: str = '',
            device_info: str = '',
            user_agent: str = '',
            clothing_info: Optional[List[Dict]] = None,
    ) -> Optional[TryOnRecord]:
        """
        保存试穿记录到数据库

        Args:
            merchant_id: 商户 ID
            session_id: 会话 ID
            avatar_url: 人物照片 URL
            avatar_key: 人物照片存储 key
            avatar_source: 头像来源 (system/user/history)
            clothes_urls: 服装图片 URL 列表
            clothes_keys: 服装图片存储 key 列表
            result: AI 引擎返回结果
            processing_time: 处理耗时
            ip_address: IP 地址
            device_info: 设备信息
            user_agent: User Agent
            clothing_info: 服装信息列表，每项包含 name, category, subcategory, color 等

        Returns:
            TryOnRecord 实例
        """
        try:
            with transaction.atomic():
                # 确定状态
                # 如果返回了 task_id 且状态是 pending，说明是异步任务
                if result.get('success'):
                    if result.get('status') == 'pending' or result.get('task_id'):
                        status = TryOnRecord.Status.PROCESSING
                    else:
                        status = TryOnRecord.Status.COMPLETED
                else:
                    status = TryOnRecord.Status.FAILED

                # 确定引擎类型
                engine_map = {
                    'seeddance': TryOnRecord.AIEngine.SEEDDANCE,
                }
                ai_engine = engine_map.get(self.engine_name, TryOnRecord.AIEngine.SEEDDANCE)

                # 创建主记录
                record = TryOnRecord.objects.create(
                    merchant_id=merchant_id,
                    session_id=session_id,
                    avatar_url=avatar_url,
                    avatar_key=avatar_key,  # 人物照片存储 key
                    avatar_source=avatar_source,  # 头像来源
                    result_url=result.get('result_url', ''),  # 存储后的 URL
                    result_key=result.get('result_key', ''),  # 结果图存储 key
                    result_original_url=result.get('original_url', ''),  # AI 原始返回的 URL
                    status=status,
                    ai_engine=ai_engine,
                    task_id=result.get('task_id', ''),
                    error_message=result.get('error_message', '') or None,
                    processing_time=processing_time,
                    ip_address=ip_address,
                    device_info=device_info,
                    user_agent=user_agent,
                )

                # 创建服装关联记录
                logger.info(f"[_save_record] 开始保存服装信息: record_id={record.id}, clothes_count={len(clothes_urls)}, clothing_info_count={len(clothing_info) if clothing_info else 0}, clothing_info={clothing_info}")
                for i, clothing_url in enumerate(clothes_urls):
                    clothing_key = clothes_keys[i] if i < len(clothes_keys) else ''
                    # 获取服装详细信息
                    info = clothing_info[i] if clothing_info and i < len(clothing_info) else {}
                    logger.info(f"[_save_record] 保存服装 {i}: info={info}")
                    try:
                        tc = TryOnClothing.objects.create(
                            record_id=record.id,
                            clothing_id=info.get('uuid') or info.get('id') or f'custom_{i}',
                            is_custom=info.get('is_custom', True),
                            category=info.get('category', 'custom'),
                            subcategory=info.get('subcategory', 'custom'),
                            clothing_name=info.get('name') or info.get('clothing_name') or f'服装 {i + 1}',
                            clothing_color=info.get('color', ''),
                            clothing_image=clothing_url,
                            clothing_key=clothing_key,  # 服装图片存储 key
                        )
                        logger.info(f"[_save_record] 服装 {i} 保存成功: id={tc.id}")
                    except Exception as e:
                        logger.error(f"[_save_record] 服装 {i} 保存失败: {e}")

                logger.info(
                    f"[TryOnService] 记录已保存: record_id={record.id}, "
                    f"uuid={record.uuid}, status={status}"
                )

                return record

        except Exception as e:
            logger.error(f"[TryOnService] 保存记录失败: {e}")
            return None

    def query_status(self, task_id: str) -> Dict[str, Any]:
        """
        查询任务状态
        
        Args:
            task_id: 任务 ID
        
        Returns:
            任务状态信息
        """
        return self.engine.query_task_status(task_id)
    
    def query_task(self, task_id: str) -> Dict[str, Any]:
        """
        查询任务状态（别名，向后兼容）
        
        Args:
            task_id: 任务 ID
        
        Returns:
            任务状态信息
        """
        return self.query_status(task_id)
    
    def get_engine_info(self) -> Dict[str, Any]:
        """获取当前引擎信息"""
        if hasattr(self.engine, 'get_model_info'):
            return self.engine.get_model_info()
        return {
            'name': self.engine.name,
            'display_name': self.engine.display_name,
        }
    
    @staticmethod
    def get_available_engines() -> Dict[str, dict]:
        """获取所有可用引擎"""
        return AIEngineFactory.list_available_engines()


# 便捷函数
def create_tryon_task(
    avatar_image,
    clothes_images: list,
    tenant_id: str = '',
    engine: Optional[str] = None,
    **kwargs
) -> Dict[str, Any]:
    """
    创建试穿任务的便捷函数

    Args:
        avatar_image: 人物照片
        clothes_images: 服装图片列表
        tenant_id: 租户 ID（用于去重隔离）
        engine: 引擎名称
        **kwargs: 其他参数

    Returns:
        任务结果
    """
    service = TryOnService(engine_name=engine)
    return service.create_task(
        avatar_image=avatar_image,
        clothes_images=clothes_images,
        tenant_id=tenant_id,
        **kwargs
    )
