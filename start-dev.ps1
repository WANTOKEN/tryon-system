# start-dev.ps1 - Windows 开发环境启动脚本
# 使用方式: .\start-dev.ps1

Write-Host "==========================================" -ForegroundColor Green
Write-Host "AI 虚拟试衣系统 - 开发环境启动" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

# 检查 Python
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "错误: Python 未安装" -ForegroundColor Red
    Write-Host "请参考 doc/04-开发环境准备.md 安装 Python" -ForegroundColor Yellow
    exit 1
}

# 检查 Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "错误: Node.js 未安装" -ForegroundColor Red
    Write-Host "请参考 doc/04-开发环境准备.md 安装 Node.js" -ForegroundColor Yellow
    exit 1
}

# 检查虚拟环境
if (-not (Test-Path ".venv\Scripts\activate.ps1")) {
    Write-Host "创建 Python 虚拟环境..." -ForegroundColor Yellow
    python -m venv .venv
}

# 激活虚拟环境
Write-Host "激活虚拟环境..." -ForegroundColor Yellow
.\.venv\Scripts\Activate.ps1

# 安装 Python 依赖
Write-Host "检查 Python 依赖..." -ForegroundColor Yellow
pip install -r requirements.txt --quiet

# 安装前端依赖
Write-Host "检查前端依赖..." -ForegroundColor Yellow
Push-Location frontend-react
if (-not (Test-Path "node_modules")) {
    Write-Host "安装 npm 依赖..." -ForegroundColor Yellow
    npm install
}
Pop-Location

# 检查 .env 文件
if (-not (Test-Path ".env")) {
    Write-Host "创建 .env 配置文件..." -ForegroundColor Yellow
    Copy-Item .env.example .env
    Write-Host "请编辑 .env 文件配置数据库连接" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "启动服务..." -ForegroundColor Green

# 启动后端
Write-Host "启动后端服务 (端口 8888)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
cd '$PWD'
.\.venv\Scripts\Activate.ps1
Write-Host '后端服务运行中...' -ForegroundColor Green
python manage.py runserver 0.0.0.0:8888
"@

# 等待后端启动
Start-Sleep -Seconds 2

# 启动前端
Write-Host "启动前端服务 (端口 5173)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
cd '$PWD\frontend-react'
Write-Host '前端服务运行中...' -ForegroundColor Green
npm run dev
"@

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "开发环境已启动!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "访问地址:" -ForegroundColor White
Write-Host "  后端 API:  http://localhost:8888/api/v1/" -ForegroundColor Cyan
Write-Host "  前端页面:  http://localhost:5173" -ForegroundColor Cyan
Write-Host "  Django Admin: http://localhost:8888/admin/" -ForegroundColor Cyan
Write-Host ""
Write-Host "按 Ctrl+C 停止服务" -ForegroundColor Yellow
Write-Host ""
