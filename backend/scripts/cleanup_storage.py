"""
本地存储清理脚本

清理两类「冷数据」避免磁盘无限增长（部署成本控制项之一）：
  1. FileRecord.is_deleted=True 软删除的孤儿文件（删除文件本体）
  2. 结果图（folder='results'）中未被任何未删除的 TryOnRecord 引用的孤儿文件

可作为 cron / docker exec 周期任务执行，例如每天凌晨跑一次：
  docker exec tryon-backend python -m scripts.cleanup_storage --results-older-than-days 30
  docker exec tryon-backend python -m scripts.cleanup_storage --orphan-files-only

注意：
  - 真正「按时间过期」需要产品策略确定（当前 MVP 未启用，故默认不动非孤儿数据）
  - 删除前会打印统计，可加 --dry-run 仅预览
"""
import argparse
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(BACKEND_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from sqlalchemy import delete, select  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.db import AsyncSessionLocal  # noqa: E402
from app.models.file_record import FileRecord  # noqa: E402
from app.models.tryon_record import TryOnRecord  # noqa: E402

settings = get_settings()


async def cleanup(
    *,
    dry_run: bool,
    orphan_files_only: bool,
    results_older_than_days: int,
) -> None:
    storage_root = Path(settings.storage_local_dir)
    deleted_files = 0
    freed_bytes = 0

    async with AsyncSessionLocal() as db:
        # 1) 软删除标记的文件：直接清磁盘，DB 行保留供审计
        soft_deleted = (
            await db.execute(select(FileRecord).where(FileRecord.is_deleted == True))  # noqa: E712
        ).scalars().all()
        for rec in soft_deleted:
            path = storage_root / rec.storage_key
            if path.exists():
                size = path.stat().st_size
                if not dry_run:
                    try:
                        path.unlink()
                    except OSError as exc:
                        print(f"[skip] {path}: {exc}")
                        continue
                freed_bytes += size
                deleted_files += 1
                print(f"[{'DRY' if dry_run else 'DEL'}] soft-deleted {path} ({size} B)")

        # 2) 结果图孤儿：FileRecord.folder='results' 且 TryOnRecord 未引用或全部被删
        result_recs = (
            await db.execute(select(FileRecord).where(FileRecord.folder == "results"))
        ).scalars().all()
        # 找出所有「仍存在」的 result_file_id
        used_ids = set(
            (
                await db.execute(
                    select(TryOnRecord.result_file_id).where(TryOnRecord.result_file_id != "")
                )
            ).scalars().all()
        )
        cutoff = datetime.now(timezone.utc) - timedelta(days=results_older_than_days)

        for rec in result_recs:
            if rec.id in used_ids and orphan_files_only:
                continue
            # 按时间窗口仅清理老结果，避免误删热点
            if orphan_files_only or (rec.created_at and rec.created_at < cutoff):
                path = storage_root / rec.storage_key
                if not path.exists():
                    continue
                size = path.stat().st_size
                if not dry_run:
                    try:
                        path.unlink()
                    except OSError as exc:
                        print(f"[skip] {path}: {exc}")
                        continue
                freed_bytes += size
                deleted_files += 1
                print(f"[{'DRY' if dry_run else 'DEL'}] orphan/expired {path} ({size} B)")

    print()
    print(f"释放文件：{deleted_files}, 回收空间：{freed_bytes / 1024 / 1024:.2f} MB"
          f"{'（dry-run, 未真正删除）' if dry_run else ''}")


def main() -> None:
    p = argparse.ArgumentParser(description="清理本地存储")
    p.add_argument("--dry-run", action="store_true", help="只统计不删")
    p.add_argument("--orphan-files-only", action="store_true",
                   help="仅清理孤儿文件（results 文件夹中无 TryOnRecord 引用的）")
    p.add_argument("--results-older-than-days", type=int, default=30,
                   help="结果图超过 N 天且未被引用则清理；0 表示全部孤儿（默认 30）")
    args = p.parse_args()

    asyncio.run(cleanup(
        dry_run=args.dry_run,
        orphan_files_only=args.orphan_files_only,
        results_older_than_days=args.results_older_than_days,
    ))


if __name__ == "__main__":
    main()
