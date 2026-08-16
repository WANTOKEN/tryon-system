"""
TryOn service - 虚拟试穿服务

- generate(): 创建试穿记录（pending），解析人像，异步驱动生成任务
- 后台任务: 调用引擎产出结果图 -> 落库 -> 回写 result_url / status=completed
- 状态机: pending -> processing -> completed | failed
"""
import asyncio
import logging
import time
from typing import List, Optional, Set

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import AsyncSessionLocal
from app.core.config import get_settings
from app.models.tryon_record import TryOnRecord
from app.models.file_record import FileRecord
from app.storage import storage
from app.storage.service import upload_file
from app.services.tryon_engine import get_engine

settings = get_settings()
logger = logging.getLogger(__name__)

# 进程内后台任务引用集合：避免任务被 GC 回收导致静默丢失，便于追踪
_running_tasks: Set[asyncio.Task] = set()


def _track_task(task: asyncio.Task) -> None:
    """登记后台任务并在结束后自动移除，同时记录未捕获异常"""
    _running_tasks.add(task)
    task.add_done_callback(_running_tasks.discard)
    task.add_done_callback(
        lambda t: logger.error("试穿后台任务异常: %s", t.exception())
        if t.exception() else None
    )


async def _read_avatar_bytes(avatar_key: Optional[str], avatar_data: Optional[bytes]) -> bytes:
    """优先使用上传的字节；否则按 avatar_key 从 FileRecord 读取"""
    if avatar_data:
        return avatar_data
    if avatar_key:
        rec = (
            await _db_scalar(select(FileRecord).where(FileRecord.uuid == avatar_key))
        )
        if rec:
            return await storage.read(rec.storage_key)
    raise ValueError("缺少人像（请上传或提供 avatar_key）")


async def _db_scalars(stmt):
    async with AsyncSessionLocal() as db:
        return (await db.execute(stmt)).scalars().all()


async def _read_clothing_items(clothing_uuids: Optional[List[str]]) -> List[dict]:
    """按 uuid 列表从 FileRecord 读取服装图字节流，供多图融合使用"""
    if not clothing_uuids:
        return []
    recs = await _db_scalars(
        select(FileRecord).where(FileRecord.uuid.in_(clothing_uuids))
    )
    items: List[dict] = []
    for rec in recs:
        try:
            data = await storage.read(rec.storage_key)
        except Exception:  # noqa: BLE001
            continue
        items.append(
            {"uuid": rec.uuid, "name": rec.original_name or "", "image_bytes": data}
        )
    return items


async def _db_scalar(stmt):
    async with AsyncSessionLocal() as db:
        return (await db.execute(stmt)).scalar_one_or_none()


async def generate(
    db: AsyncSession,
    merchant_id: str,
    session_id: str,
    avatar_data: Optional[bytes] = None,
    avatar_url: Optional[str] = None,
    avatar_key: Optional[str] = None,
    avatar_source: str = "user",
    clothing_uuids: Optional[List[str]] = None,
    ai_engine: str = "mock",
    prompt: Optional[str] = None,
) -> TryOnRecord:
    """创建试穿任务并启动后台生成"""
    clothing_uuids = clothing_uuids or []

    record = TryOnRecord(
        merchant_id=merchant_id,
        session_id=session_id,
        avatar_source=avatar_source,
        status="pending",
        ai_engine=ai_engine,
        selected_clothing=clothing_uuids,
    )
    if avatar_url:
        record.avatar_url = avatar_url

    # 若前端传入 avatar_key（FileRecord uuid），解析并落库，便于历史记录复用
    if avatar_key:
        avatar_rec = (
            await db.execute(select(FileRecord).where(FileRecord.uuid == avatar_key))
        ).scalar_one_or_none()
        if avatar_rec:
            record.avatar_file_id = avatar_rec.id
            record.avatar_url = avatar_rec.access_url

    db.add(record)
    await db.flush()
    await db.refresh(record)
    rec_uuid = record.uuid
    await db.commit()

    # 后台驱动生成（开发/演示用进程内任务；生产可换 Celery）
    task = asyncio.create_task(
        _process(
            record_uuid=rec_uuid,
            avatar_data=avatar_data,
            avatar_key=avatar_key,
            clothing_uuids=clothing_uuids,
            prompt=prompt,
        )
    )
    _track_task(task)
    return record


async def _process(*, record_uuid: str, avatar_data: Optional[bytes], avatar_key: Optional[str], clothing_uuids: List[str], prompt: Optional[str] = None):
    async with AsyncSessionLocal() as db:
        record = None
        try:
            record = (
                await db.execute(select(TryOnRecord).where(TryOnRecord.uuid == record_uuid))
            ).scalar_one_or_none()
            if not record:
                return

            record.status = "processing"
            await db.commit()

            avatar_bytes = await _read_avatar_bytes(avatar_key, avatar_data)
            clothing_items = await _read_clothing_items(clothing_uuids)
            engine = get_engine()
            result_bytes = await engine.generate(avatar_bytes, clothing_items, prompt)

            # 落库结果图
            tenant_id = str(record.merchant_id)
            rec, url = await upload_file(
                db,
                result_bytes,
                folder="results",
                tenant_id=tenant_id,
                content_type="image/png",
                file_category="result",
            )
            record.result_file_id = rec.id
            record.result_url = url
            record.status = "completed"
            record.status_text = "已完成"
            record.duration_ms = int((time.time() - record.created_at.timestamp()) * 1000) if record.created_at else 0
            await db.commit()
        except Exception as e:  # noqa: BLE001
            logger.exception("试穿任务 %s 处理失败", record_uuid)
            if record is not None:
                record.status = "failed"
                record.status_text = "生成失败"
                record.error_message = str(e)
                await db.commit()


async def get_status(db: AsyncSession, record_uuid: str) -> Optional[TryOnRecord]:
    stmt = select(TryOnRecord).where(TryOnRecord.uuid == record_uuid)
    return (await db.execute(stmt)).scalar_one_or_none()


async def list_records(db: AsyncSession, merchant_id: str, page: int = 1, page_size: int = 20):
    from sqlalchemy import func

    stmt = select(TryOnRecord).where(TryOnRecord.merchant_id == merchant_id)
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar()
    stmt = stmt.order_by(TryOnRecord.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    items = (await db.execute(stmt)).scalars().all()
    return items, total
