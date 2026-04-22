-- AI 虚拟试衣系统 - MySQL 初始化脚本
CREATE DATABASE IF NOT EXISTS tryon_system
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

-- 【关键修复】允许 root 从任何地址登录（解决 1045 报错）
ALTER USER 'root'@'%' IDENTIFIED WITH mysql_native_password BY 'Root@AiTryon2026';
FLUSH PRIVILEGES;

-- 创建业务用户
CREATE USER IF NOT EXISTS 'tryon'@'%' IDENTIFIED BY 'Root@AiTryon2026';
GRANT ALL PRIVILEGES ON tryon_system.* TO 'tryon'@'%';
FLUSH PRIVILEGES;

USE tryon_system;

-- 创建商家表
CREATE TABLE IF NOT EXISTS merchant (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(42) NOT NULL COMMENT '对外唯一标识',
    username VARCHAR(50) NOT NULL COMMENT '登录用户名',
    phone VARCHAR(20) NOT NULL COMMENT '手机号',
    password VARCHAR(255) NOT NULL COMMENT '密码哈希',
    store_name VARCHAR(100) NOT NULL DEFAULT '' COMMENT '门店名称',
    store_address VARCHAR(255) NOT NULL DEFAULT '' COMMENT '门店地址',
    avatar_url VARCHAR(500) NOT NULL DEFAULT '' COMMENT '商家头像URL',
    quota_total INT UNSIGNED NOT NULL DEFAULT 100 COMMENT '总配额',
    quota_used INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '已用配额',
    quota_reset_at DATE NULL COMMENT '配额重置日期',
    status TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '状态: 0=禁用 1=正常',
    last_login_at DATETIME NULL COMMENT '最后登录时间',
    last_login_ip VARCHAR(45) NOT NULL DEFAULT '' COMMENT '最后登录IP',
    is_deleted TINYINT(1) NOT NULL DEFAULT 0,
    deleted_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_uuid (uuid),
    UNIQUE KEY uk_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商家表';

-- 创建服装表
CREATE TABLE IF NOT EXISTS clothing (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(42) NOT NULL COMMENT '对外唯一标识',
    merchant_id BIGINT UNSIGNED NOT NULL COMMENT '所属商家ID',
    category VARCHAR(30) NOT NULL COMMENT '大类',
    subcategory VARCHAR(30) NOT NULL COMMENT '子类',
    name VARCHAR(100) NOT NULL COMMENT '服装名称',
    color VARCHAR(30) NOT NULL DEFAULT '#000000' COMMENT '主色调',
    image_url VARCHAR(500) NOT NULL DEFAULT '' COMMENT '服装图片URL',
    image_thumb_url VARCHAR(500) NOT NULL DEFAULT '' COMMENT '缩略图URL',
    sort_order INT NOT NULL DEFAULT 0 COMMENT '排序权重',
    is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否上架',
    source VARCHAR(20) NOT NULL DEFAULT 'preset' COMMENT '来源',
    file_hash VARCHAR(64) NOT NULL DEFAULT '' COMMENT '文件哈希',
    is_deleted TINYINT(1) NOT NULL DEFAULT 0,
    deleted_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_uuid (uuid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='服装表';

-- 试穿记录表
CREATE TABLE IF NOT EXISTS tryon_record (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(42) NOT NULL COMMENT '对外唯一标识',
    merchant_id BIGINT UNSIGNED NOT NULL COMMENT '所属商家ID',
    session_id VARCHAR(100) NOT NULL COMMENT '会话ID',
    avatar_url VARCHAR(500) NOT NULL COMMENT '顾客形象照片URL',
    result_url VARCHAR(500) NOT NULL DEFAULT '' COMMENT 'AI生成效果图URL',
    result_thumb_url VARCHAR(500) NOT NULL DEFAULT '' COMMENT '效果图缩略图URL',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT '状态',
    ai_engine VARCHAR(20) NOT NULL DEFAULT 'aliyun' COMMENT 'AI引擎',
    task_id VARCHAR(100) NOT NULL DEFAULT '' COMMENT 'AI任务ID',
    error_message TEXT NULL COMMENT '错误信息',
    processing_time DECIMAL(8,2) NULL COMMENT '处理耗时',
    quota_deducted TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已扣配额',
    is_saved TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否收藏',
    ip_address VARCHAR(45) NOT NULL DEFAULT '' COMMENT '客户端IP',
    device_info VARCHAR(200) NOT NULL DEFAULT '' COMMENT '设备信息',
    user_agent VARCHAR(500) NOT NULL DEFAULT '' COMMENT '浏览器UA',
    is_deleted TINYINT(1) NOT NULL DEFAULT 0,
    deleted_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_uuid (uuid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='试穿记录表';

-- 试穿服装关联表
CREATE TABLE IF NOT EXISTS tryon_clothing (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    record_id BIGINT UNSIGNED NOT NULL,
    clothing_id VARCHAR(100) NOT NULL,
    is_custom TINYINT(1) NOT NULL DEFAULT 0,
    category VARCHAR(30) NOT NULL,
    subcategory VARCHAR(30) NOT NULL,
    clothing_name VARCHAR(100) NOT NULL,
    clothing_color VARCHAR(30) NOT NULL DEFAULT '#000000',
    clothing_image VARCHAR(500) NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='试穿服装关联表';

-- 短信验证码日志表
CREATE TABLE IF NOT EXISTS sms_log (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    merchant_id BIGINT UNSIGNED NULL,
    phone VARCHAR(20) NOT NULL,
    code VARCHAR(6) NOT NULL,
    purpose VARCHAR(20) NOT NULL DEFAULT 'login',
    is_used TINYINT(1) NOT NULL DEFAULT 0,
    ip_address VARCHAR(45) NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expired_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='短信验证码日志表';

-- 预设服装模板表
CREATE TABLE IF NOT EXISTS preset_clothing (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category VARCHAR(30) NOT NULL,
    subcategory VARCHAR(30) NOT NULL,
    name_i18n JSON NOT NULL,
    color VARCHAR(30) NOT NULL DEFAULT '#000000',
    image_url VARCHAR(500) NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='预设服装模板表';