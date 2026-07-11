"""
测试配置：强制使用独立的临时 SQLite 库，避免运行 pytest 时依赖外部数据库，
也避免复用本地 test.db 的旧 schema 导致建表遗漏。

必须在导入 app 之前设置 DATABASE_URL，因此放在 conftest 顶层。
"""
import os
import tempfile

_db_fd, _db_path = tempfile.mkstemp(suffix=".db")
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_db_path}"

# 清空配置缓存，确保 get_settings() 读取到上面的环境变量
from app.core.config import get_settings

get_settings.cache_clear()


def pytest_sessionfinish(session, exitstatus):
    """测试结束后清理临时数据库文件。"""
    try:
        os.close(_db_fd)
    except OSError:
        pass
    if os.path.exists(_db_path):
        os.remove(_db_path)
