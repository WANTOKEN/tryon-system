"""
Scan-to-upload routes - 扫码上传形象

流程：
  PC 端点击「扫码上传」 -> POST /scan/create/ (带 session_id)
    -> 返回 ticket_id + upload_url(手机端落地页) + qr_svg(二维码内嵌)
  PC 端展示二维码并轮询 GET /scan/status/{ticket_id}/
  手机扫码打开 upload_url -> 选图/拍照 -> POST /scan/upload/{ticket_id}/
    -> 后端校验 ticket 未过期，把图上传到该 session 的 avatar 区
  手机上传完成后 PC 端轮询到 uploaded=true，自动拉取 image_url 刷新形象
"""
import fcntl
import json
import os
import threading
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

import segno
from app.db import get_db
from app.api.deps import get_current_user
from app.models.merchant import Merchant
from app.storage.service import read_upload_file, upload_file
from app.core.config import get_settings

settings = get_settings()
router = APIRouter()

# 扫码票据跨进程共享存储（开发期可能同时跑多个后端进程/worker，
# 若放进程内存，PC 创建票据的进程与手机上传、轮询命中的进程可能是不同进程，
# 导致「ticket not found」404。改为磁盘 JSON + 文件锁，任一进程创建的票据其他进程都可见。）
TICKET_TTL_MINUTES = 30
_TICKET_TTL = timedelta(minutes=TICKET_TTL_MINUTES)
_STORE_PATH = Path(__file__).resolve().parent.parent.parent / "storage" / "scan_tickets.json"
_store_lock = threading.Lock()


def _parse_tickets(content: bytes) -> dict:
    try:
        raw = json.loads(content.decode("utf-8") or "{}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {}
    now = datetime.now()
    out = {}
    for tid, data in raw.items():
        try:
            ticket = dict(data)
            ticket["created_at"] = datetime.fromisoformat(data["created_at"])
            if now - ticket["created_at"] <= _TICKET_TTL:
                out[tid] = ticket
        except (TypeError, ValueError, KeyError):
            continue
    return out


def _serialize_tickets(tickets: dict) -> bytes:
    payload = {
        tid: {**t, "created_at": t["created_at"].isoformat()}
        for tid, t in tickets.items()
    }
    return json.dumps(payload, ensure_ascii=False).encode("utf-8")


def _with_store(mutate) -> object:
    """对票据存储执行『读-改-写』临界区：进程内线程锁，跨进程文件锁。"""
    with _store_lock:
        _STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
        fd = os.open(str(_STORE_PATH), os.O_RDWR | os.O_CREAT, 0o600)
        try:
            fcntl.flock(fd, fcntl.LOCK_EX)
            size = os.fstat(fd).st_size
            tickets = _parse_tickets(os.read(fd, size) if size else b"")
            result = mutate(tickets)
            os.lseek(fd, 0, os.SEEK_SET)
            os.ftruncate(fd, 0)
            os.write(fd, _serialize_tickets(tickets))
            os.fsync(fd)
        finally:
            fcntl.flock(fd, fcntl.LOCK_UN)
            os.close(fd)
    return result


class ScanCreateRequest(BaseModel):
    session_id: str
    type: Literal["avatar", "clothing"] = "avatar"


class ScanCreateResponse(BaseModel):
    ticket_id: str
    upload_url: str
    qr_svg: str


class ScanStatusResponse(BaseModel):
    uploaded: bool
    image_key: Optional[str] = None
    image_url: Optional[str] = None


class ScanUploadResponse(BaseModel):
    image_key: str
    image_url: str


def _build_upload_url(ticket_id: str) -> str:
    """手机端扫码落地区域 URL（前端 SPA 路由，带 ticket 参数）"""
    base = (settings.frontend_base_url or "").rstrip("/")
    return f"{base}/scan-upload?ticket={ticket_id}"


@router.post("/create/")
async def create_scan_ticket(
    payload: ScanCreateRequest,
    current_user: Merchant = Depends(get_current_user),
) -> ScanCreateResponse:
    """创建扫码上传票据，返回二维码（SVG 内嵌）。需登录：仅 PC 端商户可建票。"""
    session_id = payload.session_id
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    ticket_id = uuid.uuid4().hex
    new_ticket = {
        "session_id": session_id,
        "merchant_id": str(current_user.id),
        "type": payload.type,
        "created_at": datetime.now(),
        "uploaded": False,
        "image_key": None,
        "image_url": None,
    }

    def _store(tickets):
        tickets[ticket_id] = new_ticket

    _with_store(_store)

    upload_url = _build_upload_url(ticket_id)
    qr = segno.make(upload_url, error='m')
    qr_svg = qr.svg_data_uri()

    return ScanCreateResponse(
        ticket_id=ticket_id,
        upload_url=upload_url,
        qr_svg=qr_svg,
    )


@router.get("/status/{ticket_id}/")
async def scan_ticket_status(ticket_id: str) -> ScanStatusResponse:
    """PC 端轮询：手机是否已上传完成"""
    ticket = _with_store(lambda ts: ts.get(ticket_id))
    if not ticket:
        raise HTTPException(status_code=404, detail="ticket not found or expired")
    return ScanStatusResponse(
        uploaded=ticket["uploaded"],
        image_key=ticket.get("image_key"),
        image_url=ticket.get("image_url"),
    )


@router.post("/upload/{ticket_id}/")
async def scan_upload_avatar(
    ticket_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> ScanUploadResponse:
    """手机端免登录上传：原子校验+占位 ticket，再分块读取上传，绑定到对应 session"""

    def _claim(tickets):
        t = tickets.get(ticket_id)
        if not t:
            return {"status": "missing"}
        if datetime.now() - t["created_at"] > _TICKET_TTL:
            tickets.pop(ticket_id, None)
            return {"status": "expired"}
        if t["uploaded"]:
            return {"status": "conflict"}
        t["uploaded"] = True  # 原子占位，避免并发重复上传
        return {"status": "ok", "type": t.get("type"), "session_id": t.get("session_id")}

    claim = _with_store(_claim)
    claim_status = claim["status"]
    if claim_status == "expired":
        raise HTTPException(status_code=410, detail="ticket expired")
    if claim_status == "missing":
        raise HTTPException(status_code=404, detail="ticket not found or expired")
    if claim_status == "conflict":
        raise HTTPException(status_code=409, detail="already uploaded")

    # tenant_id 用 session_id 隔离（顾客维度），而非 merchant
    is_clothing = claim.get("type") == "clothing"
    tenant_id = claim.get("session_id") or ticket_id
    try:
        content = await read_upload_file(file, require_image=True)
        rec, url = await upload_file(
            db,
            content,
            folder="clothing" if is_clothing else "avatars",
            tenant_id=tenant_id,
            content_type=file.content_type or "image/png",
            file_category="clothing" if is_clothing else "avatar",
        )
    except Exception:
        # 上传失败则释放占位，允许用户重试
        def _release(tickets):
            if ticket_id in tickets:
                tickets[ticket_id]["uploaded"] = False

        _with_store(_release)
        raise

    def _mark(tickets):
        if ticket_id in tickets:
            tickets[ticket_id]["image_key"] = rec.uuid
            tickets[ticket_id]["image_url"] = url

    _with_store(_mark)

    return ScanUploadResponse(image_key=rec.uuid, image_url=url)
