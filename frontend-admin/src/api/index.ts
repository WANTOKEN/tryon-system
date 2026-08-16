import axios from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';

// 创建 axios 实例
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
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
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('admin-auth-storage');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ============ 认证 API ============
export const authApi = {
  login: async (username: string, password: string, _encrypted?: boolean) => {
    // 后端不支持加密，直接发送原始密码
    const response = await api.post('/auth/login/', { username, password });
    return response.data;
  },

  logout: async () => {
    await api.post('/auth/logout/');
  },

  getCurrentUser: async () => {
    const response = await api.get('/auth/me/');
    return response.data;
  },

  refreshToken: async (refreshToken: string) => {
    const response = await api.post('/auth/refresh/', { refresh_token: refreshToken });
    return response.data;
  },
};

// ============ 系统 API ============
export const systemApi = {
  getStats: async () => {
    const response = await api.get('/admin/system/stats/');
    return response.data;
  },
};

// ============ 商家管理 API ============
export const merchantApi = {
  list: async (params: { page?: number; page_size?: number; search?: string; status?: number }) => {
    const response = await api.get('/admin/merchants/', {
      params: {
        page: params.page,
        page_size: params.page_size,
        search: params.search,
        status_filter: params.status,
      },
    });
    return {
      items: response.data.items || [],
      total: response.data.total || 0,
    };
  },

  get: async (id: number) => {
    const response = await api.get(`/admin/merchants/${id}/`);
    return response.data;
  },

  create: async (data: Record<string, unknown>) => {
    const response = await api.post('/admin/merchants/', data);
    return response.data;
  },

  update: async (id: number, data: Record<string, unknown>) => {
    const response = await api.patch(`/admin/merchants/${id}/`, data);
    return response.data;
  },

  delete: async (id: number) => {
    await api.delete(`/admin/merchants/${id}/`);
    return { success: true };
  },

  adjustQuota: async (id: number, quotaTotal: number, reason?: string) => {
    const response = await api.patch(`/admin/merchants/${id}/quota/`, { quota_total: quotaTotal, reason });
    return response.data;
  },

  resetQuota: async (id: number, reason?: string) => {
    const response = await api.post(`/admin/merchants/${id}/quota/reset/`, { reason });
    return response.data;
  },

  getQuotaHistory: async (id: number, days: number = 30) => {
    try {
      const response = await api.get(`/admin/merchants/${id}/quota/history/`, { params: { days } });
      return response.data.items || response.data || [];
    } catch {
      return [];
    }
  },
};

// ============ 文件 API ============
export const fileApi = {
  list: async (params: { page?: number; page_size?: number; file_category?: string; is_deleted?: boolean | string; search?: string }) => {
    const response = await api.get('/admin/files/', {
      params: {
        page: params.page,
        page_size: params.page_size,
        file_category: params.file_category,
        is_deleted: params.is_deleted,
        search: params.search,
      },
    });
    return {
      items: response.data.items || [],
      total: response.data.total || 0,
    };
  },

  stats: async () => {
    const response = await api.get('/admin/files/stats/');
    return response.data;
  },

  batchAction: async (ids: string[], action: 'soft_delete' | 'restore' | 'hard_delete') => {
    const response = await api.post('/admin/files/batch/', { ids, action });
    return response.data;
  },

  cleanupDeleted: async (days: number) => {
    const response = await api.post('/admin/files/cleanup/', { days });
    return response.data;
  },
};

// ============ 服装 API ============
export const clothingApi = {
  list: async (params: { page?: number; page_size?: number; name?: string; category?: string }) => {
    const response = await api.get('/admin/clothing/', { params });
    return {
      items: response.data.items || [],
      total: response.data.total || 0,
    };
  },

  getCategories: async () => {
    // 与后端 /wardrobe/categories/ 保持一致，避免前后端字典分裂
    const response = await api.get('/wardrobe/categories/');
    return response.data || [];
  },

  deleteClothing: async (id: string) => {
    await api.delete(`/admin/clothing/${id}/`);
    return { success: true };
  },

  updateClothing: async (id: string, data: Record<string, unknown>) => {
    const response = await api.patch(`/admin/clothing/${id}/`, data);
    return response.data;
  },

  updateClothingWithImage: async (id: string, formData: FormData) => {
    const response = await api.patch(`/admin/clothing/${id}/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  createClothing: async (data: Record<string, unknown>) => {
    const response = await api.post('/admin/clothing/', data);
    return response.data;
  },

  uploadClothing: async (formData: FormData) => {
    const response = await api.post('/admin/clothing/upload/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

// ============ 试穿记录 API ============
export const tryonApi = {
  list: async (params: { page?: number; page_size?: number; merchant_id?: number; status?: string }) => {
    const response = await api.get('/admin/tryon-records/', { params });
    return {
      items: response.data.items || [],
      total: response.data.total || 0,
    };
  },

  listRecords: async (params: { page?: number; page_size?: number; merchant_id?: number; status?: string }) => {
    const response = await api.get('/admin/tryon-records/', { params });
    return {
      items: response.data.items || [],
      total: response.data.total || 0,
    };
  },

  deleteRecord: async (id: number) => {
    await api.delete(`/admin/tryon-records/${id}/`);
    return { success: true };
  },
};

// ============ Dashboard API (alias for systemApi) ============
export const dashboardApi = {
  getStats: async () => {
    const response = await api.get('/admin/system/stats/');
    return response.data;
  },
};

// ============ Config API ============
export const configApi = {
  getGrouped: async () => {
    const response = await api.get('/admin/system/config/grouped/');
    return response.data;
  },
  batchUpdate: async (configMap: Record<string, unknown>, options?: { value_types?: Record<string, string> }) => {
    const response = await api.post('/admin/system/config/batch/', {
      configs: configMap,
      value_types: options?.value_types ?? {},
    });
    return response.data;
  },
};

// ============ Operation Log API ============
export const operationLogApi = {
  list: async (params: { page?: number; page_size?: number; action?: string; days?: number }) => {
    try {
      const response = await api.get('/admin/operation-logs/', {
        params: {
          page: params.page,
          page_size: params.page_size,
          action: params.action,
          days: params.days,
        },
      });
      return {
        items: response.data.items || [],
        total: response.data.total || 0,
      };
    } catch {
      return { items: [], total: 0 };
    }
  },
};

// ============ Model Photo API ============
export const modelPhotoApi = {
  list: async (params: { page?: number; page_size?: number; is_active?: boolean }) => {
    try {
      const response = await api.get('/common/model-photos/', {
        params: {
          page: params.page,
          page_size: params.page_size,
          is_active: params.is_active,
        },
      });
      return {
        items: response.data.items || [],
        total: response.data.total || 0,
      };
    } catch {
      return { items: [], total: 0 };
    }
  },

  create: async (data: FormData | Record<string, unknown>, isFormData?: boolean) => {
    const response = await api.post('/admin/model-photos/', data, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
    });
    return response.data;
  },

  update: async (id: number, data: FormData | Record<string, unknown>, isFormData?: boolean) => {
    const response = await api.patch(`/admin/model-photos/${id}/`, data, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
    });
    return response.data;
  },

  delete: async (id: number) => {
    await api.delete(`/admin/model-photos/${id}/`);
    return { success: true };
  },
};

// ============ Admin User API ============
export const adminUserApi = {
  list: async (params: { page?: number; page_size?: number; search?: string }) => {
    try {
      const response = await api.get('/admin/admin-users/', {
        params: { page: params.page, page_size: params.page_size, search: params.search },
      });
      return {
        items: response.data.items || [],
        total: response.data.total || 0,
      };
    } catch {
      return { items: [], total: 0 };
    }
  },
  create: async (data: Record<string, unknown>) => {
    const response = await api.post('/admin/admin-users/', data);
    return response.data;
  },
  update: async (id: number, data: Record<string, unknown>) => {
    const response = await api.patch(`/admin/admin-users/${id}/`, data);
    return response.data;
  },
  delete: async (id: number) => {
    await api.delete(`/admin/admin-users/${id}/`);
    return { success: true };
  },
};

export default api;
