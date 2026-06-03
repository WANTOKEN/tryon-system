import os
import logging
from typing import Tuple, BinaryIO

from apps.common.utils.content_key import ContentKey
from apps.common.exceptions import StorageException

from .base import BaseStorageService

logger = logging.getLogger("storage")


class LocalStorageBackend(BaseStorageService):
    """本地文件存储后端"""

    storage_type = "local"

    def __init__(self):
        super().__init__()
        from django.conf import settings

        self.media_root = getattr(settings, "MEDIA_ROOT", "media")
        self.media_url = getattr(settings, "MEDIA_URL", "/media/")
        self.enabled = True
        logger.info(f"[LocalStorage] 初始化成功: media_root={self.media_root}")

    def _ensure_dir(self, filepath: str):
        os.makedirs(os.path.dirname(filepath), exist_ok=True)

    def _generate_filename(self, folder: str, md5: str, ext: str = ".png") -> str:
        return f"{folder}/{md5}{ext}"

    def upload_file(
        self,
        file_obj: BinaryIO,
        filename: str = "image.png",
        folder: str = "uploads",
        tenant_id: str = "",
        content_type: str = "image/png",
        file_category: str = "other",
        skip_duplicate: bool = True,
        ref_type: str = "",
        ref_id: str = "",
        source: str = "",
        client_ip: str = "",
        is_public: bool = False,
    ) -> Tuple[str, str, bool, str]:
        try:
            if hasattr(file_obj, "seek"):
                file_obj.seek(0)
            content = file_obj.read()

            ext = self._validate_upload(content, filename, content_type)
            md5 = self._calculate_md5(content)

            if skip_duplicate and tenant_id:
                cached = self._check_duplicate(md5, tenant_id)
                if cached:
                    return cached

            relative_path = self._generate_filename(folder, md5, ext)
            full_path = os.path.join(self.media_root, relative_path)

            self._ensure_dir(full_path)

            with open(full_path, "wb") as f:
                f.write(content)

            base_url = os.getenv("BACKEND_URL", "http://localhost:8888")
            url = f"{base_url.rstrip('/')}{self.media_url}{relative_path.replace(os.sep, '/')}"

            file_id = ""
            if tenant_id:
                record = self._save_record(
                    md5=md5,
                    storage_key=relative_path,
                    access_url=url,
                    folder=folder,
                    tenant_id=tenant_id,
                    file_category=file_category,
                    file_size=len(content),
                    content_type=content_type,
                    file_ext=ext,
                    is_public=is_public,
                )
                if record:
                    file_id = str(record.id)

            logger.info(f"[LocalStorage] 文件已保存: {relative_path}, MD5={md5}")
            content_key = ContentKey.from_md5(md5, "local")
            return relative_path, url, False, content_key, file_id

        except Exception as e:
            logger.error(f"[LocalStorage] 上传失败: {e}")
            raise StorageException(f"本地存储上传失败: {str(e)}")

    def get_url(self, key: str) -> str:
        return f"{self.media_url}{key.replace(os.sep, '/')}"

    def get_signed_url(self, key: str, expires: int = 3600) -> str:
        base_url = os.getenv("BACKEND_URL", "http://localhost:8888")
        return f"{base_url.rstrip('/')}{self.get_url(key)}"

    def delete_file(self, key: str) -> bool:
        try:
            filepath = os.path.join(self.media_root, key)
            if os.path.exists(filepath):
                os.remove(filepath)
                logger.info(f"[LocalStorage] 文件删除成功: {key}")
                return True
            logger.warning(f"[LocalStorage] 文件不存在: {key}")
            return False
        except Exception as e:
            logger.error(f"[LocalStorage] 删除失败: {key}, error={e}")
            return False
