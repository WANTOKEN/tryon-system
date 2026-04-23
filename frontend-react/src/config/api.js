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
  },
}

export { API_BASE }
