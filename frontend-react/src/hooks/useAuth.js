import { useState, useCallback, useEffect } from 'react'

import { api, TokenManager } from '../utils/request'
import { API_ENDPOINTS } from '../config/api'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [quota, setQuota] = useState({ total: 100, used: 0, remaining: 100 })

  // 检查登录状态
  useEffect(() => {
    const checkAuth = async () => {
      if (!TokenManager.isAuthenticated()) {
        setLoading(false)
        return
      }

      try {
        const response = await api.get(API_ENDPOINTS.AUTH.ME)
        if (response.success) {
          setUser(response.data)
          setQuota({
            total: response.data.quota_total || 100,
            used: response.data.quota_used || 0,
            remaining: response.data.quota_remaining || 100,
          })
        }
      } catch (error) {
        // 静默处理错误
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  // 登录
  const login = useCallback(async (username, password) => {
    try {
      const response = await api.post(
        API_ENDPOINTS.AUTH.LOGIN,
        { username, password },
        { requiresAuth: false }
      )

      if (response.success) {
        const { access, refresh, user: userData } = response.data
        TokenManager.setTokens(access, refresh)
        setUser(userData)
        setQuota({
          total: userData.quota_total || 100,
          used: userData.quota_used || 0,
          remaining: userData.quota_remaining || 100,
        })
        return { success: true }
      }

      return { success: false, error: response.error }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }, [])

  // 登出
  const logout = useCallback(() => {
    TokenManager.clearTokens()
    setUser(null)
    setQuota({ total: 100, used: 0, remaining: 100 })
  }, [])

  // 更新配额
  const updateQuota = useCallback(used => {
    setQuota(prev => ({
      ...prev,
      used,
      remaining: prev.total - used,
    }))
  }, [])

  return {
    user,
    isAuthenticated: !!user,
    loading,
    quota,
    login,
    logout,
    updateQuota,
  }
}
