# ===========================================
# AI Virtual Try-On System - Makefile
# Common development and deployment commands
# ===========================================

.PHONY: help install dev lint format clean docker-build docker-up docker-down migrate

# Default target
help:
	@echo "Available commands:"
	@echo "  make install       - Install all dependencies"
	@echo "  make dev           - Start development servers"
	@echo "  make lint          - Run linting checks"
	@echo "  make format        - Format code with linters"
	@echo "  make clean         - Clean generated files"
	@echo "  make docker-build  - Build Docker images"
	@echo "  make docker-up     - Start Docker containers"
	@echo "  make docker-down   - Stop Docker containers"
	@echo "  make migrate       - Run database migrations"
	@echo "  make shell         - Open Django shell"

# Installation
install:
	@echo "Installing backend dependencies..."
	pip install -r requirements.txt
	@echo "Installing frontend dependencies..."
	cd frontend-react && npm install
	@echo "Installing pre-commit hooks..."
	pre-commit install

# Development
dev:
	@echo "Starting development servers..."
	@echo "Backend: http://localhost:8888"
	@echo "Frontend: http://localhost:5173"
	# Terminal 1: Django
	python manage.py runserver 0.0.0.0:8888 &
	# Terminal 2: Vite
	cd frontend-react && npm run dev

# Linting
lint:
	@echo "Linting backend..."
	flake8 apps/ config/
	mypy apps/ config/
	@echo "Linting frontend..."
	cd frontend-react && npm run lint

# Formatting
format:
	@echo "Formatting backend..."
	black apps/ config/
	isort apps/ config/
	@echo "Formatting frontend..."
	cd frontend-react && npm run format

# Clean
clean:
	@echo "Cleaning generated files..."
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete
	find . -type d -name "*.egg-info" -delete
	rm -rf .mypy_cache/
	rm -rf frontend-react/dist/
	rm -rf frontend-react/node_modules/.cache/

# Docker
docker-build:
	@echo "Building Docker images..."
	docker-compose build --no-cache

docker-up:
	@echo "Starting Docker containers..."
	docker-compose up -d

docker-down:
	@echo "Stopping Docker containers..."
	docker-compose down

docker-logs:
	docker-compose logs -f

# Database
migrate:
	@echo "Running migrations..."
	python manage.py makemigrations
	python manage.py migrate

migrations:
	python manage.py makemigrations

# Shell
shell:
	python manage.py shell_plus

# Superuser
superuser:
	python manage.py createsuperuser

# Production
deploy:
	@echo "Deploying to production..."
	docker-compose -f docker-compose.prod.yml up -d --build

rollback:
	@echo "Rolling back..."
	docker-compose down
	docker-compose up -d --build previous-image

# Backup
backup-db:
	@echo "Backing up database..."
	docker exec tryon-db mysqldump -u root -p$(DB_ROOT_PASSWORD) $(DB_NAME) > backup_$(shell date +%Y%m%d_%H%M%S).sql

restore-db:
	@echo "Restore database from backup..."
	@read -p "Enter backup file: " file; \
	docker exec -i tryon-db mysql -u root -p$(DB_ROOT_PASSWORD) $(DB_NAME) < $$file

# Logs
logs-api:
	docker logs -f tryon-api

logs-celery:
	docker logs -f tryon-celery-worker

# Health check
health:
	@curl -s http://localhost:8888/api/v1/health/ | python -m json.tool
