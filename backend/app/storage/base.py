"""
存储后端抽象接口

所有存储后端必须实现 upload / get_access_url / delete。
返回给前端的永远是「可访问 URL」，本地模式下即 /static/uploads 下的服务器地址。
"""
from abc import ABC, abstractmethod


class StorageBackend(ABC):
    @abstractmethod
    async def upload(self, content: bytes, storage_key: str, content_type: str, is_public: bool) -> str:
        """上传内容，返回可访问 URL"""
        raise NotImplementedError

    @abstractmethod
    def get_access_url(self, storage_key: str, is_public: bool, expires: int = 3600) -> str:
        """根据 storage_key 返回可访问 URL"""
        raise NotImplementedError

    @abstractmethod
    async def delete(self, storage_key: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    async def read(self, storage_key: str) -> bytes:
        """读取文件内容（供试穿引擎使用）"""
        raise NotImplementedError
