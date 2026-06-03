/**
 * HTTP 请求封装
 * 
 * 功能特性：
 * - JWT Token 自动管理和刷新
 * - 请求重试机制（指数退避）
 * - 请求超时配置
 * - 数据加密支持（可选）
 * - 标准化响应处理
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
    return currentSessionId.replace(/_/g, '-')
  }
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

function getEncryptionKey() {
  const key = import.meta.env.VITE_ENCRYPTION_KEY
  if (!key) {
    console.warn('VITE_ENCRYPTION_KEY 环境变量未设置，数据加密功能将不可用')
  }
  return key
}

export function encryptData(data) {
  if (!dataEncryptionEnabled) {
    return data
  }
  const key = getEncryptionKey()
  if (!key) {
    return data
  }
  const jsonStr = JSON.stringify(data)
  let encrypted = ''
  for (let i = 0; i < jsonStr.length; i += 1) {
    encrypted += String.fromCharCode(
      // eslint-disable-next-line no-bitwise
      jsonStr.charCodeAt(i) ^ key.charCodeAt(i % key.length)
    )
  }
  return btoa(encrypted)
}

export function decryptData(encrypted) {
  if (!dataEncryptionEnabled) {
    return encrypted
  }
  const key = getEncryptionKey()
  if (!key) {
    return encrypted
  }
  try {
    const decoded = atob(encrypted)
    let decrypted = ''
    for (let i = 0; i < decoded.length; i += 1) {
      decrypted += String.fromCharCode(
        // eslint-disable-next-line no-bitwise
        decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      )
    }
    return JSON.parse(decrypted)
  } catch {
    return encrypted
  }
}

// 从 Django ErrorDetail 字符串中提取错误信息
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

  if (typeof data === 'string') {
    return parseErrorDetail(data)
  }

  if (data.message) {
    return parseErrorDetail(data.message)
  }

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

  if (
    data.non_field_errors &&
    Array.isArray(data.non_field_errors) &&
    data.non_field_errors.length > 0
  ) {
    return parseErrorDetail(data.non_field_errors[0])
  }

  const fieldErrors = Object.entries(data)
    .filter(([key]) => !['success', 'error_code', 'code', 'data', 'message'].includes(key))
    .filter(([, value]) => Array.isArray(value) && value.length > 0)
    .map(([, errors]) => parseErrorDetail(errors[0]))

  if (fieldErrors.length > 0) {
    return fieldErrors[0]
  }

  return '请求失败'
}

// 请求重试配置
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000,
  retryDelayMultiplier: 2,
  retryOnStatusCodes: [429, 500, 502, 503, 504],
  timeout: 30000,
}

// 指数退避延迟计算
function calculateRetryDelay(retryCount, baseDelay, multiplier) {
  const delay = baseDelay * Math.pow(multiplier, retryCount)
  const jitter = Math.random() * baseDelay
  return delay + jitter
}

// 创建带超时的 Promise
function createTimeoutPromise(timeoutMs) {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error('请求超时'))
    }, timeoutMs)
  })
}

// 刷新 Token
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

// 构建请求配置
function buildRequestConfig(method, body, headers, requiresAuth) {
  const config = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': generateRequestId(),
      ...headers,
    },
  }

  if (requiresAuth) {
    const token = TokenManager.getAccessToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }

  if (body) {
    if (body instanceof FormData) {
      delete config.headers['Content-Type']
      config.body = body
    } else {
      const bodyData = dataEncryptionEnabled ? { encrypted: encryptData(body) } : body
      config.body = JSON.stringify(bodyData)
    }
  }

  return config
}

// 解析响应数据
async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const data = await response.json()
    if (data && data.encrypted && dataEncryptionEnabled) {
      return decryptData(data.encrypted)
    }
    return data
  }
  return { detail: `服务器返回非预期格式 (HTTP ${response.status})` }
}

// 处理响应
function handleResponse(response, data) {
  if (response.ok) {
    return { success: true, data }
  }
  return {
    success: false,
    error: extractError(data),
    status: response.status,
    errorCode: data?.error_code,
  }
}

// 执行单次请求
async function executeRequest(url, config, timeout) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, { ...config, signal: controller.signal })
    clearTimeout(timeoutId)
    const data = await parseResponse(response)
    return { response, data }
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error('请求超时')
    }
    throw error
  }
}

// 通用请求方法（带重试）
async function request(url, options = {}) {
  const {
    method = 'GET',
    body,
    requiresAuth = true,
    headers = {},
    retry: retryOptions = {},
  } = options

  // 合并重试配置
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryOptions }
  const { maxRetries, retryDelay, retryDelayMultiplier, retryOnStatusCodes, timeout } = retryConfig

  // 构建初始请求配置
  let config = buildRequestConfig(method, body, headers, requiresAuth)

  for (let retryCount = 0; retryCount <= maxRetries; retryCount++) {
    try {
      const { response, data } = await executeRequest(url, config, timeout)

      // Token 过期处理
      if (response.status === 401 && requiresAuth && retryCount === 0) {
        const refreshed = await refreshToken()
        if (refreshed) {
          config.headers.Authorization = `Bearer ${TokenManager.getAccessToken()}`
          const { response: retryResponse, data: retryData } = await executeRequest(url, config, timeout)
          return handleResponse(retryResponse, retryData)
        }
        TokenManager.clearTokens()
        localStorage.removeItem(STORAGE_KEYS.USER_INFO)
        window.dispatchEvent(new Event('auth:logout'))
      }

      // 检查是否需要重试
      if (retryOnStatusCodes.includes(response.status) && retryCount < maxRetries) {
        const delay = calculateRetryDelay(retryCount, retryDelay, retryDelayMultiplier)
        console.warn(`请求失败，准备重试 (${retryCount + 1}/${maxRetries})，延迟 ${delay.toFixed(0)}ms`)
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }

      return handleResponse(response, data)
    } catch (error) {
      // 网络错误或超时，尝试重试
      if (retryCount < maxRetries) {
        const delay = calculateRetryDelay(retryCount, retryDelay, retryDelayMultiplier)
        console.warn(`请求异常，准备重试 (${retryCount + 1}/${maxRetries})，延迟 ${delay.toFixed(0)}ms: ${error.message}`)
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }
      return { success: false, error: error.message || '网络请求失败' }
    }
  }

  return { success: false, error: '请求失败，已达到最大重试次数' }
}

// 便捷方法
export const api = {
  get: (url, params, options = {}) => {
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : ''
    return request(url + queryString, { method: 'GET', ...options })
  },

  post: (url, body, options = {}) => request(url, { method: 'POST', body, ...options }),

  put: (url, body, options = {}) => request(url, { method: 'PUT', body, ...options }),

  patch: (url, body, options = {}) => request(url, { method: 'PATCH', body, ...options }),

  delete: (url, options = {}) => request(url, { method: 'DELETE', ...options }),

  upload: (url, formData, options = {}) =>
    request(url, { method: 'POST', body: formData, requiresAuth: true, ...options }),

  // 禁用重试的请求
  getNoRetry: (url, params) => {
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : ''
    return request(url + queryString, { retry: { maxRetries: 0 } })
  },

  postNoRetry: (url, body, options = {}) =>
    request(url, { method: 'POST', body, retry: { maxRetries: 0 }, ...options }),
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

// 获取支持 WebP 格式的图片 URL
export function getWebpUrl(path) {
  if (!path) {
    return ''
  }
  if (path.startsWith('http://') || path.startsWith('https://')) {
    // 替换扩展名
    return path.replace(/\.(jpg|jpeg|png|gif)$/i, '.webp')
  }
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
  const webpPath = path.replace(/\.(jpg|jpeg|png|gif)$/i, '.webp')
  return `${baseUrl}${webpPath}`
}

const FILE_API_BASE = '/api/v1/file'

export function getFileUrl(fileIdOrUrl) {
  if (!fileIdOrUrl) {
    return ''
  }
  if (typeof fileIdOrUrl !== 'string') {
    console.warn('[getFileUrl] 参数必须是字符串')
    return ''
  }
  if (fileIdOrUrl.startsWith('/file/') || fileIdOrUrl.startsWith(`${FILE_API_BASE}/`)) {
    return fileIdOrUrl
  }
  if (fileIdOrUrl.startsWith('http://') || fileIdOrUrl.startsWith('https://')) {
    if (fileIdOrUrl.includes('/file/')) {
      const match = fileIdOrUrl.match(/\/file\/([^/]+)/)
      if (match) {
        return `${FILE_API_BASE}/${match[1]}/`
      }
    }
    return fileIdOrUrl
  }
  if (fileIdOrUrl.includes('-') && fileIdOrUrl.length > 30) {
    return `${FILE_API_BASE}/${fileIdOrUrl}/`
  }
  return fileIdOrUrl
}

export function parseFileIdFromUrl(url) {
  if (!url) return null
  if (url.includes('/file/')) {
    const match = url.match(/\/file\/([^/]+)/)
    return match ? match[1] : null
  }
  return null
}

export function isFileUrl(url) {
  if (!url) return false
  return url.startsWith('/file/') || url.startsWith(`${FILE_API_BASE}/`)
}