# syntax=docker/dockerfile:1

# ---------- 共享 Node 构建基座 ----------
FROM debian:12-slim AS node-base
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || true; \
    apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates nodejs npm && \
    rm -rf /var/lib/apt/lists/*; \
    npm config set registry https://registry.npmmirror.com

# ---------- 构建用户端 frontend-react ----------
FROM node-base AS build-react
WORKDIR /app
COPY frontend-react/package.json frontend-react/package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm npm install
COPY frontend-react/ ./
ENV VITE_API_BASE_URL=""
RUN npm run build

# ---------- 构建管理后台 frontend-admin ----------
FROM node-base AS build-admin
WORKDIR /app
COPY frontend-admin/package.json frontend-admin/package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm npm install
COPY frontend-admin/ ./
ENV VITE_API_BASE_URL=""
RUN npm run build

# ---------- 运行期 nginx ----------
FROM debian:12-slim AS run
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || true; \
    apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates nginx && \
    rm -rf /var/lib/apt/lists/*; \
    rm -f /etc/nginx/sites-enabled/default

COPY --from=build-react /app/dist /usr/share/nginx/html/user
COPY --from=build-admin /app/dist /usr/share/nginx/html/admin
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx/proxy.conf /etc/nginx/proxy.conf

STOPSIGNAL SIGQUIT
EXPOSE 8080 8081
CMD ["nginx", "-g", "daemon off;"]
