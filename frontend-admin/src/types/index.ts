// 管理后台类型定义

// 商家
export interface Merchant {
  id: number;
  uuid: string;
  username: string;
  phone: string;
  store_name: string;
  store_address: string;
  avatar_url: string;
  quota_total: number;
  quota_used: number;
  quota_remaining: number;
  quota_reset_at: string | null;
  status: number; // 0: 禁用, 1: 正常, 2: 过期
  status_text: string;
  last_login_at: string | null;
  last_login_ip: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  email?: string;
  name?: string;
}

// 试穿记录
export interface TryOnRecord {
  id: number;
  uuid: string;
  merchant_id: number;
  merchant_name?: string;
  session_id: string;
  avatar_url: string;
  avatar_file_id?: string;
  avatar_source: 'system' | 'user' | 'history';
  result_url: string;
  result_file_id?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  status_text: string;
  ai_engine: string;
  task_id: string;
  error_message: string | null;
  processing_time: number | null;
  is_saved: boolean;
  ip_address: string;
  device_info: string;
  created_at: string;
  updated_at: string;
}

// 服装
export interface Clothing {
  id: string; // UUID
  uuid: string;
  merchant_id: number;
  category: string;
  category_text: string;
  subcategory: string;
  name: string;
  color: string;
  price: number;
  sizes: string[];
  image_url: string;
  image_thumb_url: string;
  file_id?: string;
  sort_order: number;
  is_active: boolean;
  source: string;
  source_text: string;
  created_at: string;
  updated_at: string;
}

// 文件记录
export interface FileRecord {
  id: string; // UUID
  md5_hash: string;
  storage_key: string;
  access_url: string;
  tenant_id: string;
  folder: string;
  file_category: string;
  file_category_text?: string;
  file_size: number;
  content_type: string;
  file_type?: string;
  file_ext: string;
  width: number;
  height: number;
  is_public: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
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
  id: number;
  username: string;
  phone?: string;
  store_name?: string;
  is_superuser: boolean;
  role: UserRole;
  merchant_id?: number;
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
  id: number;
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
  id: number;
  admin_id: number;
  admin_username: string;
  action: string;
  action_text: string;
  target_type: string;
  target_id: string;
  target_name: string;
  detail: Record<string, unknown>;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

// 配额历史
export interface QuotaHistoryItem {
  id: number;
  merchant_id: number;
  change_type: string;
  old_total: number;
  new_total: number;
  old_used: number;
  new_used: number;
  reason: string;
  operator_id: number | null;
  operator_name: string;
  created_at: string;
}

// 系统配置
export interface SystemConfigItem {
  id: number;
  key: string;
  value: string;
  value_type: 'string' | 'integer' | 'float' | 'boolean' | 'json';
  value_type_text: string;
  parsed_value: string | number | boolean | Record<string, unknown>;
  description: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

// 分组配置
export interface GroupedConfig {
  basic: SystemConfigItem[];
  ai: SystemConfigItem[];
  oss: SystemConfigItem[];
  storage: SystemConfigItem[];
  quota: SystemConfigItem[];
  contact: SystemConfigItem[];
  other: SystemConfigItem[];
}

// 模特照片
export interface ModelPhoto {
  id: number;
  image_url: string;
  image_thumb_url: string;
  file_id?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 试穿服装关联
export interface TryOnClothing {
  id: number;
  category: string;
  subcategory: string;
  clothing_name: string;
  clothing_color: string;
  clothing_image: string;
  is_custom: boolean;
  name: string;
  color: string;
  is_available: boolean;
}
