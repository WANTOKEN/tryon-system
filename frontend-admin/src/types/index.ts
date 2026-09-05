// 管理后台类型定义
//
// 契约约定（与后端 SQLAlchemy 模型严格对齐）：
// 1. 所有模型主键是 id（UUID hex 字符串，来自 UUIDMixin），没有任何模型有 uuid 主键。
//    唯一例外：FileRecord 有独立的业务字段 uuid（对外暴露用）。
// 2. 因此列表 rowKey / API 路径参数一律用 id: string。
// 3. 不在后端出参中的字段一律不在此声明，避免前端误以为字段存在。

// 商家
export interface Merchant {
  id: string;
  username: string;
  phone: string;
  store_name: string;
  avatar_url: string;
  role: string;
  is_superuser: boolean;
  quota_total: number;
  quota_used: number;
  quota_remaining: number;
  quota_reset_at: string | null;
  status: number; // 0: 禁用, 1: 正常
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  email?: string;
  name?: string;
}

// 试穿记录
// 说明：后端 status 存 int，但 /admin/tryon-records/ 出参已投影为语义字符串
// （pending/processing/completed/failed），status_text 为中文文案。
export interface TryOnRecord {
  id: string;
  merchant_id?: string;
  merchant_name?: string;
  session_id: string;
  avatar_url: string;
  avatar_source: string;
  result_url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  status_text: string;
  engine: string;
  is_saved: boolean;
  duration_ms: number;
  created_at: string;
}

// 服装
// 缩略图字段是 thumb_url（不是 image_thumb_url）；image_key 存的是 FileRecord.uuid。
export interface Clothing {
  id: string;
  merchant_id: string;
  name: string;
  category: string;
  color: string;
  size: string;
  brand: string;
  season: string;
  style: string;
  material: string;
  price: number;
  description: string;
  is_active: boolean;
  image_url: string;
  image_key: string;
  thumb_url: string;
  source: string;
  created_at: string;
  category_text?: string;
  source_text?: string;
}

// 文件记录
export interface FileRecord {
  id: string;
  // 业务唯一标识（对外暴露用，区别于主键 id）
  uuid: string;
  md5_hash: string;
  storage_key: string;
  access_url: string;
  original_name: string;
  tenant_id: string;
  folder: string;
  file_category: string;
  file_size: number;
  content_type: string;
  file_ext: string;
  created_at: string;
  updated_at: string;
  file_category_text?: string;
  is_deleted?: boolean;
}

// 统计数据
export interface DashboardStats {
  // 今日统计
  today_tryon_count: number;
  today_success_rate: number;
  today_avg_processing_time: number;
  
  // 商家统计
  total_merchants: number;
  active_merchants: number;
  
  // 试穿记录统计
  total_tryon_records: number;
  
  // 服装统计
  total_clothing: number;
  
  // 存储统计
  total_storage_bytes: number;
  total_files: number;
  
  // 额度统计 (商家专用)
  quota_total: number;
  quota_used: number;
  quota_remaining: number;
  
  // 趋势数据
  tryon_trend: Array<{
    date: string;
    count: number;
    success_count: number;
  }>;
  
  // 引擎统计
  engine_stats: Array<{
    engine: string;
    count: number;
    avg_time: number;
  }>;
}

// 分页响应 (DRF 标准格式)
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
  // 兼容自定义格式
  items?: T[];
  total?: number;
  page?: number;
  page_size?: number;
}

// API 响应
export interface ApiResponse<T = unknown> {
  success?: boolean;
  data?: T;
  message?: string;
  code?: number;
}

// 用户角色类型
export type UserRole = 'super_admin' | 'merchant_admin';

// 登录用户
export interface AdminUser {
  id: string;
  username: string;
  phone?: string;
  store_name?: string;
  is_superuser: boolean;
  role: UserRole;
  merchant_id?: string;
  permissions?: string[];
}

// 权限码定义
export const PERMISSIONS = {
  SUPER_ADMIN: 'super_admin',
  MERCHANT_VIEW: 'merchant_view',
  MERCHANT_MANAGE: 'merchant_manage',
  TRYON_VIEW: 'tryon_view',
  TRYON_MANAGE: 'tryon_manage',
  CLOTHING_VIEW: 'clothing_view',
  CLOTHING_MANAGE: 'clothing_manage',
  FILE_VIEW: 'file_view',
  FILE_MANAGE: 'file_manage',
  SYSTEM_SETTINGS: 'system_settings',
  ADMIN_VIEW: 'admin_view',
  ADMIN_MANAGE: 'admin_manage',
  LOG_VIEW: 'log_view',
} as const;

// 菜单权限映射
export const MENU_PERMISSIONS: Record<string, string[]> = {
  '/dashboard': [],
  '/merchants': [PERMISSIONS.MERCHANT_VIEW],
  '/tryon-records': [PERMISSIONS.TRYON_VIEW],
  '/clothing': [PERMISSIONS.CLOTHING_VIEW],
  '/files': [PERMISSIONS.FILE_VIEW],
  '/admin-users': [PERMISSIONS.ADMIN_VIEW],
  '/operation-logs': [PERMISSIONS.LOG_VIEW],
  '/settings': [PERMISSIONS.SYSTEM_SETTINGS],
};

// 管理员用户
export interface AdminUserItem {
  id: string;
  username: string;
  phone: string;
  store_name: string;
  is_superuser: boolean;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

// 操作日志
export interface OperationLog {
  id: string;
  operator_id: string;
  operator_username: string;
  action: string;
  action_text: string;
  target_type: string;
  target_id: string;
  target_name: string;
  detail: Record<string, unknown>;
  ip: string;
  created_at: string;
}

// 配额历史
export interface QuotaHistoryItem {
  id: string;
  merchant_id: string;
  action: string;
  old_total: number;
  new_total: number;
  old_used: number;
  new_used: number;
  note: string;
  operator_id: string | null;
  created_at: string;
}

// 系统配置
export interface SystemConfigItem {
  id: string;
  key: string;
  value: string;
  value_type: 'string' | 'integer' | 'float' | 'boolean' | 'json';
  value_type_text?: string;
  parsed_value?: string | number | boolean | Record<string, unknown>;
  description: string;
  is_editable?: boolean;
  created_at?: string;
  updated_at?: string;
}

// 分组配置
export interface GroupedConfig {
  basic: SystemConfigItem[];
  ai: SystemConfigItem[];
  storage: SystemConfigItem[];
  quota: SystemConfigItem[];
  contact: SystemConfigItem[];
  other: SystemConfigItem[];
}

// 模特照片
export interface ModelPhoto {
  id: string;
  merchant_id: string;
  name: string;
  image_url: string;
  image_key: string;
  description: string;
  created_at: string;
}

// 试穿服装关联
export interface TryOnClothing {
  id: string;
  category: string;
  clothing_name: string;
  clothing_color: string;
  clothing_image: string;
  is_custom: boolean;
  name: string;
  color: string;
  is_available: boolean;
}
