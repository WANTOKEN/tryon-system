# AI 虚拟试衣系统 - React 前端 Dockerfile
# 多阶段构建：构建阶段 + 生产镜像

# ================================
# Stage 1: 构建阶段
# ================================
FROM node:20-alpine AS builder

WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖（使用 ci 确保版本锁定）
RUN npm ci --registry=https://registry.npmmirror.com

# 复制源代码
COPY . .

# 构建生产版本
RUN npm run build

# ================================
# Stage 2: 生产镜像（Nginx）
# ================================
FROM nginx:1.25-alpine AS production

# 复制自定义 Nginx 配置
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 添加健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# 暴露端口
EXPOSE 80

# 启动 Nginx
CMD ["nginx", "-g", "daemon off;"]
