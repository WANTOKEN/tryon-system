# 长期记忆

## 项目开发约束（用户明确授权）
- 当前项目处于**开发阶段**，用户允许任何必要的代码更改与重构。
- 无需考虑向后兼容性、旧版本兼容、废弃逻辑保留或兼容性判断。
- 可放心采用最新语法特性、API 与最佳实践重构优化代码。
- 适用范围：整个项目（backend / frontend-react / frontend-admin / 运维配置等）。

## 存储策略（用户明确决定）
- **不使用对象存储（OSS）**，所有资源（上传图、服装图、AI 试穿结果图）一律存服务器本地磁盘，通过 `/static/uploads/...` 暴露。
- 已删除 `app/storage/oss.py` 及所有 OSS 配置；存储层仅保留 `LocalStorageBackend`。
- AI 调用（火山引擎 Ark）返回的图片先下载为字节流，再经 `upload_file` 存本地，result_url 为服务器地址（Ark 的 24h 临时 URL 不直接对外）。
- 根 `.env` 的 `STORAGE_TYPE=oss` 为未接线的遗留配置，已置为 `local` 并注释掉 OSS 凭证。
