"""
Database connection and session management
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.config import get_settings
from app.models.base import Base  # 复用模型基类，确保 create_all 能建出所有表

settings = get_settings()

# 根据方言选择连接参数
if settings.database_url.startswith("sqlite"):
    engine = create_async_engine(
        settings.database_url,
        echo=settings.db_echo,
        connect_args={"check_same_thread": False},
    )
elif settings.database_url.startswith("mysql"):
    # MySQL 8：注意 pool_pre_ping 在 sqlalchemy 2.0.35 + aiomysql 0.2.0 下会触发
    # aiomysql ping(reconnect) 签名不兼容 bug，故关闭；改用 pool_recycle 回收失效连接。
    engine = create_async_engine(
        settings.database_url,
        echo=settings.db_echo,
        pool_size=10,
        max_overflow=20,
        pool_recycle=3600,
    )
else:
    engine = create_async_engine(
        settings.database_url,
        echo=settings.db_echo,
        pool_size=10,
        max_overflow=20,
    )

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncSession:
    """Dependency to get database session"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
