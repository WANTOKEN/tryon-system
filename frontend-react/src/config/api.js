// API 配置
const API_BASE = '/api/v1'

export const API_ENDPOINTS = {
  // 认证
  AUTH: {
    LOGIN: `${API_BASE}/auth/login/`,
    SMS_LOGIN: `${API_BASE}/auth/sms-login/`,
    REGISTER: `${API_BASE}/auth/register/`,
    LOGOUT: `${API_BASE}/auth/logout/`,
    ME: `${API_BASE}/auth/me/`,
    SEND_SMS: `${API_BASE}/auth/send-sms/`,
    REFRESH: `${API_BASE}/auth/refresh/`,
    SEND_RESET_SMS: `${API_BASE}/auth/send-reset-sms/`,
    RESET_PASSWORD: `${API_BASE}/auth/reset-password/`,
    ADMIN_CONTACT: `${API_BASE}/auth/admin-contact/`,
  },
  // 衣橱
  WARDROBE: {
    CLOTHING: `${API_BASE}/wardrobe/clothing/`,
    CLOTHING_DETAIL: uuid => `${API_BASE}/wardrobe/clothing/${uuid}/`,
    CATEGORIES: `${API_BASE}/wardrobe/categories/`,
    PRESETS: `${API_BASE}/wardrobe/presets/`,
  },
  // 试穿
  TRYON: {
    GENERATE: `${API_BASE}/tryon/generate/`,
    STATUS: uuid => `${API_BASE}/tryon/records/${uuid}/status/`,
    RECORDS: `${API_BASE}/tryon/records/`,
    RECORD_DETAIL: uuid => `${API_BASE}/tryon/records/${uuid}/`,
    SAVE: uuid => `${API_BASE}/tryon/records/${uuid}/save/`,
    DELETE: uuid => `${API_BASE}/tryon/records/${uuid}/`,
    CLEAR: `${API_BASE}/tryon/records/clear/`,
    UPLOAD_AVATAR: `${API_BASE}/tryon/upload/avatar/`,
    UPLOAD_CLOTHING: `${API_BASE}/tryon/upload/clothing/`,
  },
  // 通用
  COMMON: {
    MODEL_PHOTOS: `${API_BASE}/common/model-photos/`,
  },
  // 文件
  FILE: {
    ACCESS: fileId => `${API_BASE}/file/${fileId}/`,
    INFO: fileId => `${API_BASE}/file/${fileId}/info/`,
    BY_KEY: storageKey => `${API_BASE}/file/by-key/${storageKey}/`,
    LIST: `${API_BASE}/file/list/`,
    SECURE_URL: `${API_BASE}/file/secure-url/`,
    BULK_SECURE_URL: `${API_BASE}/file/bulk-secure-url/`,
  },
}

export { API_BASE }
