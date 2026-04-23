#!/bin/bash
# start-dev.sh - macOS 开发环境启动脚本
# 使用方式: ./start-dev.sh

echo -e "\033[32m==========================================\033[0m"
echo -e "\033[32mAI 虚拟试衣系统 - 开发环境启动\033[0m"
echo -e "\033[32m==========================================\033[0m"
echo ""

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo -e "\033[31m错误: Python 未安装\033[0m"
    echo -e "\033[33m请参考 doc/04-开发环境准备.md 安装 Python\033[0m"
    exit 1
fi

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "\033[31m错误: Node.js 未安装\033[0m"
    echo -e "\033[33m请参考 doc/04-开发环境准备.md 安装 Node.js\033[0m"
    exit 1
fi

# 检查虚拟环境
if [ ! -d ".venv" ]; then
    echo -e "\033[33m创建 Python 虚拟环境...\033[0m"
    python3 -m venv .venv
fi

# 激活虚拟环境
echo -e "\033[33m激活虚拟环境...\033[0m"
source .venv/bin/activate

# 安装 Python 依赖
echo -e "\033[33m检查 Python 依赖...\033[0m"
pip install -r requirements.txt --quiet

# 安装前端依赖
echo -e "\033[33m检查前端依赖...\033[0m"
cd frontend-react
if [ ! -d "node_modules" ]; then
    echo -e "\033[33m安装 npm 依赖...\033[0m"
    npm install
fi
cd ..

# 检查 .env 文件
if [ ! -f ".env" ]; then
    echo -e "\033[33m创建 .env 配置文件...\033[0m"
    cp .env.example .env
    echo -e "\033[33m请编辑 .env 文件配置数据库连接\033[0m"
fi

echo ""
echo -e "\033[32m启动服务...\033[0m"

# 获取当前目录
PROJECT_DIR=$(pwd)

# 启动后端
echo -e "\033[36m启动后端服务 (端口 8888)...\033[0m"
osascript -e "tell application \"Terminal\" to do script \"cd '$PROJECT_DIR' && source .venv/bin/activate && echo -e '\\033[32m后端服务运行中...\\033[0m' && python manage.py runserver 0.0.0.0:8888\""

# 等待后端启动
sleep 2

# 启动前端
echo -e "\033[36m启动前端服务 (端口 5173)...\033[0m"
osascript -e "tell application \"Terminal\" to do script \"cd '$PROJECT_DIR/frontend-react' && echo -e '\\033[32m前端服务运行中...\\033[0m' && npm run dev\""

echo ""
echo -e "\033[32m==========================================\033[0m"
echo -e "\033[32m开发环境已启动!\033[0m"
echo -e "\033[32m==========================================\033[0m"
echo ""
echo -e "访问地址:"
echo -e "  \033[36m后端 API:  http://localhost:8888/api/v1/\033[0m"
echo -e "  \033[36m前端页面:  http://localhost:5173\033[0m"
echo -e "  \033[36mDjango Admin: http://localhost:8888/admin/\033[0m"
echo ""
echo -e "\033[33m按 Ctrl+C 停止服务\033[0m"
echo ""
