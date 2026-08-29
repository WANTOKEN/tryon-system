"""
本地文件系统存储后端

开发/演示零依赖：文件写入 storage_local_dir，通过 /static/uploads 暴露。
对外可访问 URL = f"{storage_public_base}/{storage_key}"
"""
import os

from app.storage.base import StorageBackend
from app.core.config import get_settings

settings = get_settings()


class LocalStorageBackend(StorageBackend):
    def __init__(self) -> None:
        self.root = settings.storage_local_dir
        os.makedirs(self.root, exist_ok=True)

    async def upload(self, content: bytes, storage_key: str, content_type: str) -> str:
        dest = os.path.join(self.root, storage_key)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "wb") as f:
            f.write(content)
        return f"{settings.storage_public_base}/{storage_key}"

    def get_access_url(self, storage_key: str, expires: int = 3600) -> str:
        return f"{settings.storage_public_base}/{storage_key}"

    async def delete(self, storage_key: str) -> bool:
        dest = os.path.join(self.root, storage_key)
        if os.path.exists(dest):
            os.remove(dest)
            return True
        return False

    async def read(self, storage_key: str) -> bytes:
        dest = os.path.join(self.root, storage_key)
        with open(dest, "rb") as f:
            return f.read()
