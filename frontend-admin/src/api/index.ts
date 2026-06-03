import axios from 'axios';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { 
  PaginatedResponse, Merchant, TryOnRecord, Clothing, FileRecord, 
  DashboardStats, AdminUser, AdminUserItem, OperationLog, QuotaHistoryItem, 
  SystemConfigItem, GroupedConfig, ModelPhoto 
} from '../types';

// 登录响应类型
interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: AdminUser;
}

// 系统信息类型
interface SystemInfo {
  version: string;
  python_version: string;
  django_version: string;
  database: string;
  cache: string;
  storage: string;
  ai_engine: string;
}

// 创建 axios 实例
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/admin',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 从 localStorage 或 zustand persist storage 获取 token
    const storageData = localStorage.getItem('admin-auth-storage');
    let token: string | null = null;
    if (storageData) {
      try {
        const parsed = JSON.parse(storageData) as { state?: { token?: string } };
        token = parsed.state?.token ?? null;
      } catch {
        // ignore
      }
    }
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    // 处理 { success: true, data: {...} } 格式的响应
    if (response.data && typeof response.data === 'object' && 'success' in response.data && 'data' in response.data) {
      response.data = response.data.data;
    }
    return response;
  },
  (error) => {
    // 401 未授权 - 跳转登录页
    if (error.response?.status === 401) {
      localStorage.removeItem('admin-auth-storage');
      // 避免在登录页面循环重定向
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    // 403 禁止访问 - 保留错误信息，不做特殊处理
    // 其他错误也直接传递，让调用方处理
    return Promise.reject(error);
  }
);

// 处理 DRF 分页响应
function handlePaginatedResponse<T>(response: AxiosResponse<PaginatedResponse<T>>): { items: T[]; total: number } {
  const data = response.data;
  // DRF 标准格式
  if (data.results) {
    return { items: data.results, total: data.count };
  }
  // 自定义格式
  if (data.items) {
    return { items: data.items, total: data.total ?? 0 };
  }
  // 兜底
  return { items: [], total: data.count ?? data.total ?? 0 };
}

// ============ 认证 API ============
export const authApi = {
  getPublicKey: async (): Promise<string> => {
    const response = await api.get<{ public_key: string }>('/auth/public-key/');
    return response.data.public_key;
  },

  login: async (username: string, password: string, encrypted: boolean = false): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/login/', { username, password, encrypted });
    return response.data;
  },

  logout: (): Promise<AxiosResponse> => api.post('/auth/logout/'),

  getCurrentUser: (): Promise<AxiosResponse<AdminUser>> => api.get<AdminUser>('/auth/me/'),
};

// ============ 系统信息 API ============
export const systemApi = {
  getInfo: async (): Promise<SystemInfo> => {
    const response = await api.get<SystemInfo>('/system/info/');
    return response.data;
  },

  getStats: async (): Promise<DashboardStats> => {
    const response = await api.get<DashboardStats>('/system/stats/');
    return response.data;
  },
};

// Dashboard API (alias)
export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    const response = await api.get<DashboardStats>('/system/stats/');
    return response.data;
  },
};

// ============ 商家管理 API ============
export const merchantApi = {
  list: async (params: { page?: number; page_size?: number; search?: string; status?: number }): Promise<{ items: Merchant[]; total: number }> => {
    const response = await api.get<PaginatedResponse<Merchant>>('/merchants/', { params });
    return handlePaginatedResponse(response);
  },

  get: async (id: number): Promise<Merchant> => {
    const response = await api.get<Merchant>(`/merchants/${id}/`);
    return response.data;
  },

  create: async (data: Partial<Merchant>): Promise<Merchant> => {
    const response = await api.post<Merchant>('/merchants/', data);
    return response.data;
  },

  update: async (id: number, data: Partial<Merchant>): Promise<Merchant> => {
    const response = await api.put<Merchant>(`/merchants/${id}/`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/merchants/${id}/`);
  },

  // 配额管理
  adjustQuota: async (id: number, quotaTotal: number, reason?: string): Promise<{ quota_total: number; quota_used: number; quota_remaining: number }> => {
    const response = await api.patch(`/merchants/${id}/quota/`, { quota_total: quotaTotal, reason });
    return response.data;
  },

  resetQuota: async (id: number, reason?: string): Promise<{ quota_total: number; quota_used: number; quota_remaining: number; quota_reset_at: string }> => {
    const response = await api.post(`/merchants/${id}/reset-quota/`, { reason });
    return response.data;
  },

  getQuotaHistory: async (id: number, days?: number): Promise<QuotaHistoryItem[]> => {
    const response = await api.get<QuotaHistoryItem[]>(`/merchants/${id}/quota-history/`, { params: { days } });
    return response.data;
  },

  // 状态管理
  changeStatus: async (id: number, status: number): Promise<{ status: number; status_text: string }> => {
    const response = await api.patch(`/merchants/${id}/status/`, { status });
    return response.data;
  },
};

// ============ 试穿记录 API ============
export const tryonApi = {
  list: async (params: { page?: number; page_size?: number; merchant_id?: number; status?: string }): Promise<{ items: TryOnRecord[]; total: number }> => {
    const response = await api.get<PaginatedResponse<TryOnRecord>>('/tryon-records/', { params });
    return handlePaginatedResponse(response);
  },

  listRecords: async (params: { page?: number; page_size?: number; merchant_id?: number; status?: string }): Promise<{ items: TryOnRecord[]; total: number }> => {
    const response = await api.get<PaginatedResponse<TryOnRecord>>('/tryon-records/', { params });
    return handlePaginatedResponse(response);
  },

  get: async (id: number): Promise<TryOnRecord> => {
    const response = await api.get<TryOnRecord>(`/tryon-records/${id}/`);
    return response.data;
  },

  deleteRecord: async (id: number): Promise<void> => {
    await api.delete(`/tryon-records/${id}/`);
  },

  // 服装管理 (使用 wardrobe.Clothing 模型)
  listClothing: async (params: { page?: number; page_size?: number; name?: string; category?: string }): Promise<{ items: Clothing[]; total: number }> => {
    const response = await api.get<PaginatedResponse<Clothing>>('/clothing/', { params });
    return handlePaginatedResponse(response);
  },

  createClothing: async (data: Partial<Clothing> & { sizes?: string[] }): Promise<Clothing> => {
    const response = await api.post<Clothing>('/clothing/', data);
    return response.data;
  },

  updateClothing: async (id: string, data: Partial<Clothing> & { sizes?: string[] }): Promise<Clothing> => {
    const response = await api.put<Clothing>(`/clothing/${id}/`, data);
    return response.data;
  },

  deleteClothing: async (id: string): Promise<void> => {
    await api.delete(`/clothing/${id}/`);
  },

  // 上传服装图片 (FormData)
  uploadClothing: async (formData: FormData): Promise<Clothing> => {
    const response = await api.post<Clothing>('/clothing/upload/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // 更新服装并上传新图片 (FormData)
  updateClothingWithImage: async (id: string, formData: FormData): Promise<Clothing> => {
    const response = await api.put<Clothing>(`/clothing/${id}/update_image/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // 获取分类和子分类翻译 (从后端 wardrobe API)
  getCategories: async (): Promise<Array<{
    id: string;
    name: string;
    subcategories: Array<{ id: string; name: string }>;
  }>> => {
    const response = await api.get('/wardrobe/categories/');
    return response.data?.data || [];
  },
};

// ============ 文件管理 API ============
export const fileApi = {
  list: async (params: {
    page?: number;
    page_size?: number;
    storage_type?: string;
    file_category?: string;
    tenant_id?: string;
    folder?: string;
    is_deleted?: string;
    search?: string;
  }): Promise<{ items: FileRecord[]; total: number }> => {
    const response = await api.get<PaginatedResponse<FileRecord>>('/files/', { params });
    return handlePaginatedResponse(response);
  },

  get: async (id: string): Promise<FileRecord> => {
    const response = await api.get<FileRecord>(`/files/${id}/`);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/files/${id}/`);
  },

  /** 批量操作 */
  batchAction: async (ids: string[], action: 'soft_delete' | 'restore' | 'hard_delete'): Promise<{
    success: boolean;
    message: string;
    affected_ids: string[];
    action: string;
    storage_result?: { deleted: number; failed: number };
  }> => {
    const response = await api.post('/files/batch-action/', { ids, action });
    return response.data;
  },

  /** 清理软删除文件 */
  cleanupDeleted: async (days: number = 7): Promise<{
    success: boolean;
    message: string;
    deleted_count: number;
    affected_ids: number[];
    storage_result: { deleted: number; failed: number };
  }> => {
    const response = await api.post(`/files/cleanup-deleted/?days=${days}`);
    return response.data;
  },

  /** 获取统计信息 */
  stats: async (): Promise<{
    total_files: number;
    total_size: number;
    deleted_files: number;
    deleted_size: number;
    by_storage: Array<{ storage_type: string; count: number; size: number }>;
    by_category: Array<{ file_category: string; count: number; size: number }>;
  }> => {
    const response = await api.get('/files/stats/');
    return response.data;
  },
};

// ============ 管理员用户 API ============
export const adminUserApi = {
  list: async (params: { page?: number; page_size?: number; search?: string }): Promise<{ items: AdminUserItem[]; total: number }> => {
    const response = await api.get<PaginatedResponse<AdminUserItem>>('/admin-users/', { params });
    return handlePaginatedResponse(response);
  },

  create: async (data: { username: string; phone: string; password: string; is_superuser?: boolean; store_name?: string }): Promise<AdminUserItem> => {
    const response = await api.post<AdminUserItem>('/admin-users/', data);
    return response.data;
  },

  update: async (id: number, data: Partial<AdminUserItem> & { password?: string }): Promise<AdminUserItem> => {
    const response = await api.patch<AdminUserItem>(`/admin-users/${id}/`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/admin-users/${id}/`);
  },
};

// ============ 操作日志 API ============
export const operationLogApi = {
  list: async (params: { page?: number; page_size?: number; admin_id?: number; action?: string; target_type?: string; days?: number }): Promise<{ items: OperationLog[]; total: number }> => {
    const response = await api.get<PaginatedResponse<OperationLog>>('/operation-logs/', { params });
    return handlePaginatedResponse(response);
  },
};

// ============ 系统配置 API ============
export const configApi = {
  list: async (params?: { is_public?: boolean }): Promise<{ items: SystemConfigItem[]; total: number }> => {
    const response = await api.get<PaginatedResponse<SystemConfigItem>>('/config/', { params });
    return handlePaginatedResponse(response);
  },

  get: async (key: string): Promise<SystemConfigItem> => {
    const response = await api.get<SystemConfigItem>(`/config/${key}/`);
    return response.data;
  },

  update: async (key: string, data: Partial<SystemConfigItem>): Promise<SystemConfigItem> => {
    const response = await api.put<SystemConfigItem>(`/config/${key}/`, data);
    return response.data;
  },

  getGrouped: async (): Promise<GroupedConfig> => {
    const response = await api.get<GroupedConfig>('/config/grouped/');
    return response.data;
  },

  batchUpdate: async (configs: Record<string, string>, options?: { 
    value_types?: Record<string, string>; 
    descriptions?: Record<string, string>; 
    is_public?: Record<string, boolean> 
  }): Promise<{ updated: string[] }> => {
    const response = await api.post<{ updated: string[] }>('/config/batch/', { 
      configs, 
      ...options 
    });
    return response.data;
  },
};

// ============ 模特照片 API ============
export const modelPhotoApi = {
  list: async (params: { page?: number; page_size?: number; is_active?: boolean }): Promise<{ items: ModelPhoto[]; total: number }> => {
    const response = await api.get<PaginatedResponse<ModelPhoto>>('/model-photos/', { params });
    return handlePaginatedResponse(response);
  },

  get: async (id: number): Promise<ModelPhoto> => {
    const response = await api.get<ModelPhoto>(`/model-photos/${id}/`);
    return response.data;
  },

  create: async (data: Partial<ModelPhoto> | FormData, isFormData = false): Promise<ModelPhoto> => {
    const response = isFormData
      ? await api.post<ModelPhoto>('/model-photos/', data as FormData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      : await api.post<ModelPhoto>('/model-photos/', data);
    return response.data;
  },

  update: async (id: number, data: Partial<ModelPhoto> | FormData, isFormData = false): Promise<ModelPhoto> => {
    const response = isFormData
      ? await api.put<ModelPhoto>(`/model-photos/${id}/`, data as FormData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      : await api.put<ModelPhoto>(`/model-photos/${id}/`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/model-photos/${id}/`);
  },

  // 上传模特照片 (FormData)
  upload: async (formData: FormData): Promise<ModelPhoto> => {
    const response = await api.post<ModelPhoto>('/model-photos/upload/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

export default api;
