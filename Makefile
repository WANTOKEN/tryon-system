# ===========================================
# AI Virtual Try-On System - Makefile
# ===========================================

.PHONY: help install dev migrate
.PHONY: deploy-backend deploy-frontend status logs rollback

# 默认显示帮助
help:
	@echo "使用方式: make <命令>"
	@echo ""
	@echo "开发环境:"
	@echo "  make install       - 安装依赖"
	@echo "  make dev           - 启动开发服务器"
	@echo "  make migrate       - 执行数据库迁移"
	@echo ""
	@echo "生产部署 (前后端分离):"
	@echo "  make deploy-backend  - 更新后端 (不影响前端)"
	@echo "  make deploy-frontend - 更新前端 (不影响后端)"
	@echo "  make status          - 查看服务状态"
	@echo "  make logs            - 查看日志"
	@echo "  make rollback        - 回滚上一版本"
	@echo ""
	@echo "数据库维护:"
	@echo "  make db-init         - 初始化表结构 (首次部署)"
	@echo "  make db-migrate      - 执行增量变更"
	@echo "  make db-schema       - 导出当前表结构"
	@echo "  make db-backup       - 备份数据库"

# 安装依赖
install:
	pip install -r requirements.txt
	cd frontend-react && npm install

# 开发服务器
dev:
	python manage.py runserver 0.0.0.0:8888

# 数据库迁移
migrate:
	python manage.py makemigrations
	python manage.py migrate

# ===========================================
# 生产部署 - 前后端分离
# ===========================================

# 更新后端 (不影响前端)
deploy-backend:
	@echo ">>> 构建后端镜像..."
	docker build -t tryon-backend:latest .
	@echo ">>> 平滑更新后端服务..."
	docker-compose -f docker/docker-compose.prod.yml up -d --no-deps backend
	@echo ">>> 后端更新完成!"

# 数据库迁移 (仅模型变更时执行)
migrate-prod:
	@echo ">>> 执行数据库迁移..."
	docker exec tryon-backend python manage.py migrate --noinput
	@echo ">>> 迁移完成!"

# 更新前端 (不影响后端)
deploy-frontend:
	@echo ">>> 构建前端..."
	cd frontend-react && npm run build
	@echo ">>> 更新前端静态文件..."
	docker cp frontend-react/dist/. tryon-nginx:/var/www/html/
	@echo ">>> 重载 Nginx..."
	docker exec tryon-nginx nginx -s reload
	@echo ">>> 前端更新完成!"

# 查看状态
status:
	@docker-compose -f docker/docker-compose.prod.yml ps

# 查看日志
logs:
	@docker-compose -f docker/docker-compose.prod.yml logs -f backend

# 回滚后端
rollback:
	@echo ">>> 回滚后端到上一版本..."
	docker-compose -f docker/docker-compose.prod.yml up -d --no-deps backend
	@echo ">>> 回滚完成!"

# ===========================================
# 数据库维护 (手动管理表结构)
# ===========================================

# 初始化表结构 (首次部署)
db-init:
	@echo ">>> 初始化表结构..."
	docker exec -i tryon-mysql mysql -u root -pRoot@AiTryon2026 tryon_system < docker/schema.sql
	@echo ">>> 初始化完成!"

# 执行增量变更
db-migrate:
	@echo ">>> 执行增量变更..."
	docker exec -i tryon-mysql mysql -u root -pRoot@AiTryon2026 tryon_system < docker/migrations.sql
	@echo ">>> 变更完成!"

# 导出当前表结构
db-schema:
	@echo ">>> 导出表结构到 docker/schema.sql..."
	docker exec tryon-mysql mysqldump -u root -pRoot@AiTryon2026 --no-data tryon_system > docker/schema.sql
	@echo ">>> 导出完成!"

# 备份数据库
db-backup:
	@echo ">>> 备份数据库..."
	docker exec tryon-mysql mysqldump -u root -pRoot@AiTryon2026 tryon_system > backup_$$(date +%Y%m%d_%H%M%S).sql
	@echo ">>> 备份完成!"
