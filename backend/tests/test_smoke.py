"""
端到端冒烟测试：模拟前端契约，验证核心闭环可运行。

运行：
    cd backend
    pip install -r requirements.txt
    pytest tests/test_smoke.py -q
"""
import base64
import time

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings
from app.main import app

# 1x1 红色 PNG
PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
PNG = base64.b64decode(PNG_B64)


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _login(client, username, password):
    r = client.post("/api/v1/auth/login/", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_health(client):
    assert client.get("/health").json()["status"] == "healthy"


def test_auth_and_admin_seed(client):
    token = _login(client, "admin", "admin123")
    me = client.get("/api/v1/auth/me/", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["is_superuser"] is True


def test_wardrobe_upload_and_list(client):
    token = _login(client, "admin", "admin123")
    h = {"Authorization": f"Bearer {token}"}
    r = client.post(
        "/api/v1/wardrobe/clothing/upload/",
        headers=h,
        files={"file": ("a.png", PNG, "image/png")},
        data={"name": "测试上衣", "category": "tops", "subcategory": "t-shirt", "color": "红色"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    # 契约对齐：上传接口返回 id + image_key（FileRecord.uuid），无冗余 uuid 字段
    assert body["id"] and body["image_url"] and body["image_key"]

    lst = client.get("/api/v1/wardrobe/clothing/", headers=h)
    assert lst.status_code == 200
    assert lst.json()["total"] >= 1


def test_tryon_full_loop(client):
    token = _login(client, "admin", "admin123")
    h = {"Authorization": f"Bearer {token}"}

    # 自备配额状态：持久化 SQLite 可能被先前运行耗尽，用超管接口给自身充值，保证试穿闭环可跑
    me = client.get("/api/v1/auth/me/", headers=h).json()
    q = client.patch(
        f"/api/v1/admin/merchants/{me['id']}/quota/",
        headers=h,
        json={"quota_total": 100, "reason": "smoke"},
    )
    assert q.status_code == 200, q.text

    # 上传人像
    av = client.post(
        "/api/v1/tryon/upload/avatar/",
        headers=h,
        files={"file": ("p.png", PNG, "image/png")},
    )
    assert av.status_code == 200, av.text
    avatar_key = av.json()["image_key"]

    # 上传一件服装用于选择
    cl = client.post(
        "/api/v1/wardrobe/clothing/upload/",
        headers=h,
        files={"file": ("b.png", PNG, "image/png")},
        data={"name": "上衣B", "category": "tops", "color": "蓝色"},
        )
    # clothing_ids 按契约传 image_key（FileRecord.uuid），试穿服务据此解析服装图
    clothing_uuid = cl.json()["image_key"]

    # 提交试穿
    gen = client.post(
        "/api/v1/tryon/generate/",
        headers=h,
        data={
            "session_id": "smoke-session",
            "avatar_source": "user",
            "avatar_key": avatar_key,
            "clothing_ids": clothing_uuid,
        },
    )
    assert gen.status_code == 200, gen.text
    # generate 接口返回 id（即前端轮询用的 uuid），无 record_uuid 字段
    record_uuid = gen.json()["id"]
    assert gen.json()["estimated_time"] > 0

    # 轮询直到完成（mock 引擎约 4s）
    status_url = f"/api/v1/tryon/records/{record_uuid}/status/"
    for _ in range(30):
        st = client.get(status_url, headers=h).json()
        if st["status"] in ("completed", "failed"):
            break
        time.sleep(1)
    assert st["status"] == "completed", st
    assert st["result_url"], "结果图 URL 不应为空"

    # 文件路由可访问（重定向）
    fk = av.json()["image_key"]
    fr = client.get(f"/api/v1/file/{fk}/", follow_redirects=False)
    assert fr.status_code in (302, 307)


def test_admin_stats(client):
    token = _login(client, "admin", "admin123")
    r = client.get("/api/v1/admin/system/stats/", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert "tryon_trend" in r.json()


def test_production_requires_strong_secret():
    """非开发环境下使用默认弱密钥必须被配置校验拒绝。"""
    with pytest.raises(ValidationError):
        Settings(env="production", jwt_secret_key="change-me-in-production")


def test_create_merchant_typed(client):
    """管理员创建商家应使用类型化 Pydantic 模型（MerchantCreate）。"""
    token = _login(client, "admin", "admin123")
    h = {"Authorization": f"Bearer {token}"}
    r = client.post(
        "/api/v1/admin/merchants/",
        headers=h,
        json={
            "username": f"shop_{int(time.time())}",
            "phone": f"139{int(time.time()) % 100000000:08d}",
            "password": "secret1",
            "store_name": "门店一",
        },
    )
    assert r.status_code == 200, r.text
    # create_merchant 返回 {"id": ...}，无 uuid 字段
    assert r.json()["id"]


def test_create_merchant_invalid_phone(client):
    """非法手机号应被 Pydantic 校验拒绝（422）。"""
    token = _login(client, "admin", "admin123")
    h = {"Authorization": f"Bearer {token}"}
    r = client.post(
        "/api/v1/admin/merchants/",
        headers=h,
        json={"username": "bad", "phone": "123", "password": "secret1"},
    )
    assert r.status_code == 422
