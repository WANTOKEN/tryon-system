# 长期记忆（精简版，持续去重）

## 1. 项目开发约束（用户授权）
- 开发阶段：允许任何必要改动/重构，无需兼容旧版本、无需保留废弃逻辑。可放心用新语法/API。
- 跨整个项目（backend / frontend-react / frontend-admin / 运维）。

## 2. 运行与技术栈
- 端口：后端 8000、用户端 5173、管理端 5174、MySQL 3306。启动顺序：先 `docker compose up -d db` → 后端 → 两前端。
- **后端必须从 `backend/` 目录启动**才能加载 `backend/.env`：`cd backend && ../.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`（首启自动建表+超管 admin/admin123）。成功标志 `Application startup complete.`
- venv 统一用根目录 `.venv`；DB 驱动统一 **aiomysql**；`database.py` 已关 `pool_pre_ping`（与 aiomysql 不兼容），改用 `pool_recycle=3600`。
- 测试数据：`cd backend && ../.venv/bin/python scripts/seed_test_data.py`（商家 test_merchant/test123456 + 12 条服装图）。
- 前端：`npm run dev`；vite proxy 已把 `/api`、`/static/uploads`、`/file` 转发 8000，无需配 `VITE_API_BASE_URL`。
- 联调坑：路由前缀必带 `/api/v1/` 尾斜杠；上传 `category` 传 slug（`tops`）；`Access denied for user 'tryon'` → `docker compose down -v && docker compose up -d db` 重建卷。

## 3. 存储策略（用户决定）
- **不用 OSS**，全部资源存服务器本地磁盘经 `/static/uploads/...` 暴露。`oss.py` 已删，仅留 `LocalStorageBackend`。Ark 图先下载字节流再 `upload_file` 存本地（不直出 24h 临时 URL）。

## 4. 后端字段/接口契约定案（2026-08-29 全量审计通过，勿再返工）
- 裁决：**保持模型精简，调用方对齐模型，不补冗余列**。
- `OperationLog`/`QuotaHistory` 只存 `operator_id`，用户名在接口层按页批量 join 派生 `operator_username`（空 id 兜底「系统」），不落库用户名列。
- `QuotaHistory.reason` 是合法入参名、落库列 `note`，非缺陷。
- 已删冗余派生字段 `subcategory/sizes/image_thumb_url/file_id/sort_order/is_active`。
- `ModelPhoto` 无响应 schema 是有意（内联 dict 序列化）。
- **所有字典类接口统一返回 `{"items": [...]}` 包裹**（如 `/common/colors/`、`/wardrobe/categories/`）；前端 api 层须拆包归一化数组并兜底 `[]`，页面 `setState` 再加 `Array.isArray` 兜底。注意 `/admin/merchants/` 是扁平 `{items,total}` 无 `data` 包裹。

## 5. 前端主题系统（react + admin 两端一致）
- 机制：`<html data-theme="luxury-gold|frost-blue|sakura-pink|forest-green">` + `<html class="dark">`；localStorage 键 `aitryon-theme`/`aitryon-mode`；index.html 注入启动前同步脚本防闪烁，hook 监听 `storage` 事件跨标签页同步。
- react 端：`src/hooks/useTheme.js` + `index.css` 注入语义变量（复用 `--accent/--bg-*/--text-*/--border-*`）。样式拆分 `src/styles/{tokens,themes,layout,components,animations}.css`，由 `main.jsx` 按序 import（非 @import）。
- admin 端（antd）：`ConfigProvider` 根 provider 设 `algorithm` + `colorPrimary`（按 mode 取 primaryDark/primary），内层用 `useToken()`；`destroyOnClose`→`destroyOnHidden`。
- **antd `cssVar:true` 作用域坑**：`--ant-color-*` 注册在 ConfigProvider 根容器 `.css-var-*` 上，**不作用 `html`/`body`**。故 `index.css` 里 body/`::-webkit-scrollbar-*` 规则写 `var(--ant-color-*)` 无效，须 `html.dark xxx{}` 单独指定；暗色 `html.dark body{background:#000}` 否则整页亮底。验证：临时 `npx vite --port 5178` + Playwright 读 `getComputedStyle`，测试元素须 append 进 `.css-var-r0` 容器。
- **BrandLogo 教训**：`public/logo.png` 是金棕实色图（非单色透明），不能用 mask+主题色染色，直接 `<img>` 渲染原图；logo 不跟随主题变色（用户接受）。

## 6. 前端验收必跑项（务必遵守）
- **`vite build` 成功 + read_lints 零错误 ≠ 能跑**。TDZ（在 const 声明前读它）、`no-undef`（state 迁进 hook 后仍调旧 `setXxx`）能过构建却首屏/交互抛 ReferenceError（白屏）。
- frontend-react 必跑 `npm run lint`（eslint `--max-warnings 0`）；admin 必跑 `npx tsc --noEmit` + `npm run build`。格式类用 `npm run lint:fix`。
- **多 agent 同改同批文件极危险**（曾致 App.jsx `handleTryOn` 重复声明整文件不可解析）。动手前确认无并发写入方（看 mtime）。

## 7. 前端通用约定（antd / react）
- 字典接口：`{items:[]}` 拆包兜底（见 §4）。
- `Form` 放 `Modal` 内：禁渲染期 `form.getFieldValue`/`setFieldsValue`，用 `initialValues`+`key` 重挂载；读字段值用 `<Form.Item shouldUpdate noStyle>` 渲染函数或 Form 树内 `Form.useWatch`。
- `Form.Item` 子节点须是控件本身，用 `<div>` 包 Switch/Input 会注入 value 到 div 致失去受控。
- `react-router-dom@6.30` 的 `BrowserRouter` future 仅 `v7_startTransition`/`v7_relativeSplatPath` 两键有效。

## 8. admin 服装上传链路三处历史阻断（2026-08-30 复验通过）
① 单张/批量上传 `formData` 字段名必须 `file`（非 `image`）；`/admin/model-photos/` 用 `image`，两接口不一致勿全局替换。② 主色 `color` 只能传系统中文色名（`COLOR_NAME_SET`），前端 hex 须最近邻匹配成色名再提交，匹配不到不传。③ 编辑走「先 `POST /admin/clothing/upload/` 传图再 `PATCH /admin/clothing/{id}/` JSON」，multipart PATCH 会 500。

## 9. 多 Agent 协作模式（2026-08-29 确认）
- 编制：main=PM（拆任务/派单/裁决/验收/汇报）、product-manager、fullstack-dev-1(后端)、fullstack-dev-2(react)、fullstack-dev-3(admin)、qa-engineer(独立验收打回)。
- 机制：`team_create`→`Task` spawn→成员 `send_message` 回传→main 汇总→派 qa 验收→通过则 `shutdown_request`+`team_delete`。
- PM 默认：确定性 bug 直接修；业务取舍自决并说明理由。
- **重复派单根因**：本项目"模型重构遗留不一致"已大部分修完，旧 memory"待决策"会误导重派。**派单前务必先实查（AST+运行期冒烟）是否已存在**。
- 自动化任务用 `automation_update` 创建，需用户在 IDE 面板确认才落盘。
- 收尾：验收通过把改动与结论追加写入当日记忆 md（不覆盖）并输出结构化汇报。
