"""
一次性迁移：删除 file_records 表中已废弃的 is_public 列。

背景：本地存储通过 /static/uploads 统一暴露，is_public 标志从未生效；
模型/服务/调用方已移除该字段，此处清理数据库残留列。
幂等：列不存在则跳过。
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import inspect, text

from app.db import engine


async def main() -> None:
    async with engine.connect() as conn:
        columns = await conn.run_sync(
            lambda sync_conn: [
                c["name"] for c in inspect(sync_conn).get_columns("file_records")
            ]
        )
    if "is_public" not in columns:
        print("skip: file_records.is_public 列不存在，无需处理")
        return
    async with engine.begin() as conn:
        await conn.execute(text("ALTER TABLE file_records DROP COLUMN is_public"))
    print("done: 已删除 file_records.is_public 列")


if __name__ == "__main__":
    asyncio.run(main())
