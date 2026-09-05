import { useState, useCallback, useEffect } from 'react'

import { api, TokenManager, setSessionId } from '../utils/request'
import { API_ENDPOINTS } from '../config/api'
import { STORAGE_KEYS } from '../constants/storageKeys'
import { safeStorage } from '../utils/safeStorage'

/**
 * 应用会话 Hook
 * 管理用户认证状态、用户信息、配额、会话客户 ID、管理员联系信息
 */
export function useAppSession({ t, showToast, onShowAdminContact }) {
  // === 用户认证状态 ===
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userInfo, setUserInfo] = useState(null)
  const [loginLoading, setLoginLoading] = useState(false)

  // === 配额信息 ===
  const [quota, setQuota] = useState({ total: 100, used: 0, remaining: 100 })

  // === 管理员联系信息 ===
  const [adminContactInfo, setAdminContactInfo] = useState(null)
  const [adminContactLoading, setAdminContactLoading] = useState(false)

  // === 会话客户 ID ===
  const [sessionCustomer, setSessionCustomer] = useState(() => {
    const cached = localStorage.getItem(STORAGE_KEYS.SESSION_CUSTOMER)
    if (cached) {
      setSessionId(cached)
      return cached
    }
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '')
    const newCustomer = `Customer_${dateStr}_${timeStr}`
    localStorage.setItem(STORAGE_KEYS.SESSION_CUSTOMER, newCustomer)
    setSessionId(newCustomer)
    return newCustomer
  })

  // === 同步 sessionId ===
  useEffect(() => {
    if (sessionCustomer) {
      setSessionId(sessionCustomer)
    }
  }, [sessionCustomer])

  // === 监听全局登出事件 ===
  useEffect(() => {
    const handleLogoutEvent = () => {
      setIsLoggedIn(false)
      setUserInfo(null)
      localStorage.removeItem(STORAGE_KEYS.USER_INFO)
    }
    window.addEventListener('auth:logout', handleLogoutEvent)
    return () => window.removeEventListener('auth:logout', handleLogoutEvent)
  }, [])

  // === 用户信息变化时更新配额 ===
  useEffect(() => {
    if (userInfo && userInfo.quota_total !== undefined) {
      setQuota({
        total: userInfo.quota_total,
        used: userInfo.quota_used || 0,
        remaining: userInfo.quota_remaining || userInfo.quota_total - (userInfo.quota_used || 0),
      })
    }
  }, [userInfo])

  // === 刷新用户信息 ===
  const refreshUserInfo = useCallback(async () => {
    try {
      const response = await api.get(API_ENDPOINTS.AUTH.ME)
      if (response.success) {
        const userData = response.data?.data || response.data
        setUserInfo(userData)
        localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(userData))
      }
    } catch (error) {
      // 忽略刷新用户信息失败
    }
  }, [])

  // === 登出 ===
  const handleLogout = useCallback(() => {
    TokenManager.clearTokens()
    setIsLoggedIn(false)
    setUserInfo(null)
    localStorage.removeItem(STORAGE_KEYS.USER_INFO)
    safeStorage.removeItem(STORAGE_KEYS.WARDROBE_CLOTHING)
    safeStorage.removeItem(STORAGE_KEYS.CUSTOM_CLOTHING)
    if (showToast) {
      showToast(t?.('loggedOut') || '已退出登录', 'info')
    }
  }, [showToast, t])

  // 说明：「结束会话」由 App.handleEndSession 实现（带确认弹窗 + 清服务端试穿记录 +
  // 重置形象/服装/结果 + 换新会话 ID）。此处不再重复实现——原实现依赖的
  // API_ENDPOINTS.AUTH.END_SESSION 在 config/api.js 中并不存在，后端也无该路由。

  // === 获取管理员联系信息 ===
  const fetchAdminContact = useCallback(async () => {
    setAdminContactLoading(true)
    try {
      const response = await api.get(API_ENDPOINTS.AUTH.ADMIN_CONTACT, { requiresAuth: false })
      if (response.success) {
        const { data } = response
        if (data && data.success && data.data) {
          setAdminContactInfo(data.data)
        } else if (data) {
          setAdminContactInfo(data)
        }
      }
    } catch (error) {
      console.error('Failed to fetch admin contact:', error)
    } finally {
      setAdminContactLoading(false)
    }
  }, [])

  // === 脱敏工具函数 ===
  const maskPhone = useCallback(phone => {
    if (!phone || phone.length < 7) {
      return phone
    }
    return `${phone.slice(0, 3)}****${phone.slice(-4)}`
  }, [])

  const maskWechat = useCallback(wechat => {
    if (!wechat || wechat.length < 4) {
      return wechat
    }
    return `${wechat.slice(0, 2)}***${wechat.slice(-2)}`
  }, [])

  const maskEmail = useCallback(email => {
    if (!email || !email.includes('@')) {
      return email
    }
    const [name, domain] = email.split('@')
    return `${name.slice(0, 2)}***@${domain}`
  }, [])

  // === 登录成功后的公共处理：获取用户信息 + 设置状态 ===
  const handleLoginSuccess = useCallback(async loginData => {
    TokenManager.setTokens(loginData.access_token, loginData.refresh_token)
    // 登录成功后获取用户信息
    try {
      const meResponse = await api.get(API_ENDPOINTS.AUTH.ME)
      if (meResponse.success) {
        const meInfo = meResponse.data?.data || meResponse.data
        localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(meInfo))
        setUserInfo(meInfo)
      }
    } catch (meError) {
      console.error('获取用户信息失败:', meError)
    }
    setIsLoggedIn(true)
  }, [])

  // === 用户名密码登录 ===
  const handleLoginSubmit = useCallback(
    async (username, password) => {
      if (!username || !password) {
        showToast?.(t?.('n_loginInputEmpty'), 'warning')
        return
      }

      setLoginLoading(true)
      try {
        const response = await api.post(
          API_ENDPOINTS.AUTH.LOGIN,
          {
            username,
            password,
          },
          { requiresAuth: false }
        )

        if (response.success) {
          const loginData = response.data?.data || response.data
          await handleLoginSuccess(loginData)
          showToast?.(t?.('n_loginSuccess'), 'success')
        } else {
          const errorMsg = response.error || t?.('n_loginError')
          showToast?.(errorMsg, 'error')
          if (errorMsg?.includes('待审核') || errorMsg?.includes('联系管理员')) {
            onShowAdminContact?.()
          }
        }
      } catch (error) {
        const errorMsg = error?.response?.data?.error || error?.message || t?.('n_loginFail')
        showToast?.(errorMsg, 'error')
        if (errorMsg?.includes('待审核') || errorMsg?.includes('联系管理员')) {
          onShowAdminContact?.()
        }
      } finally {
        setLoginLoading(false)
      }
    },
    [showToast, t, onShowAdminContact, handleLoginSuccess]
  )

  // === 短信验证码登录 ===
  const handleSmsLogin = useCallback(
    async (phone, code) => {
      if (!phone || !code) {
        showToast?.(t?.('n_loginPhoneEmpty'), 'warning')
        return
      }

      setLoginLoading(true)
      try {
        const response = await api.post(
          API_ENDPOINTS.AUTH.SMS_LOGIN,
          {
            phone,
            code,
          },
          { requiresAuth: false }
        )

        if (response.success) {
          const loginData = response.data?.data || response.data
          await handleLoginSuccess(loginData)
          showToast?.(t?.('n_loginSuccess'), 'success')
        } else {
          const errorMsg = response.error || t?.('n_smsError')
          showToast?.(errorMsg, 'error')
          if (errorMsg?.includes('待审核') || errorMsg?.includes('联系管理员')) {
            onShowAdminContact?.()
          }
        }
      } catch (error) {
        const errorMsg = error?.response?.data?.error || error?.message || t?.('n_loginFail')
        showToast?.(errorMsg, 'error')
        if (errorMsg?.includes('待审核') || errorMsg?.includes('联系管理员')) {
          onShowAdminContact?.()
        }
      } finally {
        setLoginLoading(false)
      }
    },
    [showToast, t, onShowAdminContact, handleLoginSuccess]
  )

  // === 发送短信验证码 ===
  const handleSendSms = useCallback(
    async phone => {
      if (!phone) {
        showToast?.(t?.('n_phoneEmpty'), 'warning')
        return false
      }

      try {
        const response = await api.post(
          API_ENDPOINTS.AUTH.SEND_SMS,
          {
            phone,
            purpose: 'login',
          },
          { requiresAuth: false }
        )

        if (response.success) {
          showToast?.(t?.('n_smsSent'), 'success')
          return true
        }
        showToast?.(response.error || t?.('n_smsSendFail'), 'error')
        return false
      } catch (error) {
        showToast?.(t?.('n_smsSendFailRetry'), 'error')
        return false
      }
    },
    [showToast, t]
  )

  // === 用户注册 ===
  const handleRegister = useCallback(
    async (username, phone, password, storeName = '') => {
      if (!username || !phone || !password) {
        showToast?.(t?.('n_registerInputEmpty') || '请填写完整信息', 'warning')
        return
      }

      setLoginLoading(true)
      try {
        const response = await api.post(
          API_ENDPOINTS.AUTH.REGISTER,
          {
            username,
            phone,
            password,
            store_name: storeName,
          },
          { requiresAuth: false }
        )

        if (response.success) {
          const registerData = response.data?.data || response.data
          TokenManager.setTokens(registerData.access_token, registerData.refresh_token)
          localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(registerData.merchant))
          setUserInfo(registerData.merchant)
          setIsLoggedIn(true)
          showToast?.(t?.('n_registerSuccess') || '注册成功', 'success')
        } else {
          showToast?.(response.error || t?.('n_registerError') || '注册失败', 'error')
        }
      } catch (error) {
        showToast?.(t?.('n_registerFail') || '注册失败，请稍后重试', 'error')
      } finally {
        setLoginLoading(false)
      }
    },
    [showToast, t]
  )

  return {
    // 认证状态
    isLoggedIn,
    setIsLoggedIn,
    userInfo,
    setUserInfo,
    loginLoading,
    setLoginLoading,

    // 配额
    quota,
    setQuota,

    // 管理员联系
    adminContactInfo,
    setAdminContactInfo,
    adminContactLoading,
    fetchAdminContact,

    // 会话
    sessionCustomer,
    setSessionCustomer,

    // 方法
    refreshUserInfo,
    handleLogout,
    handleLoginSubmit,
    handleSmsLogin,
    handleSendSms,
    handleRegister,
    maskPhone,
    maskWechat,
    maskEmail,
  }
}
