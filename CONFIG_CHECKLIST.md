# 企业级配置检查清单

本文档列出所有需要配置的 TODO 项目，部署前请逐项确认。

---

## 🔐 安全配置

| 项目 | 文件 | 说明 | 状态 |
|------|------|------|------|
| SECRET_KEY | `.env` | Django 密钥，使用 `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"` 生成 | ⬜ |
| 数据库密码 | `.env` | 修改 `DB_PASSWORD` 和 `DB_ROOT_PASSWORD` | ⬜ |
| Grafana 密码 | `.env` | 修改 `GRAFANA_ADMIN_PASSWORD` | ⬜ |
| SSL 证书 | `nginx/ssl/` | 放置 `fullchain.pem` 和 `privkey.pem` | ⬜ |

---

## 📱 短信服务 (阿里云)

| 项目 | 文件 | 说明 | 状态 |
|------|------|------|------|
| AccessKey | `.env` | `ALIYUN_ACCESS_KEY_ID` 和 `ALIYUN_ACCESS_KEY_SECRET` | ⬜ |
| 短信签名 | `.env` | `ALIYUN_SMS_SIGN_NAME` | ⬜ |
| 短信模板 | `.env` | `ALIYUN_SMS_TEMPLATE_CODE` | ⬜ |

🔗 控制台: https://dysms.console.aliyun.com/

---

## 🤖 AI 引擎配置

### 阿里云 (主引擎)

| 项目 | 文件 | 说明 | 状态 |
|------|------|------|------|
| AccessKey | `.env` | `ALIYUN_ACCESS_KEY_ID`, `ALIYUN_ACCESS_KEY_SECRET` | ⬜ |
| 服务端点 | `.env` | `ALIYUN_VISION_ENDPOINT` (可选) | ⬜ |

🔗 文档: https://help.aliyun.com/product/viapi.html

### 腾讯云 (备用引擎)

| 项目 | 文件 | 说明 | 状态 |
|------|------|------|------|
| SecretId/Key | `.env` | `TENCENT_SECRET_ID`, `TENCENT_SECRET_KEY` | ⬜ |
| 服务区域 | `.env` | `TENCENT_VISION_REGION` (可选) | ⬜ |

🔗 文档: https://cloud.tencent.com/product/fus

### 火山引擎 SeedDream (推荐)

| 项目 | 文件 | 说明 | 状态 |
|------|------|------|------|
| API Key | `.env` | `ARK_API_KEY` | ⬜ |
| 模型 ID | `.env` | `ARK_MODEL_ID` (可选，默认 doubao-seedream-5-0-260128) | ⬜ |

🔗 获取密钥: https://console.volcengine.com/ark/region:ark+cn-beijing/apikey
🔗 文档: https://www.volcengine.com/docs/82379/1298299

---

## 📧 邮件服务 (可选)

| 项目 | 文件 | 说明 | 状态 |
|------|------|------|------|
| SMTP 服务器 | `.env` | `EMAIL_HOST`, `EMAIL_PORT` | ⬜ |
| SMTP 认证 | `.env` | `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD` | ⬜ |

---

## 📊 监控配置

### Sentry 错误监控

| 项目 | 文件 | 说明 | 状态 |
|------|------|------|------|
| Sentry DSN | `.env` | `SENTRY_DSN` | ⬜ |

🔗 控制台: https://sentry.io/

### Prometheus 告警

| 项目 | 文件 | 说明 | 状态 |
|------|------|------|------|
| Alertmanager | `prometheus/prometheus.yml` | 配置告警通知地址 | ⬜ |
| 告警规则 | `prometheus/rules/*.yml` | CPU、内存、磁盘告警 | ⬜ |
| Exporters | `docker-compose.yml` | 添加 redis/mysql/nginx/celery exporter | ⬜ |

### Grafana 仪表盘

| 项目 | 文件 | 说明 | 状态 |
|------|------|------|------|
| Dashboard JSON | `grafana/dashboards/` | 预配置的监控仪表盘 | ⬜ |

---

## 🚀 CI/CD 配置

| 项目 | 文件 | 说明 | 状态 |
|------|------|------|------|
| GitHub Secrets | Repository Settings | `PROD_HOST`, `PROD_USER`, `PROD_SSH_KEY` | ⬜ |
| Codecov | `.github/workflows/ci.yml` | 上传覆盖率报告 | ⬜ |
| Container Registry | `.github/workflows/ci.yml` | 配置镜像仓库 | ⬜ |

---

## 🌐 域名与网络

| 项目 | 文件 | 说明 | 状态 |
|------|------|------|------|
| ALLOWED_HOSTS | `.env` | 添加生产域名 | ⬜ |
| CORS 来源 | `.env` | `CORS_ALLOWED_ORIGINS` | ⬜ |
| CSRF 信任 | `.env` | `CSRF_TRUSTED_ORIGINS` | ⬜ |

---

## ☁️ 云存储 (必需)

AI 引擎需要公网可访问的图片 URL，必须配置 OSS：

| 项目 | 文件 | 说明 | 状态 |
|------|------|------|------|
| OSS AccessKey | `.env` | `OSS_ACCESS_KEY_ID`, `OSS_ACCESS_KEY_SECRET` | ⬜ |
| OSS Bucket | `.env` | `OSS_BUCKET_NAME` | ⬜ |
| OSS Endpoint | `.env` | `OSS_ENDPOINT` (如: oss-cn-shanghai.aliyuncs.com) | ⬜ |
| 自定义域名 | `.env` | `OSS_DOMAIN` (可选) | ⬜ |

🔗 控制台: https://oss.console.aliyun.com/
🔗 文档: https://help.aliyun.com/zh/oss/developer-reference/getting-started-with-oss-sdk-for-python

---

## ✅ 部署前检查

- [ ] 所有密码已修改为强密码
- [ ] SSL 证书已配置并正常工作
- [ ] `.env` 文件已从 `.env.example` 复制并填写
- [ ] 数据库已初始化并运行迁移
- [ ] 静态文件已收集 (`python manage.py collectstatic`)
- [ ] 监控服务正常运行
- [ ] 备份策略已配置

---

## 📝 快速命令

```bash
# 生成 SECRET_KEY
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"

# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 运行迁移
docker-compose exec api python manage.py migrate

# 创建管理员
docker-compose exec api python manage.py createsuperuser

# 健康检查
curl http://localhost:8888/api/v1/health/
```
