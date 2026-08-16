-- MySQL 8 初始化脚本
-- 由官方 mysql 镜像在首次启动时自动执行（/docker-entrypoint-initdb.d/*.sql）
-- 在 docker-compose 中以只读方式挂载：./db/init -> /docker-entrypoint-initdb.d

-- 1) 应用数据库：使用 utf8mb4，兼容中文与 emoji
CREATE DATABASE IF NOT EXISTS `tryon`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 2) 创建应用账户，并显式使用 mysql_native_password 认证插件
--    这是解决 MySQL 8 默认 caching_sha2_password 与 Python 异步驱动（asyncmy）
--    认证不兼容问题的关键：mysql_native_password 被所有 MySQL 客户端/驱动广泛支持。
CREATE USER IF NOT EXISTS 'tryon'@'%'
  IDENTIFIED WITH mysql_native_password BY 'tryon';
CREATE USER IF NOT EXISTS 'tryon'@'localhost'
  IDENTIFIED WITH mysql_native_password BY 'tryon';

-- 3) 授权（仅对 tryon 库），并刷新权限
GRANT ALL PRIVILEGES ON `tryon`.* TO 'tryon'@'%';
GRANT ALL PRIVILEGES ON `tryon`.* TO 'tryon'@'localhost';
FLUSH PRIVILEGES;
