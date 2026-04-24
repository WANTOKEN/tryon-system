/**
 * HTTP 请求封装
 */
import { STORAGE_KEYS } from '../constants/storageKeys'

// Token 管理
export const TokenManager = {
  setTokens(access, refresh) {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, access)
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refresh)
  },

  getAccessToken() {
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)
  },

  getRefreshToken() {
    return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)
  },

  clearTokens() {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN)
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN)
  },

  isAuthenticated() {
    return !!this.getAccessToken()
  },
}

// 当前会话的顾客标识（由 App.jsx 设置）
let currentSessionId = null

export function setSessionId(sessionId) {
  currentSessionId = sessionId
}

// 生成请求 ID（直接使用 session_id，方便追踪同一顾客的所有请求）
function generateRequestId() {
  if (currentSessionId) {
    // 将下划线替换为连字符
    return currentSessionId.replace(/_/g, '-')
  }
  // 没有 session_id 时使用默认格式
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 6)
  return `app-${timestamp}-${random}`
}

// 数据加解密配置（默认关闭）
let dataEncryptionEnabled = false

export function setEncryptionEnabled(enabled) {
  dataEncryptionEnabled = enabled
}

export function isEncryptionEnabled() {
  return dataEncryptionEnabled
}

// 简单加密（XOR + Base64，生产环境应使用 AES）
const ENCRYPTION_KEY = 'TryOn@2024!Secret'

export function encryptData(data) {
  if (!dataEncryptionEnabled) {
    return data
  }
  const jsonStr = JSON.stringify(data)
  let encrypted = ''
  for (let i = 0; i < jsonStr.length; i += 1) {
    encrypted += String.fromCharCode(
      // eslint-disable-next-line no-bitwise
      jsonStr.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length)
    )
  }
  return btoa(encrypted)
}

export function decryptData(encrypted) {
  if (!dataEncryptionEnabled) {
    return encrypted
  }
  try {
    const decoded = atob(encrypted)
    let decrypted = ''
    for (let i = 0; i < decoded.length; i += 1) {
      decrypted += String.fromCharCode(
        // eslint-disable-next-line no-bitwise
        decoded.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length)
      )
    }
    return JSON.parse(decrypted)
  } catch {
    return encrypted
  }
}

// 从 Django ErrorDetail 字符串中提取错误信息
// 格式: "ErrorDetail(string='验证码错误', code='invalid')"
function parseErrorDetail(str) {
  if (typeof str !== 'string') {
    return str
  }
  const match = str.match(/string='([^']+)'/)
  return match ? match[1] : str
}

// 提取错误信息
function extractError(data) {
  if (!data) {
    return '请求失败'
  }

  // 直接的错误字符串
  if (typeof data === 'string') {
    return parseErrorDetail(data)
  }

  // 后端统一响应格式: { code, message, error_code, data }
  // 优先使用 message 字段
  if (data.message) {
    return parseErrorDetail(data.message)
  }

  // 兼容其他格式
  if (data.error) {
    if (typeof data.error === 'string') {
      return parseErrorDetail(data.error)
    }
    if (data.error.message) {
      return parseErrorDetail(data.error.message)
    }
  }

  if (data.detail) {
    return parseErrorDetail(data.detail)
  }

  // 处理 non_field_errors 数组
  if (
    data.non_field_errors &&
    Array.isArray(data.non_field_errors) &&
    data.non_field_errors.length > 0
  ) {
    return parseErrorDetail(data.non_field_errors[0])
  }

  // 处理其他字段错误（如 {'phone': ['该手机号不存在']}）
  const fieldErrors = Object.entries(data)
    .filter(([key]) => !['success', 'error_code', 'code', 'data', 'message'].includes(key))
    .filter(([, value]) => Array.isArray(value) && value.length > 0)
    .map(([, errors]) => parseErrorDetail(errors[0]))

  if (fieldErrors.length > 0) {
    return fieldErrors[0]
  }

  return '请求失败'
}

function handleResponse(response, data) {
  if (response.ok) {
    return { success: true, data }
  }
  return {
    success: false,
    error: extractError(data),
    status: response.status,
  }
}

// 刷新 Token（定义在 request 之前）
async function refreshToken() {
  const refresh = TokenManager.getRefreshToken()
  if (!refresh) {
    return false
  }

  try {
    const response = await fetch('/api/v1/auth/refresh/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    })

    if (response.ok) {
      const data = await response.json()
      TokenManager.setTokens(data.access, refresh)
      return true
    }
    return false
  } catch {
    return false
  }
}

// 通用请求方法
async function request(url, options = {}) {
  const { method = 'GET', body, requiresAuth = true, headers = {} } = options

  const config = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': generateRequestId(),
      ...headers,
    },
  }

  // 添加认证 Token
  if (requiresAuth) {
    const token = TokenManager.getAccessToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }

  // 处理 body
  if (body) {
    if (body instanceof FormData) {
      delete config.headers['Content-Type']
      config.body = body
    } else {
      // 加密请求体（如果启用）
      const bodyData = dataEncryptionEnabled ? { encrypted: encryptData(body) } : body
      config.body = JSON.stringify(bodyData)
    }
  }

  try {
    const response = await fetch(url, config)

    // 安全解析 JSON
    let data
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      data = await response.json()
      // 解密响应（如果启用）
      if (data && data.encrypted && dataEncryptionEnabled) {
        data = decryptData(data.encrypted)
      }
    } else {
      data = { detail: `服务器返回非预期格式 (HTTP ${response.status})` }
    }

    // Token 过期，尝试刷新
    if (response.status === 401 && requiresAuth) {
      const refreshed = await refreshToken()
      if (refreshed) {
        config.headers.Authorization = `Bearer ${TokenManager.getAccessToken()}`
        const retryResponse = await fetch(url, config)
        let retryData
        const retryContentType = retryResponse.headers.get('content-type') || ''
        if (retryContentType.includes('application/json')) {
          retryData = await retryResponse.json()
          if (retryData && retryData.encrypted && dataEncryptionEnabled) {
            retryData = decryptData(retryData.encrypted)
          }
        } else {
          retryData = { detail: `服务器返回非预期格式 (HTTP ${retryResponse.status})` }
        }
        return handleResponse(retryResponse, retryData)
      }
      TokenManager.clearTokens()
      localStorage.removeItem(STORAGE_KEYS.USER_INFO)
      window.dispatchEvent(new Event('auth:logout'))
    }

    return handleResponse(response, data)
  } catch (error) {
    return { success: false, error: error.message || '网络请求失败' }
  }
}

// 便捷方法
export const api = {
  get: (url, params) => {
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : ''
    return request(url + queryString)
  },

  post: (url, body, options) => request(url, { method: 'POST', body, ...options }),

  put: (url, body, options) => request(url, { method: 'PUT', body, ...options }),

  patch: (url, body, options) => request(url, { method: 'PATCH', body, ...options }),

  delete: (url, options) => request(url, { method: 'DELETE', ...options }),

  upload: (url, formData, options) =>
    request(url, { method: 'POST', body: formData, requiresAuth: true, ...options }),
}

// 获取完整的媒体文件 URL
export function getMediaUrl(path) {
  if (!path) {
    return ''
  }
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
  return `${baseUrl}${path}`
}
