import { useState, useCallback, useEffect } from 'react'

import { I18nProvider } from './hooks/useI18n'
import { useTryOn } from './hooks/useTryOn'
import { useClothing } from './hooks/useClothing'
import { api, TokenManager, setSessionId } from './utils/request'
import { API_ENDPOINTS } from './config/api'
import Header from './components/Header'
import MainLayout from './components/MainLayout'
import Toast from './components/Toast'
import LoginModal from './components/LoginModal'
import GlobalLoading from './components/GlobalLoading'
import { STORAGE_KEYS } from './constants/storageKeys'

export default function App() {
  const [appLoading, setAppLoading] = useState(true)
  const [theme] = useState('light')
  const [toast, setToast] = useState(null)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [_showUploadModal] = useState(false)
  const [quota, setQuota] = useState({ total: 100, used: 0, remaining: 100 })
  const [hasResult, setHasResult] = useState(false)
  const [selected, setSelected] = useState([])
  const [customClothing, setCustomClothing] = useState([])
  const [wardrobeClothing, setWardrobeClothing] = useState([])
  // tryOnHistory 由 useTryOn hook 提供
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showStoreModal, setShowStoreModal] = useState(false)
  const [showWardrobeModal, setShowWardrobeModal] = useState(false)
  const [showCustomUploadModal, setShowCustomUploadModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmConfig, setConfirmConfig] = useState({ title: '', message: '', action: null })
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [previewModalData, setPreviewModalData] = useState({ src: '', name: '' })
  const [showCameraModal, setShowCameraModal] = useState(false)
  const [cameraCallback, setCameraCallback] = useState(null)
  // 衣橱上传状态
  const [wardrobeUploadCategory, setWardrobeUploadCategory] = useState('tops')
  const [wardrobeUploadSubcategory, setWardrobeUploadSubcategory] = useState('')
  const [wardrobeUploadSubcategoryCustom, setWardrobeUploadSubcategoryCustom] = useState('')
  const [wardrobeUploadName, setWardrobeUploadName] = useState('')
  // 自定义上传分类
  const [customUploadCategory, setCustomUploadCategory] = useState('tops')
  const [customUploadSubcategory, setCustomUploadSubcategory] = useState('')
  const [customUploadSubcategoryCustom, setCustomUploadSubcategoryCustom] = useState('')
  const [customUploadName, setCustomUploadName] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userInfo, setUserInfo] = useState(null)
  const [loginLoading, setLoginLoading] = useState(false)

  // 从 userInfo 更新配额
  useEffect(() => {
    if (userInfo && userInfo.quota_total !== undefined) {
      setQuota({
        total: userInfo.quota_total,
        used: userInfo.quota_used || 0,
        remaining: userInfo.quota_remaining || userInfo.quota_total - (userInfo.quota_used || 0),
      })
    }
  }, [userInfo])

  // 当前顾客标识（持久化到 localStorage，刷新不丢失）
  const [sessionCustomer, setSessionCustomer] = useState(() => {
    // 优先从缓存恢复
    const cached = localStorage.getItem(STORAGE_KEYS.SESSION_CUSTOMER)
    if (cached) {
      setSessionId(cached) // 同步到 request.js
      return cached
    }
    // 没有缓存则生成新的
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '')
    const newCustomer = `Customer_${dateStr}_${timeStr}`
    localStorage.setItem(STORAGE_KEYS.SESSION_CUSTOMER, newCustomer)
    setSessionId(newCustomer) // 同步到 request.js
    return newCustomer
  })

  // 同步 sessionCustomer 到 request.js
  useEffect(() => {
    if (sessionCustomer) {
      setSessionId(sessionCustomer)
    }
  }, [sessionCustomer])

  // 监听登出事件（token 过期时触发）
  useEffect(() => {
    const handleLogout = () => {
      setIsLoggedIn(false)
      setUserInfo(null)
      localStorage.removeItem(STORAGE_KEYS.USER_INFO)
    }
    window.addEventListener('auth:logout', handleLogout)
    return () => window.removeEventListener('auth:logout', handleLogout)
  }, [])

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  // 刷新用户信息（含配额）
  const refreshUserInfo = useCallback(async () => {
    try {
      const response = await api.get(API_ENDPOINTS.AUTH.ME)
      if (response.success) {
        const userData = response.data?.data || response.data
        setUserInfo(userData)
        localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(userData))
      }
    } catch (error) {
      // 静默处理错误
    }
  }, [])

  // 试穿完成回调
  const handleTryOnComplete = useCallback(
    ({ resultUrl: _url }) => {
      showToast('试穿完成！', 'success')
      setHasResult(true)
      // 刷新用户信息获取最新配额
      refreshUserInfo()
    },
    [showToast, refreshUserInfo]
  )

  // 试穿失败回调
  const handleTryOnError = useCallback(
    error => {
      showToast(error || '试穿失败', 'error')
    },
    [showToast]
  )

  const {
    status,
    progress,
    resultUrl,
    history: tryOnHistory,
    avatarKey,
    remainingTime, // 剩余等待时间（秒）
    submitTask,
    fetchHistory,
    clearResult,
    startGenerating,
    cancelGenerating,
  } = useTryOn(
    handleTryOnComplete,
    handleTryOnError,
    sessionCustomer // 传入 Customer 标识作为 session_id
  )

  // 服装管理
  const {
    clothing,
    categories,
    loading: clothingLoading,
    fetchClothing,
    fetchCategories,
    uploadClothing,
    deleteClothing,
  } = useClothing()

  // 初始化登录状态（检查是否有已保存的 Token）
  useEffect(() => {
    const initApp = async () => {
      const startTime = Date.now()
      const MIN_LOADING_TIME = 2000

      if (TokenManager.isAuthenticated()) {
        // 先从缓存恢复用户信息（快速显示）
        const cachedUserInfo = localStorage.getItem(STORAGE_KEYS.USER_INFO)
        if (cachedUserInfo) {
          try {
            const parsed = JSON.parse(cachedUserInfo)
            setUserInfo(parsed)
            setIsLoggedIn(true)
          } catch (e) {
            // 缓存解析失败，忽略
          }
        }

        try {
          // 验证 Token 并获取最新用户信息
          const response = await api.get(API_ENDPOINTS.AUTH.ME)
          if (response.success) {
            const userData = response.data?.data || response.data
            setIsLoggedIn(true)
            setUserInfo(userData)
            // 更新缓存
            localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(userData))
          } else {
            // Token 无效，清除
            TokenManager.clearTokens()
            localStorage.removeItem(STORAGE_KEYS.USER_INFO)
            setIsLoggedIn(false)
            setUserInfo(null)
          }
        } catch (error) {
          // 网络错误时保留缓存状态，不清除 Token
          // 如果没有缓存用户信息但 Token 存在，标记为已登录但不显示用户详情
          if (!cachedUserInfo) {
            setIsLoggedIn(true)
            setUserInfo({ store_name: '已登录' })
          }
        }
      }

      // 从本地缓存恢复头像预览
      const cachedAvatar = localStorage.getItem(STORAGE_KEYS.AVATAR_PREVIEW)
      if (cachedAvatar) {
        setAvatarPreview(cachedAvatar)
      }

      // 从本地缓存恢复自定义服装
      const cachedCustomClothing = localStorage.getItem(STORAGE_KEYS.CUSTOM_CLOTHING)
      if (cachedCustomClothing) {
        try {
          setCustomClothing(JSON.parse(cachedCustomClothing))
        } catch (e) {
          // 缓存解析失败，忽略
        }
      }

      // 从本地缓存恢复衣橱服装
      const cachedWardrobeClothing = localStorage.getItem(STORAGE_KEYS.WARDROBE_CLOTHING)
      if (cachedWardrobeClothing) {
        try {
          setWardrobeClothing(JSON.parse(cachedWardrobeClothing))
        } catch (e) {
          // 缓存解析失败，忽略
        }
      }

      // 从本地缓存恢复已选服装
      const cachedSelected = localStorage.getItem(STORAGE_KEYS.SELECTED_CLOTHING)
      if (cachedSelected) {
        try {
          setSelected(JSON.parse(cachedSelected))
        } catch (e) {
          // 缓存解析失败，忽略
        }
      }

      // 确保至少显示 3 秒 loading
      const elapsed = Date.now() - startTime
      const remainingTime = MIN_LOADING_TIME - elapsed
      if (remainingTime > 0) {
        await new Promise(resolve => {
          setTimeout(resolve, remainingTime)
        })
      }
      setAppLoading(false)
    }

    initApp()
  }, [])

  // 登录成功后加载数据
  useEffect(() => {
    if (isLoggedIn) {
      fetchHistory()
      fetchClothing()
      fetchCategories()
    }
  }, [isLoggedIn, fetchHistory, fetchClothing, fetchCategories])

  // 主题切换
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  // 头像上传处理（保存到本地缓存）
  const handleAvatarChange = useCallback(e => {
    const file = e.target.files?.[0]
    if (file) {
      setAvatarFile(file)
      const reader = new FileReader()
      reader.onload = ev => {
        const base64 = ev.target.result
        setAvatarPreview(base64)
        // 保存到本地缓存
        localStorage.setItem(STORAGE_KEYS.AVATAR_PREVIEW, base64)
        // 上传新头像时清除复用的 key
        localStorage.removeItem(STORAGE_KEYS.REUSE_AVATAR_KEY)
      }
      reader.readAsDataURL(file)
    } else if (e.target.files === null) {
      // 删除头像
      setAvatarFile(null)
      setAvatarPreview(null)
      localStorage.removeItem(STORAGE_KEYS.AVATAR_PREVIEW)
      localStorage.removeItem(STORAGE_KEYS.REUSE_AVATAR_KEY)
    }
  }, [])

  // 试穿处理
  const handleTryOn = useCallback(async () => {
    // 检查登录状态
    if (!isLoggedIn) {
      showToast('请先登录商家账号', 'warning')
      setShowLoginModal(true)
      return
    }

    if (!avatarPreview) {
      showToast('请先上传形象照', 'warning')
      return
    }
    if (selected.length === 0) {
      showToast('请选择至少一件服装', 'warning')
      return
    }
    if (quota.remaining <= 0) {
      showToast('配额已用完', 'error')
      return
    }

    // 立即显示 loading 状态
    startGenerating()

    // 提交前再次校验配额（防止盗刷）
    try {
      const meResponse = await api.get(API_ENDPOINTS.AUTH.ME)
      if (meResponse.success) {
        const serverQuota = meResponse.data?.data || meResponse.data
        if (serverQuota?.quota_remaining !== undefined && serverQuota.quota_remaining <= 0) {
          cancelGenerating()
          showToast('配额已用完', 'error')
          refreshUserInfo()
          return
        }
      }
    } catch (e) {
      // 验证失败不阻止请求，继续执行
    }

    // 检查是否有复用的 avatar_key
    const reuseAvatarKey = localStorage.getItem(STORAGE_KEYS.REUSE_AVATAR_KEY)
    let fileToSubmit = null
    let keyToReuse = null

    if (reuseAvatarKey) {
      // 使用 avatar_key 复用
      keyToReuse = reuseAvatarKey
      // 使用后清除缓存
      localStorage.removeItem(STORAGE_KEYS.REUSE_AVATAR_KEY)
    } else if (avatarFile) {
      // 有头像文件，直接上传
      fileToSubmit = avatarFile
    } else if (avatarPreview) {
      // 没有 avatarFile 但有 avatarPreview（从缓存恢复或使用模特）
      try {
        // avatarPreview 可能是:
        // 1. base64 格式 (data:image/...;base64,...)
        // 2. 相对路径 (/images/model.png)
        const response = await fetch(avatarPreview)
        if (!response.ok) {
          throw new Error(`Failed to fetch avatar: ${response.status}`)
        }
        const blob = await response.blob()
        if (blob.size === 0) {
          throw new Error('Avatar blob is empty')
        }
        fileToSubmit = new File([blob], 'avatar.jpg', { type: blob.type || 'image/jpeg' })
        // 只有非模特图片才保存到 avatarFile（模特图片每次都重新 fetch）
        if (!avatarPreview.startsWith('/images/')) {
          setAvatarFile(fileToSubmit)
        }
      } catch (e) {
        cancelGenerating()
        showToast('图片处理失败，请重新上传', 'error')
        return
      }
    }

    await submitTask(fileToSubmit, selected, keyToReuse)

    // 移动端：滚动到结果展示区域
    if (window.innerWidth < 1024) {
      setTimeout(() => {
        const resultArea = document.getElementById('tryon-result-area')
        if (resultArea) {
          resultArea.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
    }
  }, [
    isLoggedIn,
    avatarPreview,
    avatarFile,
    selected,
    quota.remaining,
    submitTask,
    showToast,
    startGenerating,
    cancelGenerating,
    refreshUserInfo,
  ])

  // 通知弹窗（保留用于未来扩展）
  const _showNotification = useCallback(
    (message, type = 'success') => {
      showToast(message, type)
    },
    [showToast]
  )

  // 确认弹窗
  const showConfirmDialog = useCallback((title, message, action) => {
    setConfirmConfig({ title, message, action })
    setShowConfirmModal(true)
  }, [])

  const handleConfirmAction = useCallback(() => {
    if (confirmConfig.action) {
      confirmConfig.action()
    }
    setShowConfirmModal(false)
    setConfirmConfig({ title: '', message: '', action: null })
  }, [confirmConfig])

  // 图片预览弹窗
  const openPreviewModal = useCallback((src, name) => {
    setPreviewModalData({ src, name })
    setShowPreviewModal(true)
  }, [])

  const closePreviewModal = useCallback(() => {
    setShowPreviewModal(false)
    setPreviewModalData({ src: '', name: '' })
  }, [])

  // 拍照选择弹窗
  const openCameraModal = useCallback(callback => {
    setCameraCallback(callback)
    setShowCameraModal(true)
  }, [])

  const closeCameraModal = useCallback(() => {
    setShowCameraModal(false)
    setCameraCallback(null)
  }, [])

  const handleLogout = useCallback(() => {
    showConfirmDialog('确认退出登录？', '退出后需要重新登录才能使用试穿功能', () => {
      // 清理认证信息
      TokenManager.clearTokens()
      localStorage.removeItem(STORAGE_KEYS.USER_INFO)
      setIsLoggedIn(false)
      setUserInfo(null)

      // 清理配额
      setQuota({ total: 100, used: 0, remaining: 100 })

      // 清理试穿相关状态
      setSelected([])
      setAvatarFile(null)
      setAvatarPreview(null)
      setHasResult(false)
      clearResult() // 清除 useTryOn 状态
      setCustomClothing([])
      setWardrobeClothing([])

      // 清理本地缓存
      localStorage.removeItem(STORAGE_KEYS.AVATAR_PREVIEW)
      localStorage.removeItem(STORAGE_KEYS.CUSTOM_CLOTHING)
      localStorage.removeItem(STORAGE_KEYS.WARDROBE_CLOTHING)
      localStorage.removeItem(STORAGE_KEYS.SELECTED_CLOTHING)
      localStorage.removeItem(STORAGE_KEYS.SESSION_CUSTOMER)

      showToast('已退出登录', 'info')
    })
  }, [showConfirmDialog, showToast, clearResult])

  // 结束试穿（清除本地缓存和试穿记录）
  const handleEndSession = useCallback(async () => {
    showConfirmDialog('确认结束试穿？', '将清空所有试穿数据、形象照片和试穿记录', async () => {
      // 保存当前 session_id 用于清除
      const currentSessionId = sessionCustomer

      // 先清空后端试穿记录（仅当前顾客）
      try {
        await api.delete(
          `${API_ENDPOINTS.TRYON.CLEAR}?session_id=${encodeURIComponent(currentSessionId)}`
        )
      } catch (error) {
        // 静默处理清除错误
      }

      setSelected([])
      setAvatarFile(null)
      setAvatarPreview(null)
      setHasResult(false)
      clearResult() // 清除 useTryOn 状态
      setCustomClothing([])
      setWardrobeClothing([])
      // 清除本地缓存
      localStorage.removeItem(STORAGE_KEYS.AVATAR_PREVIEW)
      localStorage.removeItem(STORAGE_KEYS.CUSTOM_CLOTHING)
      localStorage.removeItem(STORAGE_KEYS.WARDROBE_CLOTHING)
      localStorage.removeItem(STORAGE_KEYS.SELECTED_CLOTHING)

      // 生成新顾客标识并保存到缓存
      const now = new Date()
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
      const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '')
      const newCustomer = `Customer_${dateStr}_${timeStr}`
      localStorage.setItem(STORAGE_KEYS.SESSION_CUSTOMER, newCustomer)
      setSessionCustomer(newCustomer)
      showToast('试穿已结束，所有数据已清空', 'info')
    })
  }, [showConfirmDialog, showToast, clearResult, sessionCustomer])

  // 清空历史（当前顾客的记录）
  const handleClearHistory = useCallback(async () => {
    if (!tryOnHistory || tryOnHistory.length === 0) {
      showToast('暂无试穿记录', 'info')
      return
    }
    showConfirmDialog(
      '确认清空试穿记录？',
      '当前顾客的试穿记录将被删除，此操作不可恢复',
      async () => {
        try {
          const response = await api.delete(
            `${API_ENDPOINTS.TRYON.CLEAR}?session_id=${encodeURIComponent(sessionCustomer)}`
          )
          if (response.success) {
            // 等待一小段时间让后端完成更新
            await new Promise(resolve => {
              setTimeout(resolve, 100)
            })
            await fetchHistory()
            const deletedCount =
              response.data?.deleted_count || response.data?.data?.deleted_count || 0
            showToast(`已清空 ${deletedCount} 条记录`, 'info')
          } else {
            // 清除失败，静默处理
          }
        } catch (error) {
          showToast('清空失败', 'error')
        }
      }
    )
  }, [tryOnHistory, showConfirmDialog, showToast, fetchHistory, sessionCustomer])

  // 清空选择
  const handleClearSelection = useCallback(() => {
    setSelected([])
    setHasResult(false)
  }, [])

  // 切换收藏
  const handleToggleHistorySaved = useCallback(
    async uuid => {
      // 找到当前记录的收藏状态
      const record = tryOnHistory?.find(r => r.uuid === uuid)
      const newSavedState = record ? !record.is_saved : true

      try {
        const response = await api.post(API_ENDPOINTS.TRYON.SAVE(uuid), { is_saved: newSavedState })
        if (response.success) {
          fetchHistory() // 刷新历史
          showToast(newSavedState ? '已收藏' : '已取消收藏', 'success')
        }
      } catch (error) {
        showToast('操作失败', 'error')
      }
    },
    [tryOnHistory, fetchHistory, showToast]
  )

  // 删除单条记录
  const handleDeleteHistory = useCallback(
    async uuid => {
      try {
        const response = await api.delete(API_ENDPOINTS.TRYON.DELETE(uuid))
        if (response.success) {
          fetchHistory()
          showToast('记录已删除', 'info')
        } else {
          showToast('删除失败', 'error')
        }
      } catch (error) {
        showToast('删除失败', 'error')
      }
    },
    [fetchHistory, showToast]
  )

  // 从历史记录复用头像
  const handleReuseAvatarFromHistory = useCallback(
    recordUuid => {
      // 从历史记录中找到对应记录
      const record = tryOnHistory?.find(r => r.uuid === recordUuid)
      if (!record) {
        showToast('未找到该记录', 'error')
        return
      }

      // 优先使用 avatar_key（存储 key），其次使用 uuid（历史记录 uuid）
      const keyToReuse = record.avatar_key || record.uuid

      if (!keyToReuse) {
        showToast('该记录没有可复用的头像', 'warning')
        return
      }

      // 设置头像预览（使用历史记录中的头像 URL）
      if (record.avatar_url) {
        setAvatarPreview(record.avatar_url)
        localStorage.setItem(STORAGE_KEYS.AVATAR_PREVIEW, record.avatar_url)
        // 清除 avatarFile，因为我们将使用 key 复用
        setAvatarFile(null)
      }

      // 缓存复用的 key，供下次试穿使用
      localStorage.setItem(STORAGE_KEYS.REUSE_AVATAR_KEY, keyToReuse)

      showToast('已复用历史头像，请选择服装后开始试穿', 'success')
    },
    [tryOnHistory, showToast]
  )

  // ESC 关闭弹窗
  useEffect(() => {
    const handler = e => {
      if (e.key === 'Escape') {
        if (showLoginModal) {
          setShowLoginModal(false)
          return
        }
        if (showSettingsModal) {
          setShowSettingsModal(false)
          return
        }
        if (showStoreModal) {
          setShowStoreModal(false)
          return
        }
        if (showWardrobeModal) {
          setShowWardrobeModal(false)
          return
        }
        if (showConfirmModal) {
          setShowConfirmModal(false)
          return
        }
        if (showPreviewModal) {
          closePreviewModal()
          return
        }
        if (showCameraModal) {
          closeCameraModal()
        }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [
    showLoginModal,
    showSettingsModal,
    showStoreModal,
    showWardrobeModal,
    showConfirmModal,
    showPreviewModal,
    showCameraModal,
  ])

  // 登录弹窗 - 账号密码登录
  const handleLoginSubmit = useCallback(
    async (username, password) => {
      if (!username || !password) {
        showToast('请输入账号和密码', 'warning')
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
          // 后端返回结构：{ success: true, data: { success: true, data: { access_token, merchant, ... } } }
          const loginData = response.data?.data || response.data
          // 保存 Token
          TokenManager.setTokens(loginData.access_token, loginData.refresh_token)

          // 保存用户信息到缓存
          localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(loginData.merchant))

          // 更新状态
          setIsLoggedIn(true)
          setUserInfo(loginData.merchant)
          setShowLoginModal(false)
          showToast('登录成功，欢迎回来！', 'success')
        } else {
          showToast(response.error || '账号或密码错误', 'error')
        }
      } catch (error) {
        showToast('登录失败，请稍后重试', 'error')
      } finally {
        setLoginLoading(false)
      }
    },
    [showToast]
  )

  // 短信验证码登录
  const handleSmsLogin = useCallback(
    async (phone, code) => {
      if (!phone || !code) {
        showToast('请输入手机号和验证码', 'warning')
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
          TokenManager.setTokens(loginData.access_token, loginData.refresh_token)
          // 保存用户信息到缓存
          localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(loginData.merchant))
          setIsLoggedIn(true)
          setUserInfo(loginData.merchant)
          setShowLoginModal(false)
          showToast('登录成功，欢迎回来！', 'success')
        } else {
          showToast(response.error || '验证码错误', 'error')
        }
      } catch (error) {
        showToast('登录失败，请稍后重试', 'error')
      } finally {
        setLoginLoading(false)
      }
    },
    [showToast]
  )

  // 发送验证码
  const handleSendSms = useCallback(
    async phone => {
      if (!phone) {
        showToast('请输入手机号', 'warning')
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
          showToast('验证码已发送', 'success')
          return true
        }
        showToast(response.error || '发送失败', 'error')
        return false
      } catch (error) {
        showToast('发送失败，请稍后重试', 'error')
        return false
      }
    },
    [showToast]
  )

  // 保存试穿结果（保留用于未来扩展）
  const _handleSaveResult = useCallback(() => {
    if (!hasResult || tryOnHistory.length === 0) {
      showToast('暂无可保存的试穿结果', 'warning')
      return
    }
    const latest = tryOnHistory[0]
    if (latest) {
      handleToggleHistorySaved(latest.id)
    }
  }, [hasResult, tryOnHistory, handleToggleHistorySaved, showToast])

  // 分享（保留用于未来扩展）
  const _handleShare = useCallback(() => {
    if (!hasResult) {
      showToast('暂无可分享的试穿结果', 'warning')
      return
    }
    showToast('分享功能暂未开放，敬请期待', 'info')
  }, [hasResult, showToast])

  // 服装选择切换（同类型替换，保存到本地缓存）
  const handleToggle = useCallback(item => {
    setSelected(prev => {
      const exists = prev.find(s => s.id === item.id)
      let newList
      if (exists) {
        newList = prev.filter(s => s.id !== item.id)
      } else {
        // 同类型替换：同一 category 只保留一件
        const filtered = prev.filter(s => s.category !== item.category)
        newList = [...filtered, item]
      }
      localStorage.setItem(STORAGE_KEYS.SELECTED_CLOTHING, JSON.stringify(newList))
      return newList
    })
  }, [])

  // 移除已选服装（更新本地缓存）
  const handleRemoveSelected = useCallback(id => {
    setSelected(prev => {
      const newList = prev.filter(s => s.id !== id)
      localStorage.setItem(STORAGE_KEYS.SELECTED_CLOTHING, JSON.stringify(newList))
      return newList
    })
  }, [])

  // 自定义服装上传（保存到本地缓存，带重复校验）
  const handleCustomUpload = useCallback(
    async (file, category = 'tops', subcategory = '', name = '') => {
      if (!file) {
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        showToast('图片大小不能超过 10MB', 'warning')
        return
      }

      // 导入重复校验工具
      const { checkImageDuplicate, fileToBase64 } = await import('./utils/imageKeyCache')

      try {
        const base64 = await fileToBase64(file)

        // 检查是否与已选服装重复
        const allItems = [...selected, ...customClothing]
        const { isDuplicate, duplicateIndex } = await checkImageDuplicate(base64, allItems)

        if (isDuplicate) {
          showToast('该图片已添加，请勿重复上传', 'warning')
          console.log(`[CustomUpload] 图片与第 ${duplicateIndex + 1} 个服装重复`)
          return
        }

        // 添加自定义服装
        const item = {
          id: `custom_${Date.now()}`,
          uuid: `custom_${Date.now()}`,
          name: name || file.name.replace(/\.[^.]+$/, ''),
          color: '#F5F4F0',
          image: base64,
          imageFull: base64,
          category,
          subcategory,
          isCustom: true,
        }
        setCustomClothing(prev => {
          const newList = [...prev, item]
          localStorage.setItem(STORAGE_KEYS.CUSTOM_CLOTHING, JSON.stringify(newList))
          return newList
        })
        showToast('自定义服装已添加', 'success')
      } catch (error) {
        console.error('[CustomUpload] 处理失败:', error)
        showToast('图片处理失败，请重试', 'error')
      }
    },
    [showToast, selected, customClothing]
  )

  // 更新衣橱上传分类（来自 MainLayout，保留用于未来扩展）
  const _handleUpdateWardrobeCategory = useCallback((category, subcategory) => {
    setWardrobeUploadCategory(category)
    setWardrobeUploadSubcategory(subcategory || '')
    setWardrobeUploadSubcategoryCustom('')
  }, [])

  // 衣橱上传（保存到本地缓存，不上传到商家）
  const handleWardrobeUpload = useCallback(
    (file, category = 'tops', subcategory = '', name = '') => {
      if (!file) {
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        showToast('图片大小不能超过 10MB', 'warning')
        return
      }
      const reader = new FileReader()
      reader.onload = ev => {
        const base64 = ev.target.result
        // 使用自定义二级分类或选择的二级分类
        const finalSubcategory = wardrobeUploadSubcategoryCustom || subcategory
        const item = {
          id: `wardrobe_${Date.now()}`,
          name: name || file.name.replace(/\.[^.]+$/, ''),
          color: '#F5F4F0',
          image: base64,
          imageFull: base64,
          category,
          subcategory: finalSubcategory,
          isWardrobe: true,
        }
        setWardrobeClothing(prev => {
          const newList = [...prev, item]
          localStorage.setItem(STORAGE_KEYS.WARDROBE_CLOTHING, JSON.stringify(newList))
          return newList
        })
        showToast('衣橱服装已添加', 'success')
      }
      reader.readAsDataURL(file)
    },
    [showToast, wardrobeUploadSubcategoryCustom]
  )

  // 删除自定义服装（更新本地缓存）
  const handleRemoveCustomClothing = useCallback(id => {
    setSelected(prev => prev.filter(item => item.id !== id))
    setCustomClothing(prev => {
      const newList = prev.filter(item => item.id !== id)
      localStorage.setItem(STORAGE_KEYS.CUSTOM_CLOTHING, JSON.stringify(newList))
      return newList
    })
    showToast('已删除自定义服装', 'info')
  }, [])

  // 删除衣橱服装（更新本地缓存，保留用于未来扩展）
  const _handleRemoveWardrobeItem = useCallback(id => {
    setSelected(prev => prev.filter(item => item.id !== id))
    setWardrobeClothing(prev => {
      const newList = prev.filter(item => item.id !== id)
      localStorage.setItem(STORAGE_KEYS.WARDROBE_CLOTHING, JSON.stringify(newList))
      return newList
    })
    showToast('已从衣橱移除', 'info')
  }, [])

  // 网络状态
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      if (toast && toast.message === '网络已断开，部分功能不可用') {
        showToast('网络已恢复', 'success')
      }
    }
    const handleOffline = () => {
      setIsOnline(false)
      showToast('网络已断开，部分功能不可用', 'warning')
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <I18nProvider>
      {appLoading && <GlobalLoading />}
      <div
        className={`bg-texture min-h-screen transition-colors ${theme === 'dark' ? 'dark' : ''}`}
      >
        <Header
          user={isLoggedIn ? userInfo : null}
          sessionCustomer={sessionCustomer}
          onLogout={handleLogout}
          onOpenSettings={() => setShowSettingsModal(true)}
          onOpenStoreInfo={() => setShowStoreModal(true)}
          onClearHistory={handleClearHistory}
          onEndSession={handleEndSession}
        />
        <MainLayout
          avatarPreview={avatarPreview}
          onAvatarChange={handleAvatarChange}
          onSetAvatarPreview={preview => {
            setAvatarPreview(preview)
            localStorage.setItem(STORAGE_KEYS.AVATAR_PREVIEW, preview)
            // 如果是使用模特图片（URL 形式），清除 avatarFile
            // 这样生成时会使用 avatarPreview 而不是 avatarFile
            if (preview && preview.startsWith('/images/')) {
              setAvatarFile(null)
              localStorage.removeItem(STORAGE_KEYS.AVATAR_FILE)
            }
          }}
          selected={selected}
          onToggleSelect={handleToggle}
          selectedClothing={selected}
          onRemoveSelected={handleRemoveSelected}
          showToast={showToast}
          history={tryOnHistory}
          status={status}
          progress={progress}
          resultUrl={resultUrl}
          onTryOn={handleTryOn}
          canTryOn={!!avatarPreview && selected.length > 0 && quota.remaining > 0}
          onOpenWardrobeUpload={() => setShowWardrobeModal(true)}
          onOpenCustomUploadModal={(category, subcategory) => {
            setCustomUploadCategory(category || 'tops')
            setCustomUploadSubcategory(subcategory || '')
            setShowCustomUploadModal(true)
          }}
          onOpenCameraModal={openCameraModal}
          onOpenLoginModal={() => setShowLoginModal(true)}
          onClearHistory={handleClearHistory}
          onEndSession={handleEndSession}
          onOpenSettings={() => setShowSettingsModal(true)}
          onOpenStoreInfo={() => setShowStoreModal(true)}
          onOpenPreviewModal={openPreviewModal}
          onToggleHistorySaved={handleToggleHistorySaved}
          onDeleteHistory={handleDeleteHistory}
          onReuseAvatarFromHistory={handleReuseAvatarFromHistory}
          onClearSelection={handleClearSelection}
          hasResult={hasResult}
          setHasResult={setHasResult}
          customClothing={customClothing}
          wardrobeClothing={wardrobeClothing}
          clothing={clothing}
          categories={categories}
          clothingLoading={clothingLoading}
          onUploadClothing={uploadClothing}
          onDeleteClothing={deleteClothing}
          onRemoveCustomClothing={handleRemoveCustomClothing}
          remainingTime={remainingTime}
        />
        {toast && <Toast message={toast.message} type={toast.type} />}

        {/* 弹窗们 */}
        {/* 登录弹窗 */}
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onLogin={handleLoginSubmit}
          onSmsLogin={handleSmsLogin}
          onSendSms={handleSendSms}
          loading={loginLoading}
        />

        {/* 设置弹窗 */}
        {showSettingsModal && (
          <div
            className='fixed inset-0 z-[70] flex items-center justify-center p-4'
            role='dialog'
            aria-modal='true'
          >
            <div
              className='absolute inset-0 bg-black/40 backdrop-blur-sm'
              onClick={() => setShowSettingsModal(false)}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  setShowSettingsModal(false)
                }
              }}
              role='button'
              tabIndex={-1}
              aria-label='关闭设置'
            />
            <div className='relative w-full max-w-md animate-scale-in overflow-hidden rounded-2xl bg-white shadow-2xl'>
              <div className='flex items-center justify-between border-b border-grayLight px-6 py-4'>
                <h2 className='text-lg font-semibold text-charcoal'>设置</h2>
                <button
                  type='button'
                  onClick={() => setShowSettingsModal(false)}
                  className='rounded-lg p-1.5 transition-colors hover:bg-gray-100'
                  aria-label='关闭设置'
                >
                  <svg
                    className='h-5 w-5 text-grayMedium'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M6 18L18 6M6 6l12 12'
                    />
                  </svg>
                </button>
              </div>
              <div className='space-y-5 px-6 py-5'>
                <div>
                  <div className='mb-3 flex items-center gap-2'>
                    <svg
                      className='h-5 w-5 text-champagne'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth='2'
                        d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
                      />
                    </svg>
                    <span className='text-sm font-semibold text-charcoal'>账户信息</span>
                  </div>
                  {isLoggedIn ? (
                    <div className='flex items-center gap-3 rounded-xl border border-success/20 bg-success/5 p-3'>
                      <div className='flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-champagne/20'>
                        <svg
                          className='h-5 w-5 text-champagne'
                          fill='none'
                          stroke='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth='2'
                            d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
                          />
                        </svg>
                      </div>
                      <div className='min-w-0 flex-1'>
                        <p className='text-sm font-medium text-charcoal'>
                          {userInfo?.store_name || '商家账号'}
                        </p>
                        <p className='mt-0.5 truncate text-xs text-grayMuted'>
                          {userInfo?.phone || '已登录'}
                        </p>
                      </div>
                      <button
                        type='button'
                        onClick={handleLogout}
                        className='text-xs font-medium text-error hover:text-error/80'
                      >
                        退出
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className='mb-2 text-xs text-grayMuted'>请登录商家账号以使用试穿功能</p>
                      <button
                        type='button'
                        onClick={() => {
                          setShowSettingsModal(false)
                          setShowLoginModal(true)
                        }}
                        className='w-full rounded-xl bg-champagne py-2.5 text-sm font-medium text-white transition-colors hover:bg-yellow-600'
                      >
                        登录
                      </button>
                    </div>
                  )}
                </div>
                <div className='border-t border-grayLight' />
                <div>
                  <button
                    type='button'
                    onClick={() => {
                      setShowSettingsModal(false)
                      setShowStoreModal(true)
                    }}
                    className='flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-gray-50'
                  >
                    <div className='flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-champagne/10'>
                      <svg
                        className='h-4 w-4 text-champagne'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth='2'
                          d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
                        />
                      </svg>
                    </div>
                    <div className='flex-1'>
                      <p className='text-sm font-medium text-charcoal'>门店信息</p>
                      <p className='text-xs text-grayMuted'>查看门店状态和统计</p>
                    </div>
                    <svg
                      className='h-4 w-4 text-grayMuted'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth='2'
                        d='M9 5l7 7-7 7'
                      />
                    </svg>
                  </button>
                </div>
                <div>
                  <button
                    type='button'
                    onClick={() => {
                      setShowSettingsModal(false)
                      handleEndSession()
                    }}
                    className='flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-error/5'
                  >
                    <div className='flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-error/10'>
                      <svg
                        className='h-4 w-4 text-error'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth='2'
                          d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 013 3v1'
                        />
                      </svg>
                    </div>
                    <div className='flex-1'>
                      <p className='text-sm font-medium text-error'>结束试穿</p>
                      <p className='text-xs text-grayMuted'>清空所有试穿数据</p>
                    </div>
                    <svg
                      className='h-4 w-4 text-grayMuted'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth='2'
                        d='M9 5l7 7-7 7'
                      />
                    </svg>
                  </button>
                </div>
                {isLoggedIn && (
                  <div>
                    <div className='mb-3 flex items-center gap-2'>
                      <svg
                        className='h-5 w-5 text-error'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth='2'
                          d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 013 3v1'
                        />
                      </svg>
                      <span className='text-sm font-semibold text-charcoal'>退出登录</span>
                    </div>
                    <p className='mb-2 text-xs text-grayMuted'>退出后需要重新登录才能使用</p>
                    <button
                      type='button'
                      onClick={() => {
                        setShowSettingsModal(false)
                        handleLogout()
                      }}
                      className='w-full rounded-xl border border-error/30 py-2.5 text-sm font-medium text-error transition-colors hover:bg-error/5'
                    >
                      退出登录
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 门店信息弹窗 */}
        {showStoreModal && (
          <div
            className='fixed inset-0 z-[70] flex items-center justify-center p-4'
            role='dialog'
            aria-modal='true'
          >
            <div
              className='absolute inset-0 bg-black/40 backdrop-blur-sm'
              onClick={() => setShowStoreModal(false)}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  setShowStoreModal(false)
                }
              }}
              role='button'
              tabIndex={-1}
              aria-label='关闭门店信息'
            />
            <div className='relative w-full max-w-sm animate-scale-in overflow-hidden rounded-2xl bg-white shadow-2xl'>
              <div className='bg-gradient-to-r from-[#1A1A1A] to-[#2A2A2A] px-6 py-5 text-center'>
                <div className='mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border-2 border-champagne/40 bg-champagne/20'>
                  <svg
                    className='h-7 w-7 text-champagne'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
                    />
                  </svg>
                </div>
                <h2 className='text-lg font-semibold text-white'>
                  {isLoggedIn ? userInfo?.store_name || '我的门店' : '未登录'}
                </h2>
                <p className='mt-1 text-xs text-gray-400'>
                  {isLoggedIn ? userInfo?.username || '商家账号' : '请登录商家账号'}
                </p>
              </div>
              <div className='space-y-4 px-6 py-4'>
                {isLoggedIn ? (
                  <>
                    {/* 配额使用进度 */}
                    <div className='rounded-xl bg-grayLight/30 p-4'>
                      <div className='mb-2 flex items-center justify-between'>
                        <span className='text-sm font-medium text-charcoal'>试穿配额</span>
                        <span className='text-sm text-grayMuted'>
                          {quota.used} / {quota.total} 次
                        </span>
                      </div>
                      <div className='h-2.5 overflow-hidden rounded-full bg-grayLight'>
                        <div
                          className='h-full rounded-full bg-gradient-to-r from-champagne to-champagne/80 transition-all duration-300'
                          style={{
                            width: `${quota.total > 0 ? Math.min((quota.used / quota.total) * 100, 100) : 0}%`,
                          }}
                        />
                      </div>
                      <div className='mt-2 flex items-center justify-between'>
                        <span className='text-xs text-grayMuted'>已使用 {quota.used} 次</span>
                        <span className='text-xs font-medium text-success'>
                          剩余 {quota.remaining} 次
                        </span>
                      </div>
                    </div>
                    {/* 其他统计 */}
                    <div className='flex items-center justify-between py-2'>
                      <span className='text-sm text-grayMuted'>账号状态</span>
                      <span className='text-sm font-medium text-success'>已登录</span>
                    </div>
                    <div className='flex items-center justify-between py-2'>
                      <span className='text-sm text-grayMuted'>衣橱服装</span>
                      <span className='text-sm font-medium text-charcoal'>
                        {clothing?.length || 0} 件
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    {/* 未登录状态 */}
                    <div className='flex items-center justify-between py-2'>
                      <span className='text-sm text-grayMuted'>账号状态</span>
                      <span className='text-sm font-medium text-error'>未登录</span>
                    </div>
                    <div className='py-4 text-center'>
                      <p className='mb-4 text-sm text-grayMuted'>登录后可使用试穿功能</p>
                      <button
                        type='button'
                        onClick={() => {
                          setShowStoreModal(false)
                          setShowLoginModal(true)
                        }}
                        className='rounded-xl bg-champagne px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-champagne/90'
                      >
                        立即登录
                      </button>
                    </div>
                  </>
                )}
              </div>
              <div className='px-6 pb-4'>
                <button
                  type='button'
                  className='w-full rounded-xl bg-charcoal py-2.5 text-sm font-medium text-white transition-colors hover:bg-charcoal/90'
                  onClick={() => setShowStoreModal(false)}
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 衣橱上传弹窗 */}
        {showWardrobeModal && (
          <div
            className='fixed inset-0 z-[70] flex items-center justify-center p-4'
            role='dialog'
            aria-modal='true'
          >
            <div
              className='absolute inset-0 bg-black/40 backdrop-blur-sm'
              onClick={() => setShowWardrobeModal(false)}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  setShowWardrobeModal(false)
                }
              }}
              role='button'
              tabIndex={-1}
              aria-label='关闭衣橱'
            />
            <div className='relative w-full max-w-md animate-scale-in overflow-hidden rounded-2xl bg-white shadow-2xl'>
              <div className='flex items-center justify-between border-b border-grayLight px-6 py-4'>
                <h2 className='text-lg font-semibold text-charcoal'>上传到我的衣橱</h2>
                <button
                  type='button'
                  onClick={() => setShowWardrobeModal(false)}
                  className='rounded-lg p-1.5 transition-colors hover:bg-gray-100'
                  aria-label='关闭衣橱'
                >
                  <svg
                    className='h-5 w-5 text-grayMedium'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M6 18L18 6M6 6l12 12'
                    />
                  </svg>
                </button>
              </div>
              <div className='space-y-4 px-6 py-5'>
                <p className='text-sm text-grayMuted'>上传服装照片到本地衣橱，仅保存到当前设备</p>
                <div className='grid grid-cols-2 gap-3'>
                  <div>
                    <label
                      htmlFor='wardrobe-category'
                      className='mb-1.5 block text-xs font-medium text-charcoal'
                    >
                      一级分类
                    </label>
                    <select
                      id='wardrobe-category'
                      value={wardrobeUploadCategory}
                      onChange={e => {
                        setWardrobeUploadCategory(e.target.value)
                        setWardrobeUploadSubcategory('')
                        setWardrobeUploadSubcategoryCustom('')
                      }}
                      className='w-full rounded-xl border border-grayLight bg-white px-3 py-2.5 text-sm focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/20'
                    >
                      <option value='tops'>上装</option>
                      <option value='bottoms'>下装</option>
                      <option value='dresses'>裙装</option>
                      <option value='outerwear'>外套</option>
                      <option value='shoes'>鞋履</option>
                      <option value='accessories'>配饰</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor='wardrobe-subcategory'
                      className='mb-1.5 block text-xs font-medium text-charcoal'
                    >
                      二级分类
                    </label>
                    <select
                      id='wardrobe-subcategory'
                      value={wardrobeUploadSubcategory}
                      onChange={e => {
                        setWardrobeUploadSubcategory(e.target.value)
                        if (e.target.value !== 'custom') {
                          setWardrobeUploadSubcategoryCustom('')
                        }
                      }}
                      className='w-full rounded-xl border border-grayLight bg-white px-3 py-2.5 text-sm focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/20'
                    >
                      <option value=''>不限</option>
                      {wardrobeUploadCategory === 'tops' && (
                        <>
                          <option value='t-shirt'>T恤</option>
                          <option value='shirt'>衬衫</option>
                          <option value='sweater'>毛衣</option>
                          <option value='hoodie'>卫衣</option>
                          <option value='blouse'> blouse</option>
                        </>
                      )}
                      {wardrobeUploadCategory === 'bottoms' && (
                        <>
                          <option value='jeans'>牛仔裤</option>
                          <option value='pants'>西裤</option>
                          <option value='shorts'>短裤</option>
                          <option value='skirt'>半裙</option>
                        </>
                      )}
                      {wardrobeUploadCategory === 'dresses' && (
                        <>
                          <option value='mini'>迷你裙</option>
                          <option value='midi'>中长裙</option>
                          <option value='maxi'>长裙</option>
                        </>
                      )}
                      {wardrobeUploadCategory === 'outerwear' && (
                        <>
                          <option value='jacket'>夹克</option>
                          <option value='coat'>大衣</option>
                          <option value='blazer'>西装外套</option>
                          <option value='vest'>马甲</option>
                        </>
                      )}
                      {wardrobeUploadCategory === 'shoes' && (
                        <>
                          <option value='sneakers'>运动鞋</option>
                          <option value='heels'>高跟鞋</option>
                          <option value='boots'>靴子</option>
                          <option value='flats'>平底鞋</option>
                        </>
                      )}
                      {wardrobeUploadCategory === 'accessories' && (
                        <>
                          <option value='hat'>帽子</option>
                          <option value='bag'>包袋</option>
                          <option value='scarf'>围巾</option>
                          <option value='belt'>腰带</option>
                          <option value='jewelry'>首饰</option>
                        </>
                      )}
                      <option value='custom'>+ 自定义</option>
                    </select>
                  </div>
                </div>
                {wardrobeUploadSubcategory === 'custom' && (
                  <div>
                    <label
                      htmlFor='wardrobe-subcategory-custom'
                      className='mb-1.5 block text-xs font-medium text-charcoal'
                    >
                      自定义二级分类
                    </label>
                    <input
                      id='wardrobe-subcategory-custom'
                      type='text'
                      value={wardrobeUploadSubcategoryCustom}
                      onChange={e => setWardrobeUploadSubcategoryCustom(e.target.value)}
                      className='w-full rounded-xl border border-grayLight px-3 py-2.5 text-sm placeholder:text-grayMuted/60 focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/20'
                      placeholder='输入自定义分类名称'
                    />
                  </div>
                )}
                <div>
                  <label
                    htmlFor='wardrobe-name'
                    className='mb-1.5 block text-xs font-medium text-charcoal'
                  >
                    服装名称
                  </label>
                  <input
                    id='wardrobe-name'
                    type='text'
                    value={wardrobeUploadName}
                    onChange={e => setWardrobeUploadName(e.target.value)}
                    className='w-full rounded-xl border border-grayLight px-3 py-2.5 text-sm placeholder:text-grayMuted/60 focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/20'
                    placeholder='输入服装名称（可选）'
                  />
                </div>
                <input
                  type='file'
                  accept='image/*'
                  capture='environment'
                  id='wardrobe-file-input'
                  className='hidden'
                  onChange={e => {
                    const file = e.target.files[0]
                    if (file) {
                      handleWardrobeUpload(
                        file,
                        wardrobeUploadCategory,
                        wardrobeUploadSubcategory === 'custom'
                          ? wardrobeUploadSubcategoryCustom
                          : wardrobeUploadSubcategory,
                        wardrobeUploadName
                      )
                      setWardrobeUploadName('')
                      setWardrobeUploadSubcategoryCustom('')
                      setShowWardrobeModal(false)
                    }
                    e.target.value = ''
                  }}
                />
                <button
                  type='button'
                  onClick={() => document.getElementById('wardrobe-file-input').click()}
                  className='flex w-full items-center justify-center gap-2 rounded-xl bg-champagne py-3 text-sm font-medium text-white transition-colors hover:bg-yellow-600'
                >
                  <svg className='h-4 w-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9a2 2 0 012-2z'
                    />
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M15 13a3 3 0 11-6 0 3 3 0 016 0z'
                    />
                  </svg>
                  拍照上传
                </button>
              </div>
              <div className='border-t border-grayLight px-6 py-3'>
                <div className='mb-2 flex items-center justify-between'>
                  <span className='text-xs font-medium text-charcoal'>已上传到衣橱</span>
                  <span className='text-xs text-champagne'>{wardrobeClothing?.length || 0}</span>
                </div>
                <div className='grid max-h-40 grid-cols-4 gap-2 overflow-y-auto'>
                  {wardrobeClothing && wardrobeClothing.length > 0 ? (
                    wardrobeClothing.map(item => (
                      <div
                        key={item.id}
                        className='relative aspect-square overflow-hidden rounded-lg bg-grayLight'
                      >
                        <img
                          src={item.image}
                          alt={item.name}
                          className='h-full w-full object-cover'
                        />
                        <button
                          type='button'
                          onClick={() => {
                            setWardrobeClothing(prev => {
                              const newList = prev.filter(c => c.id !== item.id)
                              localStorage.setItem(
                                STORAGE_KEYS.WARDROBE_CLOTHING,
                                JSON.stringify(newList)
                              )
                              return newList
                            })
                          }}
                          className='absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/50'
                          aria-label={`删除 ${item.name}`}
                        >
                          <svg
                            className='h-2.5 w-2.5 text-white'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                          >
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth='2'
                              d='M6 18L18 6M6 6l12 12'
                            />
                          </svg>
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className='col-span-4 py-3 text-center'>
                      <p className='text-xs text-grayMuted'>暂无上传服装</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 自定义上传弹窗 */}
        {showCustomUploadModal && (
          <div
            className='fixed inset-0 z-[70] flex items-center justify-center p-4'
            role='dialog'
            aria-modal='true'
          >
            <div
              className='absolute inset-0 bg-black/40 backdrop-blur-sm'
              onClick={() => setShowCustomUploadModal(false)}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  setShowCustomUploadModal(false)
                }
              }}
              role='button'
              tabIndex={-1}
              aria-label='关闭自定义上传'
            />
            <div className='relative w-full max-w-md animate-scale-in overflow-hidden rounded-2xl bg-white shadow-2xl'>
              <div className='flex items-center justify-between border-b border-grayLight px-6 py-4'>
                <h2 className='text-lg font-semibold text-charcoal'>自定义上传</h2>
                <button
                  type='button'
                  onClick={() => setShowCustomUploadModal(false)}
                  className='rounded-lg p-1.5 transition-colors hover:bg-gray-100'
                  aria-label='关闭自定义上传'
                >
                  <svg
                    className='h-5 w-5 text-grayMedium'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M6 18L18 6M6 6l12 12'
                    />
                  </svg>
                </button>
              </div>
              <div className='space-y-4 px-6 py-5'>
                <p className='text-sm text-grayMuted'>上传服装照片到本地，仅保存在当前设备</p>
                <div className='grid grid-cols-2 gap-3'>
                  <div>
                    <label
                      htmlFor='custom-category'
                      className='mb-1.5 block text-xs font-medium text-charcoal'
                    >
                      一级分类
                    </label>
                    <select
                      id='custom-category'
                      value={customUploadCategory}
                      onChange={e => {
                        setCustomUploadCategory(e.target.value)
                        setCustomUploadSubcategory('')
                        setCustomUploadSubcategoryCustom('')
                      }}
                      className='w-full rounded-xl border border-grayLight bg-white px-3 py-2.5 text-sm focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/20'
                    >
                      <option value='tops'>上装</option>
                      <option value='bottoms'>下装</option>
                      <option value='dresses'>裙装</option>
                      <option value='outerwear'>外套</option>
                      <option value='shoes'>鞋履</option>
                      <option value='accessories'>配饰</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor='custom-subcategory'
                      className='mb-1.5 block text-xs font-medium text-charcoal'
                    >
                      二级分类
                    </label>
                    <select
                      id='custom-subcategory'
                      value={customUploadSubcategory}
                      onChange={e => {
                        setCustomUploadSubcategory(e.target.value)
                        if (e.target.value !== 'custom') {
                          setCustomUploadSubcategoryCustom('')
                        }
                      }}
                      className='w-full rounded-xl border border-grayLight bg-white px-3 py-2.5 text-sm focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/20'
                    >
                      <option value=''>不限</option>
                      {customUploadCategory === 'tops' && (
                        <>
                          <option value='t-shirt'>T恤</option>
                          <option value='shirt'>衬衫</option>
                          <option value='sweater'>毛衣</option>
                          <option value='hoodie'>卫衣</option>
                          <option value='blouse'>blouse</option>
                        </>
                      )}
                      {customUploadCategory === 'bottoms' && (
                        <>
                          <option value='jeans'>牛仔裤</option>
                          <option value='pants'>西裤</option>
                          <option value='shorts'>短裤</option>
                          <option value='skirt'>半裙</option>
                        </>
                      )}
                      {customUploadCategory === 'dresses' && (
                        <>
                          <option value='mini'>迷你裙</option>
                          <option value='midi'>中长裙</option>
                          <option value='maxi'>长裙</option>
                        </>
                      )}
                      {customUploadCategory === 'outerwear' && (
                        <>
                          <option value='jacket'>夹克</option>
                          <option value='coat'>大衣</option>
                          <option value='blazer'>西装外套</option>
                          <option value='vest'>马甲</option>
                        </>
                      )}
                      {customUploadCategory === 'shoes' && (
                        <>
                          <option value='sneakers'>运动鞋</option>
                          <option value='heels'>高跟鞋</option>
                          <option value='boots'>靴子</option>
                          <option value='flats'>平底鞋</option>
                        </>
                      )}
                      {customUploadCategory === 'accessories' && (
                        <>
                          <option value='hat'>帽子</option>
                          <option value='bag'>包袋</option>
                          <option value='scarf'>围巾</option>
                          <option value='belt'>腰带</option>
                          <option value='jewelry'>首饰</option>
                        </>
                      )}
                      <option value='custom'>+ 自定义</option>
                    </select>
                  </div>
                </div>
                {customUploadSubcategory === 'custom' && (
                  <div>
                    <label
                      htmlFor='custom-subcategory-custom'
                      className='mb-1.5 block text-xs font-medium text-charcoal'
                    >
                      自定义二级分类
                    </label>
                    <input
                      id='custom-subcategory-custom'
                      type='text'
                      value={customUploadSubcategoryCustom}
                      onChange={e => setCustomUploadSubcategoryCustom(e.target.value)}
                      className='w-full rounded-xl border border-grayLight px-3 py-2.5 text-sm placeholder:text-grayMuted/60 focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/20'
                      placeholder='输入自定义分类名称'
                    />
                  </div>
                )}
                <div>
                  <label
                    htmlFor='custom-name'
                    className='mb-1.5 block text-xs font-medium text-charcoal'
                  >
                    服装名称（可选）
                  </label>
                  <input
                    id='custom-name'
                    type='text'
                    value={customUploadName}
                    onChange={e => setCustomUploadName(e.target.value)}
                    className='w-full rounded-xl border border-grayLight px-3 py-2.5 text-sm placeholder:text-grayMuted/60 focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/20'
                    placeholder='输入服装名称'
                  />
                </div>
                <input
                  type='file'
                  accept='image/*'
                  capture='environment'
                  id='custom-file-input-modal'
                  className='hidden'
                  onChange={e => {
                    const file = e.target.files[0]
                    if (file) {
                      const finalSubcategory =
                        customUploadSubcategory === 'custom'
                          ? customUploadSubcategoryCustom
                          : customUploadSubcategory
                      handleCustomUpload(
                        file,
                        customUploadCategory,
                        finalSubcategory,
                        customUploadName
                      )
                      setCustomUploadName('')
                      setCustomUploadSubcategoryCustom('')
                      setShowCustomUploadModal(false)
                    }
                    e.target.value = ''
                  }}
                />
                <button
                  type='button'
                  onClick={() => document.getElementById('custom-file-input-modal').click()}
                  className='flex w-full items-center justify-center gap-2 rounded-xl bg-champagne py-3 text-sm font-medium text-white transition-colors hover:bg-yellow-600'
                >
                  <svg className='h-4 w-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9a2 2 0 012-2z'
                    />
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M15 13a3 3 0 11-6 0 3 3 0 016 0z'
                    />
                  </svg>
                  拍照上传
                </button>
              </div>
              <div className='border-t border-grayLight px-6 py-3'>
                <div className='mb-2 flex items-center justify-between'>
                  <span className='text-xs font-medium text-charcoal'>已上传</span>
                  <span className='text-xs text-champagne'>{customClothing?.length || 0}</span>
                </div>
                <div className='grid max-h-40 grid-cols-4 gap-2 overflow-y-auto'>
                  {customClothing && customClothing.length > 0 ? (
                    customClothing.map(item => (
                      <div
                        key={item.id}
                        className='relative aspect-square overflow-hidden rounded-lg bg-grayLight'
                      >
                        <img
                          src={item.image}
                          alt={item.name}
                          className='h-full w-full object-cover'
                        />
                        <button
                          type='button'
                          onClick={() => {
                            setCustomClothing(prev => {
                              const newList = prev.filter(c => c.id !== item.id)
                              localStorage.setItem(
                                STORAGE_KEYS.CUSTOM_CLOTHING,
                                JSON.stringify(newList)
                              )
                              return newList
                            })
                          }}
                          className='absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/50'
                          aria-label={`删除 ${item.name}`}
                        >
                          <svg
                            className='h-2.5 w-2.5 text-white'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                          >
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth='2'
                              d='M6 18L18 6M6 6l12 12'
                            />
                          </svg>
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className='col-span-4 py-3 text-center'>
                      <p className='text-xs text-grayMuted'>暂无上传服装</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 确认弹窗 */}
        {showConfirmModal && (
          <div
            className='fixed inset-0 z-[85] flex items-center justify-center p-4'
            role='dialog'
            aria-modal='true'
          >
            <div
              className='absolute inset-0 bg-black/50 backdrop-blur-sm'
              onClick={() => setShowConfirmModal(false)}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  setShowConfirmModal(false)
                }
              }}
              role='button'
              tabIndex={-1}
              aria-label='关闭确认'
            />
            <div className='relative w-full max-w-sm animate-scale-in overflow-hidden rounded-2xl bg-white shadow-2xl'>
              <div className='px-6 pb-2 pt-6'>
                <div className='mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-error/10'>
                  <svg
                    className='h-6 w-6 text-error'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77-1.333.192 3.694-1.333 2.37 2.37a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z'
                    />
                  </svg>
                </div>
                <h3 className='text-center text-base font-semibold text-charcoal'>
                  {confirmConfig.title}
                </h3>
                <p className='mt-1.5 text-center text-sm text-grayMuted'>{confirmConfig.message}</p>
              </div>
              <div className='flex gap-3 px-6 py-4'>
                <button
                  type='button'
                  className='flex-1 rounded-xl border border-grayLight py-2.5 text-sm font-medium text-charcoal transition-colors hover:bg-gray-50'
                  onClick={() => setShowConfirmModal(false)}
                >
                  取消
                </button>
                <button
                  type='button'
                  className='flex-1 rounded-xl bg-error py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-600'
                  onClick={handleConfirmAction}
                >
                  确认
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 图片预览弹窗 - 统一尺寸 */}
        {showPreviewModal && (
          <div
            className='fixed inset-0 z-[75] flex items-center justify-center p-4'
            role='dialog'
            aria-modal='true'
          >
            <div
              className='absolute inset-0 bg-black/60 backdrop-blur-sm'
              onClick={closePreviewModal}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  closePreviewModal()
                }
              }}
              role='button'
              tabIndex={-1}
              aria-label='关闭预览'
            />
            <div className='relative animate-scale-in'>
              <img
                src={previewModalData.src}
                alt={previewModalData.name}
                className='max-h-[70vh] min-h-[280px] w-auto min-w-[280px] max-w-[480px] rounded-xl object-contain shadow-2xl'
              />
              <div
                className='absolute -right-2 -top-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-white/95 shadow-lg transition-colors hover:bg-gray-100'
                onClick={closePreviewModal}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    closePreviewModal()
                  }
                }}
                role='button'
                tabIndex={0}
                aria-label='关闭预览'
              >
                <svg
                  className='h-3.5 w-3.5 text-charcoal'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M6 18L18 6M6 6l12 12'
                  />
                </svg>
              </div>
              <p className='mt-2 text-center text-xs font-medium text-white/90 drop-shadow'>
                {previewModalData.name}
              </p>
            </div>
          </div>
        )}

        {/* 拍照选择弹窗 */}
        {showCameraModal && (
          <div
            className='fixed inset-0 z-[85] flex items-end justify-center sm:items-center'
            role='dialog'
            aria-modal='true'
          >
            <div
              className='absolute inset-0 bg-black/50 backdrop-blur-sm'
              onClick={closeCameraModal}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  closeCameraModal()
                }
              }}
              role='button'
              tabIndex={-1}
              aria-label='关闭拍照选择'
            />
            <div className='relative w-full max-w-xs animate-slide-up overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl'>
              <div className='px-5 pb-3 pt-5'>
                <h3 className='text-center text-base font-semibold text-charcoal'>选择拍照方式</h3>
              </div>
              <div className='space-y-2.5 px-5 pb-5'>
                <button
                  type='button'
                  className='flex w-full items-center gap-3.5 rounded-xl p-3.5 text-left transition-colors hover:bg-gray-50'
                  onClick={() => {
                    closeCameraModal()
                    if (cameraCallback) {
                      cameraCallback('user')
                    }
                  }}
                >
                  <div className='flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-champagne/10'>
                    <svg
                      className='h-5 w-5 text-champagne'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth='2'
                        d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
                      />
                    </svg>
                  </div>
                  <div>
                    <p className='text-sm font-medium text-charcoal'>前置摄像头</p>
                    <p className='text-xs text-grayMuted'>自拍形象照片</p>
                  </div>
                </button>
                <button
                  type='button'
                  className='flex w-full items-center gap-3.5 rounded-xl p-3.5 text-left transition-colors hover:bg-gray-50'
                  onClick={() => {
                    closeCameraModal()
                    if (cameraCallback) {
                      cameraCallback('environment')
                    }
                  }}
                >
                  <div className='flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-champagne/10'>
                    <svg
                      className='h-5 w-5 text-champagne'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth='2'
                        d='M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 00-2 2v9a2 2 0 002 2z'
                      />
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth='2'
                        d='M15 13a3 3 0 11-6 0 3 3 0 016 0z'
                      />
                    </svg>
                  </div>
                  <div>
                    <p className='text-sm font-medium text-charcoal'>后置摄像头</p>
                    <p className='text-xs text-grayMuted'>拍摄服装照片</p>
                  </div>
                </button>
              </div>
              <div className='px-5 pb-4'>
                <button
                  type='button'
                  className='w-full py-2.5 text-sm font-medium text-grayMuted transition-colors hover:text-charcoal'
                  onClick={closeCameraModal}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 网络状态提示条 */}
        {!isOnline && (
          <div
            className='fixed left-0 right-0 top-0 z-[100] bg-error px-4 py-2 text-center text-sm font-medium text-white transition-all duration-300'
            role='alert'
          >
            网络已断开，部分功能不可用
          </div>
        )}

        {/* 通知容器 */}
        <div
          id='notification-container'
          className='fixed right-6 top-24 z-[80] space-y-3'
          aria-live='polite'
          aria-relevant='additions'
        />
      </div>
    </I18nProvider>
  )
}
