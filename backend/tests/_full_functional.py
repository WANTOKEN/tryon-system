"""
全链路功能测试（临时，测完删除）：连真实后端 127.0.0.1:8000，覆盖所有核心链路。
"""
import base64
import time
import urllib.request
import urllib.error
import urllib.parse
import json

BASE = "http://127.0.0.1:8000/api/v1"
PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
PNG = base64.b64decode(PNG_B64)
TS = str(int(time.time() * 1000))
results = []


def rec(name, ok, info=""):
    results.append((name, ok, info))
    print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f" -- {info}" if info else ""))


def req(method, path, token=None, data=None, files=None, form=None, expect=(200,)):
    url = BASE + path
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if files is not None:
        boundary = "----tbound" + TS
        body = b""
        if form:
            for k, v in form.items():
                body += f"--{boundary}\r\n".encode()
                body += f'Content-Disposition: form-data; name="{k}"\r\n\r\n'.encode()
                body += str(v).encode() + b"\r\n"
        for k, (fn, content, ct) in files.items():
            body += f"--{boundary}\r\n".encode()
            body += f'Content-Disposition: form-data; name="{k}"; filename="{fn}"\r\n'.encode()
            body += f"Content-Type: {ct}\r\n\r\n".encode()
            body += content + b"\r\n"
        body += f"--{boundary}--\r\n".encode()
        headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
        data = body
    elif data is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(data).encode()
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(r)
        return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def login(username, password):
    s, b = req("POST", "/auth/login/", data={"username": username, "password": password})
    if s == 200:
        return json.loads(b)["access_token"]
    return None


# 1. 认证全链路
tok = login("admin", "admin123")
rec("admin 登录", tok is not None)
me_s, me_b = req("GET", "/auth/me/", token=tok)
rec("me 接口(超管)", me_s == 200 and json.loads(me_b).get("is_superuser") is True)

# 2. 错误密码 401
s, _ = req("POST", "/auth/login/", data={"username": "admin", "password": "wrongpass"})
rec("错误密码 401", s == 401, f"status={s}")

# 3. 未授权 403/401
s, _ = req("GET", "/auth/me/")
rec("无 token 访问受保护 403", s in (401, 403), f"status={s}")

# 4. 商家自注册 + 登录
s, b = req("POST", "/auth/register/", data={
    "username": f"shop{TS}", "phone": f"139{TS[-8:]}", "password": "secret1",
    "store_name": f"门店{TS}"})
rec("商家自注册", s == 200, f"status={s}")
shop_tok = login(f"shop{TS}", "secret1")
rec("商家登录", shop_tok is not None)

# 5. 未授权商家建商家应 403
s, _ = req("POST", "/admin/merchants/", token=shop_tok, data={"username": "x", "phone": "13800000000", "password": "y"})
rec("普通商家建商家 403", s == 403, f"status={s}")

# 6. 衣橱上传/列表/详情/分类
s, b = req("POST", "/wardrobe/clothing/upload/", token=tok,
           files={"file": ("a.png", PNG, "image/png")}, form={"name": "上衣", "category": "upper"})
rec("衣橱上传", s == 200, f"status={s}")
if s == 200:
    cuuid = json.loads(b)["uuid"]
    ckey = json.loads(b)["image_key"]
    s2, _ = req("GET", f"/wardrobe/clothing/{cuuid}/", token=tok)
    rec("衣橱详情", s2 == 200, f"status={s2}")
    s3, b3 = req("GET", "/wardrobe/clothing/", token=tok)
    rec("衣橱列表", s3 == 200 and json.loads(b3).get("total", 0) >= 1)
    s4, b4 = req("GET", "/wardrobe/clothing/categories/", token=tok)
    rec("衣橱分类", s4 == 200)

# 7. 人像上传
s, b = req("POST", "/tryon/upload/avatar/", token=tok, files={"file": ("p.png", PNG, "image/png")})
rec("人像上传", s == 200, f"status={s}")
if s == 200:
    avatar_key = json.loads(b)["image_key"]
    # 8. 试穿 generate
    s, b = req("POST", "/tryon/generate/", token=tok,
               files={"file": ("", b"", "image/png")},  # 空文件占位，用 avatar_key
               form={"session_id": f"sess{TS}", "avatar_key": avatar_key, "clothing_ids": cuuid})
    rec("试穿生成", s == 200, f"status={s}")
    if s == 200:
        ruuid = json.loads(b)["record_uuid"]
        # 轮询
        final = None
        for _ in range(30):
            s, b = req("GET", f"/tryon/records/{ruuid}/status/", token=tok)
            st = json.loads(b)["status"]
            if st in ("completed", "failed"):
                final = st
                break
            time.sleep(1)
        rec("试穿轮询完成", final == "completed", f"final={final}")
        # 收藏
        s, _ = req("POST", f"/tryon/records/{ruuid}/save/", token=tok, data={"save": True})
        rec("试穿收藏", s == 200)
        # 删除
        s, _ = req("DELETE", f"/tryon/records/{ruuid}/", token=tok)
        rec("试穿删除", s == 200)

# 9. 文件 secure-url / list
s, b = req("POST", "/file/secure-url/", token=tok, data={"key": ckey})
rec("secure-url", s == 200, f"status={s}")
s, b = req("GET", "/file/list/", token=tok)
rec("file-list", s == 200, f"status={s}")
# 文件重定向
s, _ = req("GET", f"/file/{ckey}/")
rec("file 重定向", s in (302, 307), f"status={s}")

# 10. 后台接口（超管）
s, b = req("GET", "/admin/system/stats/", token=tok)
rec("后台 stats", s == 200 and "tryon_trend" in json.loads(b), f"status={s}")
s, b = req("GET", "/admin/merchants/", token=tok)
rec("后台商家列表", s == 200)
s, b = req("POST", "/admin/merchants/", token=tok, data={"username": f"ashop{TS}", "phone": f"137{TS[-8:]}", "password": "secret2", "store_name": f"后台店{TS}"})
rec("后台创建商家", s == 200, f"status={s}")
if s == 200:
    aid = json.loads(b)["uuid"]
    s, _ = req("DELETE", f"/admin/merchants/{aid}/", token=tok)
    rec("后台删除商家", s == 200)
s, b = req("GET", "/admin/files/stats/", token=tok)
rec("后台文件统计", s == 200)
s, b = req("GET", "/admin/clothing/", token=tok)
rec("后台服装列表", s == 200)
s, b = req("GET", "/admin/tryon-records/", token=tok)
rec("后台试穿记录", s == 200)
s, b = req("GET", "/admin/admin-users/", token=tok)
rec("后台管理员列表", s == 200)
s, b = req("GET", "/admin/operation-logs/", token=tok)
rec("后台操作日志", s == 200)

# 11. 公共接口
s, b = req("GET", "/common/model-photos/")
rec("公共模特库", s == 200)
s, _ = req("GET", "/common/admin-contact/")
rec("公共联系信息", s == 200)

# 12. 不存在记录 404
s, _ = req("GET", "/tryon/records/not-exist-uuid/status/", token=tok)
rec("不存在试穿记录 404", s == 404, f"status={s}")

# 清理：删除测试服装
if 'cuuid' in dir():
    req("DELETE", f"/wardrobe/clothing/{cuuid}/", token=tok)

passed = sum(1 for _, ok, _ in results if ok)
print(f"\n===== {passed}/{len(results)} passed =====")
if passed != len(results):
    raise SystemExit(1)
