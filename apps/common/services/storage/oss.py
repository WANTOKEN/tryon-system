import os
import logging
from typing import Tuple, BinaryIO

import oss2

from apps.common.utils.content_key import ContentKey
from apps.common.exceptions import OssException

from .base import BaseStorageService

logger = logging.getLogger("oss")


class OSSStorageBackend(BaseStorageService):
    """阿里云 OSS 存储后端"""

    storage_type = "oss"

    def __init__(self):
        super().__init__()
        self.access_key_id = os.getenv("OSS_ACCESS_KEY_ID", "")
        self.access_key_secret = os.getenv("OSS_ACCESS_KEY_SECRET", "")
        self.bucket_name = os.getenv("OSS_BUCKET_NAME", "")
        self.endpoint = os.getenv("OSS_ENDPOINT", "oss-cn-shanghai.aliyuncs.com")
        self.domain = os.getenv("OSS_DOMAIN", "")
        self.public_read = os.getenv("OSS_PUBLIC_READ", "false").lower() == "true"

        self._auth = None
        self._bucket = None
        self.enabled = self._check_config()

        if self.enabled:
            self._init_client()

    def _check_config(self) -> bool:
        if not all([self.access_key_id, self.access_key_secret, self.bucket_name]):
            logger.warning(
                "[OSS] 配置不完整，OSS 服务不可用。"
                f"ACCESS_KEY_ID={'已配置' if self.access_key_id else '缺失'}, "
                f"ACCESS_KEY_SECRET={'已配置' if self.access_key_secret else '缺失'}, "
                f"BUCKET_NAME={'已配置' if self.bucket_name else '缺失'}"
            )
            return False
        return True

    def _init_client(self):
        try:
            self._auth = oss2.Auth(self.access_key_id, self.access_key_secret)
            self._bucket = oss2.Bucket(self._auth, self.endpoint, self.bucket_name)
            logger.info(f"[OSS] 初始化成功: bucket={self.bucket_name}, endpoint={self.endpoint}")
        except Exception as e:
            logger.error(f"[OSS] 初始化失败: {e}")
            self.enabled = False

    @property
    def bucket(self) -> oss2.Bucket:
        if not self.enabled:
            raise OssException("OSS 服务不可用，请检查配置")
        return self._bucket

    def _generate_file_key(self, folder: str, filename: str, md5: str) -> str:
        ext = os.path.splitext(filename)[1] or ".jpg"
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
    ) -> Tuple[str, str, bool, str, str]:
        if not self.enabled:
            raise OssException("OSS 服务不可用")

        try:
            if hasattr(file_obj, "tell"):
                original_pos = file_obj.tell()
                file_obj.seek(0)
            content = file_obj.read()

            self._validate_upload(content, filename, content_type)
            md5 = self._calculate_md5(content)

            if skip_duplicate and tenant_id:
                cached = self._check_duplicate(md5, tenant_id)
                if cached:
                    return cached

            oss_key = self._generate_file_key(folder, filename, md5)

            headers = {
                "x-oss-meta-md5": md5,
                "Cache-Control": "public, max-age=31536000, immutable",
                "Expires": "Thu, 31 Dec 2026 23:59:59 GMT",
            }
            if content_type:
                headers["Content-Type"] = content_type

            result = self.bucket.put_object(oss_key, content, headers=headers)

            if result.status != 200:
                raise OssException(f"OSS 上传失败: HTTP {result.status}")

            public_url = self.get_url(oss_key)
            file_id = ""

            if tenant_id:
                record = self._save_record(
                    md5=md5,
                    storage_key=oss_key,
                    access_url=public_url,
                    folder=folder,
                    tenant_id=tenant_id,
                    file_category=file_category,
                    file_size=len(content),
                    content_type=content_type,
                    is_public=is_public,
                )
                if record:
                    file_id = str(record.id)

            logger.info(f"[OSS] 上传成功 | key={oss_key} | size={len(content)}bytes | md5={md5}")

            content_key = ContentKey.from_md5(md5, "oss")
            return oss_key, public_url, False, content_key, file_id

        except Exception as e:
            logger.error(f"[OSS] 上传失败: {e}")
            raise OssException(f"OSS 上传失败: {str(e)}")

    def get_url(self, key: str) -> str:
        from urllib.parse import unquote

        key = unquote(key)

        if self.domain:
            return f"https://{self.domain}/{key}"
        else:
            return f"https://{self.bucket_name}.{self.endpoint}/{key}"

    def get_signed_url(self, key: str, expires: int = 3600) -> str:
        if not self.enabled:
            raise OssException("OSS 服务不可用")

        from urllib.parse import unquote

        key = unquote(key)

        if self.public_read:
            return self.get_url(key)

        url = self.bucket.sign_url("GET", key, expires)
        if url.startswith("http://"):
            url = "https://" + url[7:]

        return url

    def delete_file(self, key: str) -> bool:
        if not self.enabled:
            return False

        try:
            self.bucket.delete_object(key)
            logger.info(f"[OSS] 文件删除成功: key={key}")
            return True
        except oss2.exceptions.OssError as e:
            logger.error(f"[OSS] 删除失败: key={key}, error={e}")
            return False

    def get_thumb_url(
        self, key: str, width: int = 200, height: int = 200, mode: str = "fill", quality: int = 80, format: str = "webp"
    ) -> str:
        base_url = self.get_url(key)

        process_params = f"image/resize,m_{mode},h_{height},w_{width}"

        if quality:
            process_params += f"/quality,q_{quality}"

        if format:
            process_params += f"/format,{format}"

        return f"{base_url}?x-oss-process={process_params}"

    def get_signed_thumb_url(
        self,
        key: str,
        width: int = 200,
        height: int = 200,
        mode: str = "fill",
        quality: int = 80,
        format: str = "webp",
        expires: int = 86400,
    ) -> str:
        signed_url = self.get_signed_url(key, expires)

        process_params = f"image/resize,m_{mode},h_{height},w_{width}"

        if quality:
            process_params += f"/quality,q_{quality}"

        if format:
            process_params += f"/format,{format}"

        return f"{signed_url}&x-oss-process={process_params}"
