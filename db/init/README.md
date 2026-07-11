# MySQL 初始化脚本

本目录下的 `*.sql` 会在 `mysql:8` 容器**首次启动**时由官方镜像自动执行
（挂载到 `/docker-entrypoint-initdb.d`）。

`01-init.sql` 负责：
1. 创建应用数据库 `tryon`（字符集 `utf8mb4`）。
2. 创建应用账户 `tryon`，并**显式使用 `mysql_native_password` 认证插件**，
   以解决 MySQL 8 默认 `caching_sha2_password` 与 Python 异步驱动 `aiomysql` 的兼容问题。

> 若已有数据卷（`mysql-data`）且数据库已初始化，修改本脚本不会重新执行；
> 需要重置时请删除数据卷：`docker compose down -v`。
