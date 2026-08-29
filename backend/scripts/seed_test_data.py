"""
一次性测试数据种子脚本（开发/功能测试用）

功能：
  1. 创建一个商家测试账号（密码 bcrypt 哈希）
  2. 从网络下载公开服装图片，落到本地 storage 目录并写入 FileRecord
  3. 写入若干条 clothing 服装数据，关联到该商家

运行方式（从 backend 目录，使用项目根 .venv）：
  cd backend && ../.venv/bin/python scripts/seed_test_data.py

注意：
  - 数据库配置取自 backend/.env 的 DATABASE_URL（mysql+aiomysql://...）
  - 图片通过 app.storage.service.upload_file 落盘，access_url 形如 /static/uploads/...
  - 本脚本为临时测试工具，功能测试完成后可删除
"""
import asyncio
import os
import sys

# 确保从 backend 目录加载 .env（DATABASE_URL 等）
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(BACKEND_DIR)
# 将 backend 目录加入模块搜索路径，确保可 import app.*
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import bcrypt
import httpx
from sqlalchemy import select

from app.core.config import get_settings
from app.db.database import AsyncSessionLocal
from app.models.merchant import Merchant
from app.models.clothing import Clothing
from app.models.file_record import FileRecord
from app.storage.service import upload_file

settings = get_settings()

# ===== 测试商家账号 =====
MERCHANT_USERNAME = "test_merchant"
MERCHANT_PHONE = "13900000001"
MERCHANT_PASSWORD = "test123456"
MERCHANT_STORE = "测试服装店"

# ===== 网络服装图片（公开稳定源，失败跳过） =====
# 每条：名称 + 图片 URL + 服装属性
CLOTHING_SPECS = [
    {
        "name": "白色纯棉圆领T恤",
        "url": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80",
        "category": "top", "color": "白色", "size": "M", "brand": "DemoBrand",
        "season": "夏", "style": "休闲", "material": "纯棉", "price": 89.0,
        "description": "舒适透气基础款圆领短袖T恤",
    },
    {
        "name": "蓝色牛仔外套",
        "url": "https://images.unsplash.com/photo-1551537482-f2075a1d41f2?w=600&q=80",
        "category": "coat", "color": "蓝色", "size": "L", "brand": "DemoBrand",
        "season": "春秋", "style": "复古", "material": "牛仔布", "price": 299.0,
        "description": "经典水洗牛仔夹克，百搭外套",
    },
    {
        "name": "黑色修身西裤",
        "url": "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=600&q=80",
        "category": "pants", "color": "黑色", "size": "32", "brand": "DemoBrand",
        "season": "四季", "style": "商务", "material": "聚酯纤维", "price": 199.0,
        "description": "垂感好、显瘦的商务正装裤",
    },
    {
        "name": "红色碎花连衣裙",
        "url": "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600&q=80",
        "category": "dress", "color": "红色", "size": "S", "brand": "DemoBrand",
        "season": "夏", "style": "甜美", "material": "雪纺", "price": 259.0,
        "description": "清爽碎花雪纺连衣裙，适合度假",
    },
    {
        "name": "灰色连帽卫衣",
        "url": "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&q=80",
        "category": "top", "color": "灰色", "size": "XL", "brand": "DemoBrand",
        "season": "秋冬", "style": "运动", "material": "毛圈布", "price": 159.0,
        "description": "加绒连帽卫衣，保暖舒适",
    },
    {
        "name": "卡其色工装裤",
        "url": "https://images.unsplash.com/photo-1517445312882-bc9910d016b7?w=600&q=80",
        "category": "pants", "color": "卡其", "size": "34", "brand": "DemoBrand",
        "season": "春秋", "style": "街头", "material": "棉混纺", "price": 219.0,
        "description": "多口袋工装直筒裤，帅气有型",
    },
    {
        "name": "米色针织开衫",
        "url": "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600&q=80",
        "category": "coat", "color": "米色", "size": "M", "brand": "DemoBrand",
        "season": "春秋", "style": "温柔", "material": "羊毛混纺", "price": 329.0,
        "description": "柔软针织开衫，内搭外穿皆宜",
    },
    {
        "name": "粉色百褶半身裙",
        "url": "https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=600&q=80",
        "category": "skirt", "color": "粉色", "size": "S", "brand": "DemoBrand",
        "season": "春夏", "style": "甜美", "material": "聚酯纤维", "price": 169.0,
        "description": "轻盈百褶裙，走动飘逸",
    },
    {
        "name": "藏青色风衣",
        "url": "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&q=80",
        "category": "coat", "color": "藏青", "size": "L", "brand": "DemoBrand",
        "season": "春秋", "style": "通勤", "material": "风衣面料", "price": 459.0,
        "description": "经典双排扣长款风衣，气质通勤",
    },
    {
        "name": "条纹短袖衬衫",
        "url": "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&q=80",
        "category": "top", "color": "蓝白", "size": "M", "brand": "DemoBrand",
        "season": "夏", "style": "清爽", "material": "棉", "price": 129.0,
        "description": "海魂条纹衬衫，夏日清爽标配",
    },
    {
        "name": "黑色马丁靴",
        "url": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80",
        "category": "shoes", "color": "黑色", "size": "42", "brand": "DemoBrand",
        "season": "秋冬", "style": "朋克", "material": "牛皮", "price": 399.0,
        "description": "经典8孔马丁靴，耐穿百搭",
    },
    {
        "name": "驼色羊毛大衣",
        "url": "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=600&q=80",
        "category": "coat", "color": "驼色", "size": "XL", "brand": "DemoBrand",
        "season": "冬", "style": "极简", "material": "羊毛", "price": 699.0,
        "description": "廓形羊毛大衣，冬季高级感",
    },
]


# ===== 与新分类/颜色标签体系对齐的映射（避免落库值与前端筛选 id 不一致） =====
# 旧脚本用的 category 是 top/coat/pants/dress/skirt，新体系为 tops/bottoms/dresses/outerwear/shoes/accessories
CATEGORY_MAP = {
    "top": "tops",
    "coat": "outerwear",
    "pants": "bottoms",
    "dress": "dresses",
    "skirt": "bottoms",
    "shoes": "shoes",
}
# 颜色标签对齐到 app.constants.COLOR_TAGS 的 name
COLOR_MAP = {
    "藏青": "牛仔蓝",
    "蓝白": "蓝色",
    "驼色": "卡其色",
    "卡其": "卡其色",
}


async def ensure_merchant(db) -> Merchant:
    existing = (
        await db.execute(select(Merchant).where(Merchant.username == MERCHANT_USERNAME))
    ).scalar_one_or_none()
    if existing:
        print(f"[商家] 已存在，复用: {existing.username} (id={existing.id})")
        return existing

    merchant = Merchant(
        username=MERCHANT_USERNAME,
        phone=MERCHANT_PHONE,
        password_hash=bcrypt.hashpw(
            MERCHANT_PASSWORD.encode("utf-8")[:72], bcrypt.gensalt()
        ).decode("utf-8"),
        store_name=MERCHANT_STORE,
        role="merchant",
        is_superuser=False,
        is_active=True,
        status=1,
        quota_total=100,
        quota_used=0,
        quota_remaining=100,
    )
    db.add(merchant)
    await db.flush()
    await db.refresh(merchant)
    print(f"[商家] 已创建: {merchant.username} (id={merchant.id}) 密码={MERCHANT_PASSWORD}")
    return merchant


async def download_image(url: str) -> tuple[bytes, str] | None:
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            ctype = resp.headers.get("content-type", "")
            if not ctype.startswith("image/"):
                # 兜底按扩展名推断
                if url.lower().endswith(".png"):
                    ctype = "image/png"
                elif url.lower().endswith((".jpg", ".jpeg")):
                    ctype = "image/jpeg"
                elif url.lower().endswith(".webp"):
                    ctype = "image/webp"
                else:
                    ctype = "image/jpeg"
            return resp.content, ctype
    except Exception as e:  # noqa: BLE001
        print(f"  [图片下载失败] {url} -> {e}")
        return None


async def seed():
    async with AsyncSessionLocal() as db:
        merchant = await ensure_merchant(db)

        created = 0
        skipped = 0
        for spec in CLOTHING_SPECS:
            # 去重：同名同商家视为已存在
            dup = (
                await db.execute(
                    select(Clothing).where(
                        Clothing.merchant_id == merchant.id,
                        Clothing.name == spec["name"],
                    )
                )
            ).scalar_one_or_none()
            if dup:
                print(f"[服装] 已存在，跳过: {spec['name']}")
                skipped += 1
                continue

            img = await download_image(spec["url"])
            if img is None:
                skipped += 1
                continue
            content, ctype = img

            record, access_url = await upload_file(
                db,
                content,
                folder="clothes",
                tenant_id=merchant.id,
                content_type=ctype,
                file_category="image",
            )

            clothing = Clothing(
                merchant_id=merchant.id,
                name=spec["name"],
                category=CATEGORY_MAP.get(spec["category"], spec["category"]),
                color=COLOR_MAP.get(spec["color"], spec["color"]),
                size=spec["size"],
                brand=spec["brand"],
                season=spec["season"],
                style=spec["style"],
                material=spec["material"],
                price=spec["price"],
                description=spec["description"],
                is_active=True,
                image_url=access_url,
                image_key=record.uuid,
                thumb_url=access_url,
                source="merchant_upload",
            )
            db.add(clothing)
            created += 1
            print(f"[服装] 已创建: {spec['name']} -> {access_url}")

        await db.commit()
        print(f"\n完成：新增服装 {created} 条，跳过 {skipped} 条。")


if __name__ == "__main__":
    asyncio.run(seed())
