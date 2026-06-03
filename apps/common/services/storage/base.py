import os
import hashlib
import logging
from abc import ABC, abstractmethod
from typing import Optional, Tuple, BinaryIO

logger = logging.getLogger("storage")


class StorageBackend(ABC):
    """存储后端抽象接口"""

    @abstractmethod
    def upload_file(
        self,
        file_obj: BinaryIO,
        filename: str = "image.png",
        folder: str = "uploads",
        tenant_id: str = "",
        content_type: str = "image/png",
        file_category: str = "other",
        skip_duplicate: bool = True,
        is_public: bool = False,
    ) -> Tuple[str, str, bool, str, str]:
        pass

    @abstractmethod
    def get_url(self, key: str) -> str:
        pass

    @abstractmethod
    def get_signed_url(self, key: str, expires: int = 3600) -> str:
        pass

    @abstractmethod
    def delete_file(self, key: str) -> bool:
        pass

    @property
    @abstractmethod
    def storage_type(self) -> str:
        pass


class BaseStorageService(StorageBackend):
    """存储服务基类，提供通用功能"""

    def __init__(self):
        self._record_model = None

    def _validate_upload(self, content: bytes, filename: str, content_type: str) -> str:
        from apps.common.constants import FileSizeLimit, ErrorMessage
        from apps.common.services.upload_config import UploadValidationError

        file_size = len(content)
        if file_size > FileSizeLimit.MAX_FILE_SIZE:
            raise UploadValidationError(
                f"{ErrorMessage.FILE_TOO_LARGE}（最大 {FileSizeLimit.MAX_FILE_SIZE // 1024 // 1024}MB，当前 {file_size // 1024 // 1024}MB）"
            )

        if file_size == 0:
            raise UploadValidationError(ErrorMessage.FILE_EMPTY)

        ext = self._get_extension(content_type, filename)
        return ext

    def _get_extension(self, content_type: str, filename: str) -> str:
        from apps.common.constants import FileType, FileExtension, ErrorMessage

        if FileType.is_supported(content_type):
            return FileType.get_extension(content_type)

        ext = os.path.splitext(filename)[1].lower()
        if not FileExtension.is_supported(ext):
            from apps.common.services.upload_config import UploadValidationError

            raise UploadValidationError(
                f'{ErrorMessage.FILE_TYPE_NOT_SUPPORTED}，仅支持：{", ".join(FileExtension.ALL)}'
            )
        return ext

    def _check_duplicate(self, md5: str, tenant_id: str) -> Optional[Tuple[str, str, bool, str, str]]:
        try:
            FileRecord = self._get_record_model()
            record = FileRecord.get_by_md5(md5, tenant_id=tenant_id, storage_type=self.storage_type)
            if record:
                from apps.common.utils.content_key import ContentKey
                content_key = ContentKey.from_md5(md5, self.storage_type)
                return record.storage_key, record.access_url, True, content_key, str(record.id)
        except Exception as e:
            logger.warning(f"查询重复文件失败: {e}")
        return None

    def _save_record(self, **kwargs):
        try:
            FileRecord = self._get_record_model()
            kwargs["storage_type"] = self.storage_type
            # 参数名转换：md5 -> md5_hash
            if "md5" in kwargs:
                kwargs["md5_hash"] = kwargs.pop("md5")
            # 移除不需要的字段
            kwargs.pop("ref_type", None)
            kwargs.pop("ref_id", None)
            kwargs.pop("source", None)
            kwargs.pop("client_ip", None)
            kwargs.pop("hit_count", None)
            kwargs.pop("signed_url", None)
            kwargs.pop("signed_url_expires", None)
            # 生成带存储类型标识的 file_id
            from apps.common.utils.file_id_utils import generate_file_id
            custom_id = generate_file_id(self.storage_type)
            record = FileRecord.objects.create(id=custom_id, **kwargs)
            return record
        except Exception as e:
            logger.warning(f"保存记录失败: {e}")
            return None

    def _get_record_model(self):
        if not self._record_model:
            from apps.common.models import FileRecord

            self._record_model = FileRecord
        return self._record_model

    def _calculate_md5(self, content: bytes) -> str:
        return hashlib.md5(content).hexdigest()

    def upload_from_base64(
        self,
        base64_data: str,
        folder: str = "uploads",
        tenant_id: str = "",
        content_type: str = "image/png",
        file_category: str = "other",
        skip_duplicate: bool = True,
        is_public: bool = False,
    ) -> Tuple[str, str, bool, str, str]:
        import base64
        from io import BytesIO

        if base64_data.startswith("data:"):
            header, base64_data = base64_data.split(",", 1)
            if "image/" in header:
                content_type = header.split(":")[1].split(";")[0]

        content = base64.b64decode(base64_data)

        default_ext = self._get_extension(content_type, "image.png")
        filename = f"base64_upload{default_ext}"

        file_obj = BytesIO(content)
        return self.upload_file(
            file_obj=file_obj,
            filename=filename,
            folder=folder,
            tenant_id=tenant_id,
            content_type=content_type,
            file_category=file_category,
            skip_duplicate=skip_duplicate,
            is_public=is_public,
        )

    def get_signed_url_from_url(self, url: str, expires: int = 3600) -> str:
        if not url:
            return url

        if url.startswith("http://") or url.startswith("https://"):
            if "OSSAccessKeyId" in url or "Signature" in url:
                return url

            key = self._extract_key_from_url(url)
            if key:
                return self.get_signed_url(key, expires)
            return url

        return self.get_signed_url(url, expires)

    def _extract_key_from_url(self, url: str) -> Optional[str]:
        try:
            from urllib.parse import urlparse, unquote

            parsed = urlparse(url)
            path = parsed.path.lstrip("/")
            return unquote(path) if path else None
        except Exception:
            return None

    def delete_files(self, files: list) -> dict:
        deleted = 0
        failed = 0
        details = []

        for f in files:
            storage_key = f["storage_key"]
            if self.delete_file(storage_key):
                deleted += 1
                details.append({"key": storage_key, "success": True})
            else:
                failed += 1
                details.append({"key": storage_key, "success": False})

        return {"deleted": deleted, "failed": failed, "details": details}
