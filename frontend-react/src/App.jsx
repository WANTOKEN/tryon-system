/* eslint-disable no-console */
import { useState, useCallback, useEffect, useRef } from 'react'

import { I18nProvider, useI18n } from './hooks/useI18n'
import { useTryOn } from './hooks/useTryOn'
import { useClothing } from './hooks/useClothing'
import { useNetworkStatus } from './hooks/useNetworkStatus'
import { api, TokenManager, setSessionId } from './utils/request'
import { API_ENDPOINTS } from './config/api'
import Header from './components/Header'
import MainLayout from './components/MainLayout'
import Toast from './components/Toast'
import LoginModal from './components/LoginModal'
import GlobalLoading from './components/GlobalLoading'
import CachedImage from './components/CachedImage'
import ScanUploadPage from './components/ScanUploadPage'
import SettingsModal from './components/SettingsModal'
import { useTheme } from './hooks/useTheme'
import { STORAGE_KEYS, CURRENT_CACHE_VERSION } from './constants/storageKeys'
import { safeStorage } from './utils/safeStorage'
import { compressImage, truncateFileName } from './utils/imageUtils'
import { FALLBACK_COLOR_TAGS } from './data/clothingData'
import AdminContactItem from './components/AdminContactItem'
import ErrorBoundary from './components/ErrorBoundary'

function AppContent() {
  const { t } = useI18n()

  // === 应用全局状态 ===
  const [appLoading, setAppLoading] = useState(true) // 应用初始化加载中
  const { theme, mode, setTheme, toggleMode } = useTheme() // 主题配色系统
  const [toast, setToast] = useState(null) // 全局 Toast 提示

  // === 试穿核心状态 ===
  const [avatarFile, setAvatarFile] = useState(null) // 用户上传的头像文件
  const [avatarPreview, setAvatarPreview] = useState(null) // 头像预览 URL（base64 或 blob URL）
  const [avatarSource, setAvatarSource] = useState('user') // 头像来源：user/system/history
  const [_showUploadModal] = useState(false)
  const [quota, setQuota] = useState({ total: 100, used: 0, remaining: 100 }) // 配额信息
  const [hasResult, setHasResult] = useState(false) // 是否有试穿结果

  // === 服装选择状态 ===
  const [selected, setSelected] = useState([]) // 已选中的服装列表
  const [customClothing, setCustomClothing] = useState([]) // 用户自定义上传的服装
  const [wardrobeClothing, setWardrobeClothing] = useState([]) // 从衣橱选择的服装

  // === 弹窗显示状态 ===
  const [showLoginModal, setShowLoginModal] = useState(false) // 登录弹窗
  const [showSettingsModal, setShowSettingsModal] = useState(false) // 设置弹窗
  const [showStoreModal, setShowStoreModal] = useState(false) // 店铺信息弹窗
  const [showWardrobeModal, setShowWardrobeModal] = useState(false) // 衣橱弹窗
  const [showCustomUploadModal, setShowCustomUploadModal] = useState(false) // 自定义上传弹窗
  const [showConfirmModal, setShowConfirmModal] = useState(false) // 确认对话框
  const [confirmConfig, setConfirmConfig] = useState({ title: '', message: '', action: null })
  const [showPreviewModal, setShowPreviewModal] = useState(false) // 图片预览弹窗
  const [previewModalData, setPreviewModalData] = useState({ src: '', name: '' })
  const [showCameraModal, setShowCameraModal] = useState(false) // 相机弹窗
  const [cameraCallback, setCameraCallback] = useState(null) // 相机拍照回调

  // === 衣橱上传分类/名称/颜色 ===
  const [wardrobeUploadCategory, setWardrobeUploadCategory] = useState('tops')
  const [wardrobeUploadSubcategory, setWardrobeUploadSubcategory] = useState('')
  const [wardrobeUploadSubcategoryCustom, setWardrobeUploadSubcategoryCustom] = useState('')
  const [wardrobeUploadName, setWardrobeUploadName] = useState('')
  const [wardrobeUploadColor, setWardrobeUploadColor] = useState('黑色')

  // === 自定义上传分类/名称/颜色 ===
  const [customUploadCategory, setCustomUploadCategory] = useState('tops')
  const [customUploadSubcategory, setCustomUploadSubcategory] = useState('')
  const [customUploadSubcategoryCustom, setCustomUploadSubcategoryCustom] = useState('')
  const [customUploadName, setCustomUploadName] = useState('')
  const [customUploadColor, setCustomUploadColor] = useState('黑色')

  // === 用户认证状态 ===
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userInfo, setUserInfo] = useState(null)
  const [loginLoading, setLoginLoading] = useState(false)

  // === 管理员联系信息 ===
  const [showAdminContactModal, setShowAdminContactModal] = useState(false)
  const [adminContactInfo, setAdminContactInfo] = useState(null)
  const [adminContactLoading, setAdminContactLoading] = useState(false)

  // === 历史记录弹窗 ===
  const [showHistoryModal, setShowHistoryModal] = useState(false)

  // 防止 StrictMode 下重复初始化
  const initRef = useRef(false)

  /** 获取管理员联系信息 */
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

  /** 显示管理员联系弹窗（懒加载联系信息） */
  const handleShowAdminContact = useCallback(async () => {
    if (!adminContactInfo) {
      await fetchAdminContact()
    }
    setShowAdminContactModal(true)
  }, [adminContactInfo, fetchAdminContact])

  /** 脱敏处理：手机号中间4位用 * 替换 */
  const maskPhone = useCallback(phone => {
    if (!phone || phone.length < 7) {
      return phone
    }
    return `${phone.slice(0, 3)}****${phone.slice(-4)}`
  }, [])

  /** 脱敏处理：微信号中间用 *** 替换 */
  const maskWechat = useCallback(wechat => {
    if (!wechat || wechat.length < 4) {
      return wechat
    }
    return `${wechat.slice(0, 2)}***${wechat.slice(-2)}`
  }, [])

  /** 脱敏处理：邮箱用户名中间用 *** 替换 */
  const maskEmail = useCallback(email => {
    if (!email || !email.includes('@')) {
      return email
    }
    const [name, domain] = email.split('@')
    return `${name.slice(0, 2)}***@${domain}`
  }, [])

  useEffect(() => {
    if (userInfo && userInfo.quota_total !== undefined) {
      setQuota({
        total: userInfo.quota_total,
        used: userInfo.quota_used || 0,
        remaining: userInfo.quota_remaining || userInfo.quota_total - (userInfo.quota_used || 0),
      })
    }
  }, [userInfo])

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

  useEffect(() => {
    if (sessionCustomer) {
      setSessionId(sessionCustomer)
    }
  }, [sessionCustomer])

  useEffect(() => {
    const handleLogout = () => {
      setIsLoggedIn(false)
      setUserInfo(null)
      localStorage.removeItem(STORAGE_KEYS.USER_INFO)
    }
    window.addEventListener('auth:logout', handleLogout)
    return () => window.removeEventListener('auth:logout', handleLogout)
  }, [])

  /** 显示 Toast 提示，3秒后自动消失 */
  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  /** 刷新用户信息（含配额数据），更新本地缓存 */
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

  /** 试穿完成回调：标记有结果，刷新用户配额信息 */
  const handleTryOnComplete = useCallback(
    ({ resultUrl: _url }) => {
      setHasResult(true)
      refreshUserInfo()
    },
    [refreshUserInfo]
  )

  /** 试穿失败回调：显示错误 Toast */
  const handleTryOnError = useCallback(
    error => {
      showToast(error || t('n_tryOnFail'), 'error')
    },
    [showToast, t]
  )

  const {
    status,
    progress,
    resultUrl,
    history: tryOnHistory,
    avatarKey: _avatarKey,
    remainingTime,
    modelPhotos,
    modelPhotosLoading,
    submitTask,
    fetchHistory,
    fetchModelPhotos,
    clearResult,
    startGenerating,
    cancelGenerating,
    updateHistoryRecord,
  } = useTryOn({
    sessionId: sessionCustomer,
    onComplete: handleTryOnComplete,
    onError: handleTryOnError,
  })

  const {
    clothing,
    categories,
    loading: clothingLoading,
    fetchClothing,
    fetchCategories,
    uploadClothing,
    deleteClothing,
  } = useClothing()

  useEffect(() => {
    // 防止 StrictMode 下重复初始化
    if (initRef.current) {
      return
    }
    initRef.current = true

    const initApp = async () => {
      const startTime = Date.now()
      const MIN_LOADING_TIME = 2000

      // 跟踪登录状态（使用本地变量避免异步状态更新问题）
      let isAuthenticated = false

      try {
        // 检查缓存版本，版本不匹配时清除旧缓存
        const cachedVersion = localStorage.getItem(STORAGE_KEYS.CACHE_VERSION)
        if (cachedVersion !== CURRENT_CACHE_VERSION) {
          safeStorage.removeItem(STORAGE_KEYS.SELECTED_CLOTHING)
          safeStorage.removeItem(STORAGE_KEYS.CUSTOM_CLOTHING)
          safeStorage.removeItem(STORAGE_KEYS.WARDROBE_CLOTHING)
          safeStorage.removeItem(STORAGE_KEYS.AVATAR_PREVIEW)
          localStorage.setItem(STORAGE_KEYS.CACHE_VERSION, CURRENT_CACHE_VERSION)
        }

        if (TokenManager.isAuthenticated()) {
          const cachedUserInfo = localStorage.getItem(STORAGE_KEYS.USER_INFO)
          if (cachedUserInfo) {
            try {
              const parsed = JSON.parse(cachedUserInfo)
              setUserInfo(parsed)
              isAuthenticated = true
            } catch (e) {
              // 忽略解析错误
            }
          }

          try {
            const response = await api.get(API_ENDPOINTS.AUTH.ME)
            if (response.success) {
              const userData = response.data?.data || response.data
              isAuthenticated = true
              setIsLoggedIn(true)
              setUserInfo(userData)
              localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(userData))
            } else {
              TokenManager.clearTokens()
              localStorage.removeItem(STORAGE_KEYS.USER_INFO)
              isAuthenticated = false
              setIsLoggedIn(false)
              setUserInfo(null)
            }
          } catch (error) {
            if (!cachedUserInfo) {
              isAuthenticated = true
              setIsLoggedIn(true)
              setUserInfo({ store_name: t('settingsLoggedIn') })
            }
          }
        }

        // 更新全局状态
        setIsLoggedIn(isAuthenticated)

        const cachedAvatar = await safeStorage.getItem(STORAGE_KEYS.AVATAR_PREVIEW)
        if (cachedAvatar) {
          setAvatarPreview(cachedAvatar)
        }

        // 仅在已登录时加载服装缓存
        if (isAuthenticated) {
          const cachedCustomClothing = await safeStorage.getItem(STORAGE_KEYS.CUSTOM_CLOTHING)
          if (cachedCustomClothing) {
            try {
              const parsed =
                typeof cachedCustomClothing === 'string'
                  ? JSON.parse(cachedCustomClothing)
                  : cachedCustomClothing
              setCustomClothing(parsed)
            } catch (e) {
              // 忽略解析错误
            }
          }

          const cachedWardrobeClothing = await safeStorage.getItem(STORAGE_KEYS.WARDROBE_CLOTHING)
          if (cachedWardrobeClothing) {
            try {
              const parsed =
                typeof cachedWardrobeClothing === 'string'
                  ? JSON.parse(cachedWardrobeClothing)
                  : cachedWardrobeClothing
              setWardrobeClothing(parsed)
            } catch (e) {
              // 忽略解析错误
            }
          }
        }

        const cachedSelected = await safeStorage.getItem(STORAGE_KEYS.SELECTED_CLOTHING)
        if (cachedSelected) {
          try {
            const parsed =
              typeof cachedSelected === 'string' ? JSON.parse(cachedSelected) : cachedSelected
            // 检查是否有图片 URL
            if (parsed.length > 0 && !parsed[0].image_url) {
              safeStorage.removeItem(STORAGE_KEYS.SELECTED_CLOTHING)
            } else {
              setSelected(parsed)
            }
          } catch (e) {
            console.error('[Cache] 解析已选服装缓存失败:', e)
          }
        }

        // 获取模特照片（仅在已登录时）
        if (isAuthenticated) {
          await fetchModelPhotos()
        }

        const elapsed = Date.now() - startTime
        const waitTime = MIN_LOADING_TIME - elapsed
        if (waitTime > 0) {
          await new Promise(resolve => {
            setTimeout(resolve, waitTime)
          })
        }
      } catch (error) {
        console.error('[Init] 初始化失败:', error)
      } finally {
        setAppLoading(false)
      }
    }

    initApp()
  }, [t, fetchModelPhotos])

  useEffect(() => {
    if (isLoggedIn) {
      fetchHistory()
      fetchClothing().then(items => {
        if (items.length > 0) {
          setWardrobeClothing(items)
          safeStorage.setItem(STORAGE_KEYS.WARDROBE_CLOTHING, items)
        }
      })
      fetchCategories()
    }
  }, [isLoggedIn, fetchHistory, fetchClothing, fetchCategories])

  /**
   * 处理头像文件选择
   * 校验大小(≤30MB)和格式 → 设置预览 → 缓存到 localStorage
   */
  const handleAvatarChange = useCallback(
    async e => {
      const file = e.target.files?.[0]
      if (file) {
        const MAX_SIZE = 30 * 1024 * 1024
        if (file.size > MAX_SIZE) {
          showToast(t('n_imgTooLarge30MB'), 'warning')
          e.target.value = ''
          return
        }

        const allowedTypes = [
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/bmp',
          'image/heic',
          'image/heif',
        ]
        if (!allowedTypes.includes(file.type)) {
          showToast(t('n_imgFormatError'), 'error')
          e.target.value = ''
          return
        }

        setAvatarSource('user')

        const objectUrl = URL.createObjectURL(file)
        setAvatarPreview(objectUrl)

        let processedFile = file
        if (file.size > 500 * 1024) {
          try {
            processedFile = await compressImage(file, 1, 1280, 1280)
          } catch (error) {
            console.warn('图片压缩失败，使用原始文件:', error)
          }
        }

        setAvatarFile(processedFile)

        const reader = new FileReader()
        reader.onload = ev => {
          const base64 = ev.target.result
          setAvatarPreview(base64)
          safeStorage.setItem(STORAGE_KEYS.AVATAR_PREVIEW, base64)
          URL.revokeObjectURL(objectUrl)
        }
        reader.onerror = () => {
          URL.revokeObjectURL(objectUrl)
          showToast(t('n_imgReadFail'), 'error')
        }
        reader.readAsDataURL(processedFile)
      } else if (e.target.files === null) {
        setAvatarFile(null)
        setAvatarPreview(null)
        setAvatarSource('user')
        safeStorage.removeItem(STORAGE_KEYS.AVATAR_PREVIEW)
      }
    },
    [showToast, t]
  )

  // 删除当前形象
  const deleteAvatar = useCallback(() => {
    setAvatarFile(null)
    setAvatarPreview(null)
    setAvatarSource('user')
    safeStorage.removeItem(STORAGE_KEYS.AVATAR_PREVIEW)
  }, [])

  /**
   * 提交试穿任务
   * 流程：登录检查 → 头像检查 → 服装检查 → 配额检查(本地+服务端) → 头像处理 → 提交
   * 移动端提交后自动滚动到结果区域
   */
  const handleTryOn = useCallback(async () => {
    if (!isLoggedIn) {
      showToast(t('n_needLogin'), 'warning')
      setShowLoginModal(true)
      return
    }

    if (!avatarPreview) {
      showToast(t('n_needAvatar'), 'warning')
      return
    }
    if (selected.length === 0) {
      showToast(t('n_needClothing'), 'warning')
      return
    }
    if (quota.remaining <= 0) {
      showToast(t('n_quotaEmpty'), 'error')
      handleShowAdminContact()
      return
    }

    startGenerating()

    // 再次检查服务器配额（防止多设备同时使用）
    try {
      const meResponse = await api.get(API_ENDPOINTS.AUTH.ME)
      if (meResponse.success) {
        const serverQuota = meResponse.data?.data || meResponse.data
        // 更新本地配额
        if (serverQuota?.quota_remaining !== undefined) {
          setQuota({
            total: serverQuota.quota_total || quota.total,
            used: serverQuota.quota_used || quota.used,
            remaining: serverQuota.quota_remaining,
          })
        }
        if (serverQuota.quota_remaining <= 0) {
          cancelGenerating()
          showToast(t('n_quotaEmpty'), 'error')
          handleShowAdminContact()
          return
        }
      }
    } catch (e) {
      // 忽略解析错误，继续执行
    }

    let fileToSubmit = null
    let keyToReuse = null
    let submitAvatarSource = avatarSource || 'user'

    if (avatarSource === 'system') {
      keyToReuse = await safeStorage.getItem(STORAGE_KEYS.REUSE_AVATAR_KEY)
    } else if (avatarFile) {
      fileToSubmit = avatarFile
      submitAvatarSource = 'user'
    } else if (avatarPreview) {
      try {
        const response = await fetch(avatarPreview)
        if (!response.ok) {
          throw new Error(`Failed to fetch avatar: ${response.status}`)
        }
        const blob = await response.blob()
        if (blob.size === 0) {
          throw new Error('Avatar blob is empty')
        }
        fileToSubmit = new File([blob], 'avatar.jpg', { type: blob.type || 'image/jpeg' })
        if (!avatarPreview.startsWith('/images/')) {
          setAvatarFile(fileToSubmit)
        }
        submitAvatarSource = 'user'
      } catch (e) {
        cancelGenerating()
        showToast(t('n_imgReadFail'), 'error')
        return
      }
    }

    await submitTask(fileToSubmit, selected, keyToReuse, submitAvatarSource)

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
    avatarSource,
    selected,
    quota,
    submitTask,
    showToast,
    startGenerating,
    cancelGenerating,
    handleShowAdminContact,
    t,
  ])

  const _showNotification = useCallback(
    (message, type = 'success') => {
      showToast(message, type)
    },
    [showToast]
  )

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

  const openPreviewModal = useCallback((src, name) => {
    setPreviewModalData({ src, name })
    setShowPreviewModal(true)
  }, [])

  const closePreviewModal = useCallback(() => {
    setShowPreviewModal(false)
    setPreviewModalData({ src: '', name: '' })
  }, [])

  const openCameraModal = useCallback(callback => {
    setCameraCallback(callback)
    setShowCameraModal(true)
  }, [])

  const closeCameraModal = useCallback(() => {
    setShowCameraModal(false)
    setCameraCallback(null)
  }, [])

  /** 登出：清除所有认证状态和本地缓存 */
  const handleLogout = useCallback(() => {
    showConfirmDialog(t('logoutTitle'), t('logoutMsg'), () => {
      TokenManager.clearTokens()
      localStorage.removeItem(STORAGE_KEYS.USER_INFO)
      setIsLoggedIn(false)
      setUserInfo(null)

      setQuota({ total: 100, used: 0, remaining: 100 })

      setSelected([])
      setAvatarFile(null)
      setAvatarPreview(null)
      setHasResult(false)
      clearResult()
      setCustomClothing([])
      setWardrobeClothing([])

      safeStorage.removeItem(STORAGE_KEYS.AVATAR_PREVIEW)
      safeStorage.removeItem(STORAGE_KEYS.CUSTOM_CLOTHING)
      safeStorage.removeItem(STORAGE_KEYS.WARDROBE_CLOTHING)
      safeStorage.removeItem(STORAGE_KEYS.SELECTED_CLOTHING)
      safeStorage.removeItem(STORAGE_KEYS.SESSION_CUSTOMER)

      showToast(t('n_logoutSuccess'), 'info')
    })
  }, [showConfirmDialog, showToast, clearResult, t])

  // 从「我的衣橱」移除单件服装（服装库弹窗心形点击触发）
  const handleRemoveWardrobeItem = useCallback(item => {
    const id = item?.id ?? item?.image_key ?? item?.key
    if (!id) {
      return
    }
    setWardrobeClothing(prev => {
      const next = prev.filter(i => (i.id ?? i.image_key ?? i.key) !== id)
      safeStorage.setItem(STORAGE_KEYS.WARDROBE_CLOTHING, next)
      return next
    })
  }, [])

  // 加入「我的衣橱」（服装库弹窗心形收藏触发）—— 与 wardrobeClothing 统一
  const handleAddWardrobeItem = useCallback(item => {
    const id = item?.id ?? item?.image_key ?? item?.key
    if (!id) {
      return
    }
    setWardrobeClothing(prev => {
      if (prev.some(i => (i.id ?? i.image_key ?? i.key) === id)) {
        return prev
      }
      const normalized = {
        id: item.id,
        uuid: item.uuid,
        name: item.name,
        category: item.category,
        subcategory: item.subcategory,
        color: item.color,
        price: item.price,
        image: item.image_thumb_url || item.image_url || item.image,
        imageFull: item.image_url || item.image,
        image_key: item.image_key,
        source: item.source || 'wardrobe',
        isWardrobe: true,
      }
      const next = [...prev, normalized]
      safeStorage.setItem(STORAGE_KEYS.WARDROBE_CLOTHING, next)
      return next
    })
  }, [])

  const handleEndSession = useCallback(async () => {
    if (!isLoggedIn) {
      showToast(t('n_needLogin'), 'warning')
      setShowLoginModal(true)
      return
    }

    showConfirmDialog(t('endSessionTitle'), t('endSessionMsg'), async () => {
      const currentSessionId = sessionCustomer

      try {
        await api.delete(
          `${API_ENDPOINTS.TRYON.CLEAR}?session_id=${encodeURIComponent(currentSessionId)}`
        )
      } catch (error) {
        // 忽略清空历史失败
      }

      setSelected([])
      setAvatarFile(null)
      setAvatarPreview(null)
      setHasResult(false)
      clearResult()
      setCustomClothing([])
      setWardrobeClothing([])
      safeStorage.removeItem(STORAGE_KEYS.AVATAR_PREVIEW)
      safeStorage.removeItem(STORAGE_KEYS.CUSTOM_CLOTHING)
      safeStorage.removeItem(STORAGE_KEYS.WARDROBE_CLOTHING)
      safeStorage.removeItem(STORAGE_KEYS.SELECTED_CLOTHING)

      const now = new Date()
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
      const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '')
      const newCustomer = `Customer_${dateStr}_${timeStr}`
      safeStorage.setItem(STORAGE_KEYS.SESSION_CUSTOMER, newCustomer)
      setSessionCustomer(newCustomer)
      showToast(t('n_sessionEnded'), 'info')
    })
  }, [isLoggedIn, showConfirmDialog, showToast, clearResult, sessionCustomer, t])

  const handleClearHistory = useCallback(async () => {
    if (!isLoggedIn) {
      showToast(t('n_needLogin'), 'warning')
      setShowLoginModal(true)
      return
    }

    if (!tryOnHistory || tryOnHistory.length === 0) {
      showToast(t('n_noHistory'), 'info')
      return
    }
    showConfirmDialog(t('clearHistoryTitle'), t('clearHistoryMsgCurrent'), async () => {
      try {
        const response = await api.delete(
          `${API_ENDPOINTS.TRYON.CLEAR}?session_id=${encodeURIComponent(sessionCustomer)}`
        )
        if (response.success) {
          await new Promise(resolve => {
            setTimeout(resolve, 100)
          })
          await fetchHistory()
          showToast(t('n_cleared'), 'info')
        }
      } catch (error) {
        showToast(t('n_clearFail'), 'error')
      }
    })
  }, [isLoggedIn, tryOnHistory, showConfirmDialog, showToast, fetchHistory, sessionCustomer, t])

  const handleClearSelection = useCallback(() => {
    setSelected([])
    setAvatarFile(null)
    setAvatarPreview(null)
    setHasResult(false)
    clearResult()
    setCustomClothing([])
    setWardrobeClothing([])
    // 同步清除本地缓存，避免刷新页面后衣服/形象缓存残留
    safeStorage.removeItem(STORAGE_KEYS.SELECTED_CLOTHING)
    safeStorage.removeItem(STORAGE_KEYS.CUSTOM_CLOTHING)
    safeStorage.removeItem(STORAGE_KEYS.WARDROBE_CLOTHING)
    safeStorage.removeItem(STORAGE_KEYS.AVATAR_PREVIEW)
  }, [clearResult])

  const handleToggleHistorySaved = useCallback(
    async (uuid, newSavedState) => {
      if (!isLoggedIn) {
        showToast(t('n_needLogin'), 'warning')
        setShowLoginModal(true)
        return
      }

      try {
        const response = await api.post(API_ENDPOINTS.TRYON.SAVE(uuid), { is_saved: newSavedState })

        if (response.success) {
          // 实时更新本地状态
          updateHistoryRecord(uuid, { is_saved: newSavedState })
          showToast(newSavedState ? t('n_saved') : t('n_unsaved'), 'success')
        } else {
          console.error(`[收藏] 操作失败: ${response.error}`)
          showToast(response.error || t('n_saveFail'), 'error')
        }
      } catch (error) {
        console.error(`[收藏] 异常:`, error)
        showToast(t('n_saveFail'), 'error')
      }
    },
    [isLoggedIn, showToast, t, updateHistoryRecord]
  )

  const handleDeleteHistory = useCallback(
    async uuid => {
      if (!isLoggedIn) {
        showToast(t('n_needLogin'), 'warning')
        setShowLoginModal(true)
        return
      }

      try {
        const response = await api.delete(API_ENDPOINTS.TRYON.DELETE(uuid))
        if (response.success) {
          fetchHistory()
          showToast(t('n_deleted'), 'info')
        } else {
          showToast(t('n_deleteFail'), 'error')
        }
      } catch (error) {
        showToast(t('n_deleteFail'), 'error')
      }
    },
    [isLoggedIn, fetchHistory, showToast, t]
  )

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
    closePreviewModal,
    closeCameraModal,
  ])

  const handleLoginSubmit = useCallback(
    async (username, password) => {
      if (!username || !password) {
        showToast(t('n_loginInputEmpty'), 'warning')
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
          setShowLoginModal(false)
          showToast(t('n_loginSuccess'), 'success')
        } else {
          const errorMsg = response.error || t('n_loginError')
          showToast(errorMsg, 'error')
          if (errorMsg.includes('待审核') || errorMsg.includes('联系管理员')) {
            handleShowAdminContact()
          }
        }
      } catch (error) {
        const errorMsg = error?.response?.data?.error || error?.message || t('n_loginFail')
        showToast(errorMsg, 'error')
        if (errorMsg.includes('待审核') || errorMsg.includes('联系管理员')) {
          handleShowAdminContact()
        }
      } finally {
        setLoginLoading(false)
      }
    },
    [showToast, t, handleShowAdminContact]
  )

  const handleSmsLogin = useCallback(
    async (phone, code) => {
      if (!phone || !code) {
        showToast(t('n_loginPhoneEmpty'), 'warning')
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
          setShowLoginModal(false)
          showToast(t('n_loginSuccess'), 'success')
        } else {
          const errorMsg = response.error || t('n_smsError')
          showToast(errorMsg, 'error')
          if (errorMsg.includes('待审核') || errorMsg.includes('联系管理员')) {
            handleShowAdminContact()
          }
        }
      } catch (error) {
        const errorMsg = error?.response?.data?.error || error?.message || t('n_loginFail')
        showToast(errorMsg, 'error')
        if (errorMsg.includes('待审核') || errorMsg.includes('联系管理员')) {
          handleShowAdminContact()
        }
      } finally {
        setLoginLoading(false)
      }
    },
    [showToast, t, handleShowAdminContact]
  )

  const handleSendSms = useCallback(
    async phone => {
      if (!phone) {
        showToast(t('n_phoneEmpty'), 'warning')
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
          showToast(t('n_smsSent'), 'success')
          return true
        }
        showToast(response.error || t('n_smsSendFail'), 'error')
        return false
      } catch (error) {
        showToast(t('n_smsSendFailRetry'), 'error')
        return false
      }
    },
    [showToast, t]
  )

  const handleRegister = useCallback(
    async (username, phone, password, storeName = '') => {
      if (!username || !phone || !password) {
        showToast(t('n_registerInputEmpty', '请填写完整信息'), 'warning')
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
          setIsLoggedIn(true)
          setUserInfo(registerData.merchant)
          setShowLoginModal(false)
          showToast(t('n_registerSuccess', '注册成功'), 'success')
        } else {
          showToast(response.error || t('n_registerError', '注册失败'), 'error')
        }
      } catch (error) {
        showToast(t('n_registerFail', '注册失败，请稍后重试'), 'error')
      } finally {
        setLoginLoading(false)
      }
    },
    [showToast, t]
  )

  const _handleSaveResult = useCallback(() => {
    if (!hasResult || tryOnHistory.length === 0) {
      showToast(t('n_noSave'), 'warning')
      return
    }
    const latest = tryOnHistory[0]
    if (latest) {
      handleToggleHistorySaved(latest.id)
    }
  }, [hasResult, tryOnHistory, handleToggleHistorySaved, showToast, t])

  const _handleShare = useCallback(() => {
    if (!hasResult) {
      showToast(t('n_noShare'), 'warning')
      return
    }
    showToast(t('n_shareSoon'), 'info')
  }, [hasResult, showToast, t])

  const handleToggle = useCallback(item => {
    if (!item || item.id === undefined) {
      console.warn('handleToggle: 无效的服装项', item)
      return
    }
    setSelected(prev => {
      const exists = prev.find(s => s.id === item.id)
      let newList
      if (exists) {
        newList = prev.filter(s => s.id !== item.id)
      } else {
        const filtered = prev.filter(s => s.category !== item.category)
        newList = [...filtered, item]
      }
      try {
        const storageList = newList.map(i => ({
          id: i.id,
          uuid: i.uuid,
          name: i.name,
          category: i.category,
          subcategory: i.subcategory,
          color: i.color,
          // 兼容 image 和 image_url 两种字段名
          image_url: i.image_url || i.image,
          image_thumb_url: i.image_thumb_url || i.image,
          isCustom: i.isCustom,
          isWardrobe: i.isWardrobe,
        }))
        safeStorage.setItem(STORAGE_KEYS.SELECTED_CLOTHING, storageList)
      } catch (e) {
        console.warn('存储失败:', e)
      }
      return newList
    })
  }, [])

  const handleRemoveSelected = useCallback(id => {
    setSelected(prev => {
      const newList = prev.filter(s => s.id !== id)
      try {
        const storageList = newList.map(i => ({
          id: i.id,
          uuid: i.uuid,
          name: i.name,
          category: i.category,
          subcategory: i.subcategory,
          color: i.color,
          // 兼容 image 和 image_url 两种字段名
          image_url: i.image_url || i.image,
          image_thumb_url: i.image_thumb_url || i.image,
          isCustom: i.isCustom,
          isWardrobe: i.isWardrobe,
        }))
        safeStorage.setItem(STORAGE_KEYS.SELECTED_CLOTHING, storageList)
      } catch (e) {
        console.warn('存储失败:', e)
      }
      return newList
    })
  }, [])

  const handleCustomUpload = useCallback(
    async (file, category = 'tops', subcategory = '', name = '', color = '黑色') => {
      if (!isLoggedIn) {
        showToast(t('n_needLogin'), 'warning')
        setShowLoginModal(true)
        return
      }

      if (!file) {
        return
      }

      const MAX_SIZE = 5 * 1024 * 1024
      if (file.size > MAX_SIZE) {
        showToast(t('n_imgSizeLimit'), 'warning')
        return
      }

      const allowedTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/bmp',
        'image/heic',
        'image/heif',
      ]
      if (!allowedTypes.includes(file.type)) {
        showToast(t('n_imgFormatError'), 'error')
        return
      }

      const fileName = truncateFileName(name || file.name.replace(/\.[^.]+$/, ''))
      let processedFile = file
      if (file.name.length > 30) {
        processedFile = new File([file], truncateFileName(file.name), {
          type: file.type,
          lastModified: Date.now(),
        })
      }

      if (processedFile.size > 500 * 1024) {
        try {
          showToast(t('n_imgOptimizing'), 'info')
          processedFile = await compressImage(processedFile, 1, 1280, 1280)
        } catch (error) {
          console.warn('图片压缩失败，使用原始文件:', error)
        }
      }

      const tempId = `custom_uploading_${Date.now()}`
      const localPreview = URL.createObjectURL(processedFile)

      const placeholderItem = {
        id: tempId,
        uuid: tempId,
        name: fileName,
        category,
        subcategory,
        color,
        image: localPreview,
        imageFull: null,
        isUploading: true,
        isCustom: true,
      }

      setCustomClothing(prev => [...prev, placeholderItem])

      try {
        const formData = new FormData()
        formData.append('file', processedFile)
        formData.append('name', fileName)
        formData.append('category', category)
        formData.append('subcategory', subcategory || 'other')
        formData.append('color', color)
        formData.append('source', 'custom')

        const response = await api.upload(`${API_ENDPOINTS.WARDROBE.CLOTHING}upload/`, formData)

        if (response.success) {
          const item = response.data?.data || response.data
          const newItem = {
            id: item.uuid,
            uuid: item.uuid,
            name: item.name,
            category: item.category,
            subcategory: item.subcategory,
            color: item.color || color,
            price: item.price,
            sizes: item.sizes,
            image: item.image_thumb_url || item.image_url,
            imageFull: item.image_url,
            image_key: item.image_key,
            source: item.source || 'custom',
            isCustom: true,
            isUploading: false,
          }

          URL.revokeObjectURL(localPreview)

          setCustomClothing(prev => {
            const newList = prev.map(i => (i.id === tempId ? newItem : i))
            safeStorage.setItem(STORAGE_KEYS.CUSTOM_CLOTHING, newList)
            return newList
          })
          showToast(t('n_customAdded', { count: 1 }), 'success')
        } else {
          URL.revokeObjectURL(localPreview)
          setCustomClothing(prev => prev.filter(item => item.id !== tempId))
          showToast(response.error || t('n_uploadFail'), 'error')
        }
      } catch (error) {
        console.error('[CustomUpload] 上传失败:', error)
        URL.revokeObjectURL(localPreview)
        setCustomClothing(prev => prev.filter(item => item.id !== tempId))
        showToast(t('n_imgUploadFail'), 'error')
      }
    },
    [isLoggedIn, showToast, t]
  )

  const _handleUpdateWardrobeCategory = useCallback((category, subcategory) => {
    setWardrobeUploadCategory(category)
    setWardrobeUploadSubcategory(subcategory || '')
    setWardrobeUploadSubcategoryCustom('')
  }, [])

  // 服装库「自定义上传」入口回调：把选中的图按当前分类/颜色作为自定义服装上传
  const handleCustomUploadFile = useCallback(
    async (file, category = 'tops', color = '黑色') => {
      await handleCustomUpload(file, category, '', '', color)
    },
    [handleCustomUpload]
  )

  const handleWardrobeUpload = useCallback(
    async (file, category = 'tops', subcategory = '', name = '', color = wardrobeUploadColor) => {
      if (!isLoggedIn) {
        showToast(t('n_needLogin'), 'warning')
        setShowLoginModal(true)
        return
      }

      if (!file) {
        return
      }

      const MAX_SIZE = 5 * 1024 * 1024
      if (file.size > MAX_SIZE) {
        showToast(t('n_imgSizeLimit'), 'warning')
        return
      }

      const allowedTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/bmp',
        'image/heic',
        'image/heif',
      ]
      if (!allowedTypes.includes(file.type)) {
        showToast(t('n_imgFormatError'), 'error')
        return
      }

      const fileName = truncateFileName(name || file.name.replace(/\.[^.]+$/, ''))
      let processedFile = file
      if (file.name.length > 30) {
        processedFile = new File([file], truncateFileName(file.name), {
          type: file.type,
          lastModified: Date.now(),
        })
      }

      if (processedFile.size > 500 * 1024) {
        try {
          showToast(t('n_imgOptimizing'), 'info')
          processedFile = await compressImage(processedFile, 1, 1280, 1280)
        } catch (error) {
          console.warn('图片压缩失败，使用原始文件:', error)
        }
      }

      const tempId = `wardrobe_uploading_${Date.now()}`
      const localPreview = URL.createObjectURL(processedFile)

      const finalSubcategory = wardrobeUploadSubcategoryCustom || subcategory

      const placeholderItem = {
        id: tempId,
        uuid: tempId,
        name: fileName,
        category,
        subcategory: finalSubcategory,
        color,
        image: localPreview,
        imageFull: null,
        isUploading: true,
        isWardrobe: true,
      }

      setWardrobeClothing(prev => [...prev, placeholderItem])

      try {
        const formData = new FormData()
        formData.append('file', processedFile)
        formData.append('name', fileName)
        formData.append('category', category)
        formData.append('subcategory', finalSubcategory || 'other')
        formData.append('color', color)
        formData.append('source', 'wardrobe')

        const response = await api.upload(`${API_ENDPOINTS.WARDROBE.CLOTHING}upload/`, formData)

        if (response.success) {
          const item = response.data?.data || response.data
          const newItem = {
            id: item.uuid,
            uuid: item.uuid,
            name: item.name,
            category: item.category,
            subcategory: item.subcategory,
            color: item.color || color,
            price: item.price,
            sizes: item.sizes,
            image: item.image_thumb_url || item.image_url,
            imageFull: item.image_url,
            image_key: item.image_key,
            source: item.source || 'wardrobe',
            isWardrobe: true,
            isUploading: false,
          }

          URL.revokeObjectURL(localPreview)

          setWardrobeClothing(prev => {
            const newList = prev.map(i => (i.id === tempId ? newItem : i))
            safeStorage.setItem(STORAGE_KEYS.WARDROBE_CLOTHING, newList)
            return newList
          })
          showToast(t('n_wardrobeAdded'), 'success')
        } else {
          URL.revokeObjectURL(localPreview)
          setWardrobeClothing(prev => prev.filter(item => item.id !== tempId))
          showToast(response.error || t('n_uploadFail'), 'error')
        }
      } catch (error) {
        console.error('[WardrobeUpload] 上传失败:', error)
        URL.revokeObjectURL(localPreview)
        setWardrobeClothing(prev => prev.filter(item => item.id !== tempId))
        showToast(t('n_imgUploadFail'), 'error')
      }
    },
    [isLoggedIn, showToast, wardrobeUploadSubcategoryCustom, wardrobeUploadColor, t]
  )

  const handleRemoveCustomClothing = useCallback(
    async id => {
      if (!isLoggedIn) {
        showToast(t('n_needLogin'), 'warning')
        setShowLoginModal(true)
        return
      }

      const item = customClothing.find(c => c.id === id)

      if (item?.uuid && !item.uuid.startsWith('custom_')) {
        try {
          await api.delete(API_ENDPOINTS.WARDROBE.CLOTHING_DETAIL(item.uuid))
        } catch (e) {
          console.warn('云端删除失败:', e)
        }
      }

      setSelected(prev => prev.filter(i => i.id !== id))
      setCustomClothing(prev => {
        const newList = prev.filter(i => i.id !== id)
        safeStorage.setItem(STORAGE_KEYS.CUSTOM_CLOTHING, newList)
        return newList
      })
      showToast(t('n_customRemoved'), 'info')
    },
    [isLoggedIn, showToast, customClothing, t]
  )

  const _handleRemoveWardrobeItem = useCallback(
    async id => {
      if (!isLoggedIn) {
        showToast(t('n_needLogin'), 'warning')
        setShowLoginModal(true)
        return
      }

      const item = wardrobeClothing.find(c => c.id === id)

      if (item?.uuid && !item.uuid.startsWith('wardrobe_')) {
        try {
          await api.delete(API_ENDPOINTS.WARDROBE.CLOTHING_DETAIL(item.uuid))
        } catch (e) {
          console.warn('云端删除失败:', e)
        }
      }

      setSelected(prev => prev.filter(i => i.id !== id))
      setWardrobeClothing(prev => {
        const newList = prev.filter(i => i.id !== id)
        safeStorage.setItem(STORAGE_KEYS.WARDROBE_CLOTHING, newList)
        return newList
      })
      showToast(t('n_wardrobeRemoved'), 'info')
    },
    [isLoggedIn, showToast, wardrobeClothing, t]
  )

  const isOnline = useNetworkStatus({ showToast, t, currentToast: toast })

  return (
    <>
      {appLoading && <GlobalLoading />}
      {typeof window !== 'undefined' && window.location.pathname.startsWith('/scan-upload') ? (
        <ScanUploadPage />
      ) : (
        <div className='bg-texture min-h-screen transition-colors'>
          <Header
            user={isLoggedIn ? userInfo : null}
            sessionCustomer={sessionCustomer}
            onOpenSettings={() => setShowSettingsModal(true)}
            onEndSession={handleEndSession}
            onOpenHistory={() => setShowHistoryModal(true)}
            history={tryOnHistory}
            theme={theme}
            onDeleteAvatar={deleteAvatar}
            mode={mode}
            onThemeChange={setTheme}
            onToggleMode={toggleMode}
          />
          <MainLayout
            avatarPreview={avatarPreview}
            avatarSource={avatarSource}
            onAvatarChange={handleAvatarChange}
            onSetAvatarPreview={preview => {
              setAvatarPreview(preview)
              safeStorage.setItem(STORAGE_KEYS.AVATAR_PREVIEW, preview)
              if (preview && preview.startsWith('/images/')) {
                setAvatarFile(null)
                safeStorage.removeItem(STORAGE_KEYS.AVATAR_FILE)
              }
            }}
            onModelSelect={(imageUrl, imageKey, source = 'system') => {
              setAvatarPreview(imageUrl)
              safeStorage.setItem(STORAGE_KEYS.AVATAR_PREVIEW, imageUrl)
              setAvatarSource(source)
              if (imageKey) {
                safeStorage.setItem(STORAGE_KEYS.REUSE_AVATAR_KEY, imageKey)
                safeStorage.setItem(STORAGE_KEYS.REUSE_AVATAR_SOURCE, source)
              }
              setAvatarFile(null)
              safeStorage.removeItem(STORAGE_KEYS.AVATAR_FILE)
            }}
            selected={selected}
            onToggleSelect={handleToggle}
            selectedClothing={selected}
            onRemoveSelected={handleRemoveSelected}
            onRemoveWardrobeItem={handleRemoveWardrobeItem}
            onAddWardrobeItem={handleAddWardrobeItem}
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
            modelPhotos={modelPhotos}
            modelPhotosLoading={modelPhotosLoading}
            fetchModelPhotos={fetchModelPhotos}
            remainingTime={remainingTime}
            showHistoryModal={showHistoryModal}
            onCloseHistoryModal={() => setShowHistoryModal(false)}
            sessionCustomer={sessionCustomer}
            onCustomUploadFile={handleCustomUploadFile}
          />
          {toast && <Toast message={toast.message} type={toast.type} />}

          <LoginModal
            isOpen={showLoginModal}
            onClose={() => setShowLoginModal(false)}
            onLogin={handleLoginSubmit}
            onSmsLogin={handleSmsLogin}
            onSendSms={handleSendSms}
            onRegister={handleRegister}
            loading={loginLoading}
          />

          {showAdminContactModal && (
            <div
              className='fixed inset-0 z-[var(--z-modal-1)] flex items-center justify-center p-4'
              role='dialog'
              aria-modal='true'
            >
              <div
                className='absolute inset-0 bg-black/50 backdrop-blur-sm'
                onClick={() => setShowAdminContactModal(false)}
                onKeyDown={e => {
                  if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
                    setShowAdminContactModal(false)
                  }
                }}
                role='button'
                tabIndex={-1}
                aria-label={t('adminContactClose', '关闭联系方式弹窗')}
              />
              <div className='relative w-full max-w-sm animate-scale-in overflow-hidden rounded-2xl bg-[var(--bg-card)] shadow-2xl'>
                <button
                  type='button'
                  onClick={() => setShowAdminContactModal(false)}
                  className='absolute right-3 top-3 z-10 rounded-full bg-black/30 p-1.5 transition-colors hover:bg-black/50'
                  aria-label={t('settingsClose')}
                >
                  <svg
                    className='h-4 w-4 text-white'
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
                <div className='bg-gradient-to-r from-[var(--accent)] to-[var(--accent-dark)] px-6 py-5 text-center'>
                  <h2 className='text-lg font-semibold text-white'>
                    {t('adminContactTitle', '联系管理员')}
                  </h2>
                  <p className='mt-1 text-xs text-[var(--text-muted)]'>
                    {t('adminContactSubtitle', '如需开通账号或充值额度，请联系管理员')}
                  </p>
                </div>
                <div className='px-6 py-5'>
                  {(() => {
                    if (adminContactLoading) {
                      return (
                        <div className='flex items-center justify-center py-8'>
                          <svg
                            className='h-8 w-8 animate-spin text-champagne'
                            fill='none'
                            viewBox='0 0 24 24'
                          >
                            <circle
                              className='opacity-25'
                              cx='12'
                              cy='12'
                              r='10'
                              stroke='currentColor'
                              strokeWidth='4'
                            />
                            <path
                              className='opacity-75'
                              fill='currentColor'
                              d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                            />
                          </svg>
                        </div>
                      )
                    }
                    if (adminContactInfo) {
                      return (
                        <div className='space-y-4'>
                          {adminContactInfo.name && (
                            <div className='flex items-center gap-3 rounded-xl border border-grayLight p-3'>
                              <div className='bg-champagne/20 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full'>
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
                                <p className='text-xs text-grayMuted'>{t('adminName', '管理员')}</p>
                                <p className='text-sm font-medium text-charcoal'>
                                  {adminContactInfo.name}
                                </p>
                              </div>
                            </div>
                          )}
                          {adminContactInfo.phone && (
                            <AdminContactItem
                              icon={
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
                                    d='M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z'
                                  />
                                </svg>
                              }
                              label={t('adminPhone', '手机号')}
                              value={adminContactInfo.phone}
                              maskedValue={maskPhone(adminContactInfo.phone)}
                            />
                          )}
                          {adminContactInfo.wechat && (
                            <AdminContactItem
                              icon={
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
                                    d='M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'
                                  />
                                </svg>
                              }
                              label={t('adminWechat', '微信号')}
                              value={adminContactInfo.wechat}
                              maskedValue={maskWechat(adminContactInfo.wechat)}
                            />
                          )}
                          {adminContactInfo.email && (
                            <AdminContactItem
                              icon={
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
                                    d='M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
                                  />
                                </svg>
                              }
                              label={t('adminEmail', '邮箱')}
                              value={adminContactInfo.email}
                              maskedValue={maskEmail(adminContactInfo.email)}
                            />
                          )}
                        </div>
                      )
                    }
                    return (
                      <p className='text-center text-sm text-grayMuted'>
                        {t('adminContactEmpty', '暂无联系方式')}
                      </p>
                    )
                  })()}
                  <button
                    type='button'
                    onClick={() => setShowAdminContactModal(false)}
                    className='hover:bg-charcoal/90 mt-5 w-full rounded-xl bg-charcoal py-3 text-sm font-semibold text-white transition-colors'
                  >
                    {t('close', '关闭')}
                  </button>
                </div>
              </div>
            </div>
          )}

          <SettingsModal
            open={showSettingsModal}
            isLoggedIn={isLoggedIn}
            userInfo={userInfo}
            sessionCustomer={sessionCustomer}
            onClose={() => setShowSettingsModal(false)}
            onLogin={() => setShowLoginModal(true)}
            onLogout={handleLogout}
            onOpenStoreInfo={() => setShowStoreModal(true)}
            onEndSession={handleEndSession}
          />

          {showStoreModal && (
            <div
              className='fixed inset-0 z-[var(--z-modal-1)] flex items-center justify-center p-4'
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
                aria-label={t('storeClose')}
              />
              <div className='relative w-full max-w-sm animate-scale-in overflow-hidden rounded-2xl bg-[var(--bg-card)] shadow-2xl'>
                <div className='bg-gradient-to-r from-[var(--accent)] to-[var(--accent-dark)] px-6 py-5 text-center'>
                  <div className='border-champagne/40 bg-champagne/20 mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border-2'>
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
                    {isLoggedIn ? userInfo?.store_name || t('storeMyStore') : t('storeNotLoggedIn')}
                  </h2>
                  <p className='mt-1 text-xs text-[var(--text-muted)]'>
                    {isLoggedIn
                      ? userInfo?.username || t('settingsMerchantAccount')
                      : t('storePleaseLogin')}
                  </p>
                </div>
                <div className='space-y-4 px-6 py-4'>
                  {isLoggedIn ? (
                    <>
                      <div className='bg-grayLight/30 rounded-xl p-4'>
                        <div className='mb-2 flex items-center justify-between'>
                          <span className='text-sm font-medium text-charcoal'>
                            {t('storeQuota')}
                          </span>
                          <span className='text-sm text-grayMuted'>
                            {quota.used} / {quota.total} {t('historyUnit')}
                          </span>
                        </div>
                        <div className='h-2.5 overflow-hidden rounded-full bg-grayLight'>
                          <div
                            className='to-champagne/80 h-full rounded-full bg-gradient-to-r from-champagne transition-all duration-300'
                            style={{
                              width: `${quota.total > 0 ? Math.min((quota.used / quota.total) * 100, 100) : 0}%`,
                            }}
                          />
                        </div>
                        <div className='mt-2 flex items-center justify-between'>
                          <span className='text-xs text-grayMuted'>
                            {t('storeQuotaUsed', { n: quota.used })}
                          </span>
                          <span className='text-xs font-medium text-success'>
                            {t('storeQuotaRemaining', { n: quota.remaining })}
                          </span>
                        </div>
                      </div>
                      <div className='flex items-center justify-between py-2'>
                        <span className='text-sm text-grayMuted'>{t('storeAccountStatus')}</span>
                        <span className='text-sm font-medium text-success'>
                          {t('settingsLoggedIn')}
                        </span>
                      </div>
                      <div className='flex items-center justify-between py-2'>
                        <span className='text-sm text-grayMuted'>{t('storeWardrobeItems')}</span>
                        <span className='text-sm font-medium text-charcoal'>
                          {t('storeItemsCount', { n: clothing?.length || 0 })}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className='flex items-center justify-between py-2'>
                        <span className='text-sm text-grayMuted'>账号状态</span>
                        <span className='text-sm font-medium text-error'>未登录</span>
                      </div>
                      <div className='py-4 text-center'>
                        <p className='mb-4 text-sm text-grayMuted'>{t('storeLoginRequired')}</p>
                        <button
                          type='button'
                          onClick={() => {
                            setShowStoreModal(false)
                            setShowLoginModal(true)
                          }}
                          className='hover:bg-champagne/90 rounded-xl bg-champagne px-6 py-2.5 text-sm font-medium text-white transition-colors'
                        >
                          {t('storeLoginNow')}
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <div className='px-6 pb-4'>
                  <button
                    type='button'
                    className='hover:bg-charcoal/90 w-full rounded-xl bg-charcoal py-2.5 text-sm font-medium text-white transition-colors'
                    onClick={() => setShowStoreModal(false)}
                  >
                    {t('close')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {showWardrobeModal && (
            <div
              className='fixed inset-0 z-[var(--z-modal-1)] flex items-center justify-center p-4'
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
                aria-label={t('wardrobeCloseAria')}
              />
              <div className='relative w-full max-w-md animate-scale-in overflow-hidden rounded-2xl bg-[var(--bg-card)] shadow-2xl'>
                <div className='flex items-center justify-between border-b border-grayLight px-6 py-4'>
                  <h2 className='text-lg font-semibold text-charcoal'>{t('wardrobeTitle')}</h2>
                  <button
                    type='button'
                    onClick={() => setShowWardrobeModal(false)}
                    className='rounded-lg p-1.5 transition-colors hover:bg-[var(--bg-secondary)]'
                    aria-label={t('wardrobeCloseAria')}
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
                  <p className='text-sm text-grayMuted'>{t('wardrobeDesc')}</p>
                  <div className='grid grid-cols-2 gap-3'>
                    <div>
                      <label
                        htmlFor='wardrobe-category'
                        className='mb-1.5 block text-xs font-medium text-charcoal'
                      >
                        {t('categoryPrimary')}
                      </label>
                      <select
                        id='wardrobe-category'
                        value={wardrobeUploadCategory}
                        onChange={e => {
                          setWardrobeUploadCategory(e.target.value)
                          setWardrobeUploadSubcategory('')
                          setWardrobeUploadSubcategoryCustom('')
                        }}
                        className='focus:ring-champagne/20 w-full rounded-xl border border-grayLight bg-transparent px-3 py-2.5 text-sm focus:border-champagne focus:outline-none focus:ring-2'
                      >
                        <option value='tops'>{t('catTops')}</option>
                        <option value='bottoms'>{t('catBottoms')}</option>
                        <option value='dresses'>{t('catDresses')}</option>
                        <option value='outerwear'>{t('catOuterwear')}</option>
                        <option value='shoes'>{t('catShoes')}</option>
                        <option value='accessories'>{t('catAccessories')}</option>
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor='wardrobe-subcategory'
                        className='mb-1.5 block text-xs font-medium text-charcoal'
                      >
                        {t('categorySecondary')}
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
                        className='focus:ring-champagne/20 w-full rounded-xl border border-grayLight bg-transparent px-3 py-2.5 text-sm focus:border-champagne focus:outline-none focus:ring-2'
                      >
                        <option value=''>{t('subcategoryAny')}</option>
                        {wardrobeUploadCategory === 'tops' && (
                          <>
                            <option value='t-shirt'>{t('subTshirt')}</option>
                            <option value='shirt'>{t('subShirt')}</option>
                            <option value='sweater'>{t('subSweater')}</option>
                            <option value='hoodie'>{t('subHoodie')}</option>
                            <option value='blouse'>{t('subBlouse')}</option>
                          </>
                        )}
                        {wardrobeUploadCategory === 'bottoms' && (
                          <>
                            <option value='jeans'>{t('subJeans')}</option>
                            <option value='pants'>{t('subPants')}</option>
                            <option value='shorts'>{t('subShorts')}</option>
                            <option value='skirt'>{t('subSkirt')}</option>
                          </>
                        )}
                        {wardrobeUploadCategory === 'dresses' && (
                          <>
                            <option value='mini'>{t('subMiniDress')}</option>
                            <option value='midi'>{t('subMidiDress')}</option>
                            <option value='maxi'>{t('subMaxiDress')}</option>
                          </>
                        )}
                        {wardrobeUploadCategory === 'outerwear' && (
                          <>
                            <option value='jacket'>{t('subJacket')}</option>
                            <option value='coat'>{t('subCoat')}</option>
                            <option value='blazer'>{t('subBlazer')}</option>
                            <option value='vest'>{t('subVest')}</option>
                          </>
                        )}
                        {wardrobeUploadCategory === 'shoes' && (
                          <>
                            <option value='sneakers'>{t('subSneakers')}</option>
                            <option value='heels'>{t('subHeels')}</option>
                            <option value='boots'>{t('subBoots')}</option>
                            <option value='flats'>{t('subFlats')}</option>
                          </>
                        )}
                        {wardrobeUploadCategory === 'accessories' && (
                          <>
                            <option value='hat'>{t('subHat')}</option>
                            <option value='bag'>{t('subBag')}</option>
                            <option value='scarf'>{t('subScarf')}</option>
                            <option value='belt'>{t('subBelt')}</option>
                            <option value='jewelry'>{t('subJewelry')}</option>
                          </>
                        )}
                        <option value='custom'>+ {t('subcategoryCustom')}</option>
                      </select>
                    </div>
                  </div>
                  {wardrobeUploadSubcategory === 'custom' && (
                    <div>
                      <label
                        htmlFor='wardrobe-subcategory-custom'
                        className='mb-1.5 block text-xs font-medium text-charcoal'
                      >
                        {t('customSubcategoryLabel')}
                      </label>
                      <input
                        id='wardrobe-subcategory-custom'
                        type='text'
                        value={wardrobeUploadSubcategoryCustom}
                        onChange={e => setWardrobeUploadSubcategoryCustom(e.target.value)}
                        className='placeholder:text-grayMuted/60 focus:ring-champagne/20 w-full rounded-xl border border-grayLight px-3 py-2.5 text-sm focus:border-champagne focus:outline-none focus:ring-2'
                        placeholder={t('customSubcategoryPlaceholder')}
                      />
                    </div>
                  )}
                  <div>
                    <label
                      htmlFor='wardrobe-name'
                      className='mb-1.5 block text-xs font-medium text-charcoal'
                    >
                      {t('clothingNameLabel')}
                    </label>
                    <input
                      id='wardrobe-name'
                      type='text'
                      value={wardrobeUploadName}
                      onChange={e => setWardrobeUploadName(e.target.value)}
                      className='placeholder:text-grayMuted/60 focus:ring-champagne/20 w-full rounded-xl border border-grayLight px-3 py-2.5 text-sm focus:border-champagne focus:outline-none focus:ring-2'
                      placeholder={t('clothingNamePlaceholder')}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor='wardrobe-color'
                      className='mb-1.5 block text-xs font-medium text-charcoal'
                    >
                      {t('color') || '颜色'}
                    </label>
                    <select
                      id='wardrobe-color'
                      value={wardrobeUploadColor}
                      onChange={e => setWardrobeUploadColor(e.target.value)}
                      className='focus:ring-champagne/20 w-full rounded-xl border border-grayLight px-3 py-2.5 text-sm focus:border-champagne focus:outline-none focus:ring-2'
                    >
                      {FALLBACK_COLOR_TAGS.map(c => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
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
                    className='flex w-full items-center justify-center gap-2 rounded-xl bg-champagne py-3 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-strong)]'
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
                    {t('cameraUpload')}
                  </button>
                </div>
                <div className='border-t border-grayLight px-6 py-3'>
                  <div className='mb-2 flex items-center justify-between'>
                    <span className='text-xs font-medium text-charcoal'>
                      {t('wardrobeUploaded')}
                    </span>
                    <span className='text-xs text-champagne'>{wardrobeClothing?.length || 0}</span>
                  </div>
                  <div className='grid max-h-40 grid-cols-4 gap-2 overflow-y-auto'>
                    {wardrobeClothing && wardrobeClothing.length > 0 ? (
                      wardrobeClothing.map(item => (
                        <div key={item.id} className='gc-thumb gc-scope'>
                          <CachedImage
                            src={item.image}
                            alt={item.name}
                            className='h-full w-full object-cover'
                          />
                          <button
                            type='button'
                            className='gc-thumb-remove'
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
                        <p className='text-xs text-grayMuted'>{t('wardrobeEmpty')}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {showCustomUploadModal && (
            <div
              className='fixed inset-0 z-[var(--z-modal-1)] flex items-center justify-center p-4'
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
                aria-label={t('customUploadCloseAria')}
              />
              <div className='relative w-full max-w-md animate-scale-in overflow-hidden rounded-2xl bg-[var(--bg-card)] shadow-2xl'>
                <div className='flex items-center justify-between border-b border-grayLight px-6 py-4'>
                  <h2 className='text-lg font-semibold text-charcoal'>{t('customUploadTitle')}</h2>
                  <button
                    type='button'
                    onClick={() => setShowCustomUploadModal(false)}
                    className='rounded-lg p-1.5 transition-colors hover:bg-[var(--bg-secondary)]'
                    aria-label={t('customUploadCloseAria')}
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
                  <p className='text-sm text-grayMuted'>{t('customUploadDesc')}</p>
                  <div className='grid grid-cols-2 gap-3'>
                    <div>
                      <label
                        htmlFor='custom-category'
                        className='mb-1.5 block text-xs font-medium text-charcoal'
                      >
                        {t('categoryPrimary')}
                      </label>
                      <select
                        id='custom-category'
                        value={customUploadCategory}
                        onChange={e => {
                          setCustomUploadCategory(e.target.value)
                          setCustomUploadSubcategory('')
                          setCustomUploadSubcategoryCustom('')
                        }}
                        className='focus:ring-champagne/20 w-full rounded-xl border border-grayLight bg-transparent px-3 py-2.5 text-sm focus:border-champagne focus:outline-none focus:ring-2'
                      >
                        <option value='tops'>{t('catTops')}</option>
                        <option value='bottoms'>{t('catBottoms')}</option>
                        <option value='dresses'>{t('catDresses')}</option>
                        <option value='outerwear'>{t('catOuterwear')}</option>
                        <option value='shoes'>{t('catShoes')}</option>
                        <option value='accessories'>{t('catAccessories')}</option>
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor='custom-subcategory'
                        className='mb-1.5 block text-xs font-medium text-charcoal'
                      >
                        {t('categorySecondary')}
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
                        className='focus:ring-champagne/20 w-full rounded-xl border border-grayLight bg-transparent px-3 py-2.5 text-sm focus:border-champagne focus:outline-none focus:ring-2'
                      >
                        <option value=''>{t('subcategoryAny')}</option>
                        {customUploadCategory === 'tops' && (
                          <>
                            <option value='t-shirt'>{t('subTshirt')}</option>
                            <option value='shirt'>{t('subShirt')}</option>
                            <option value='sweater'>{t('subSweater')}</option>
                            <option value='hoodie'>{t('subHoodie')}</option>
                            <option value='blouse'>{t('subBlouse')}</option>
                          </>
                        )}
                        {customUploadCategory === 'bottoms' && (
                          <>
                            <option value='jeans'>{t('subJeans')}</option>
                            <option value='pants'>{t('subPants')}</option>
                            <option value='shorts'>{t('subShorts')}</option>
                            <option value='skirt'>{t('subSkirt')}</option>
                          </>
                        )}
                        {customUploadCategory === 'dresses' && (
                          <>
                            <option value='mini'>{t('subMiniDress')}</option>
                            <option value='midi'>{t('subMidiDress')}</option>
                            <option value='maxi'>{t('subMaxiDress')}</option>
                          </>
                        )}
                        {customUploadCategory === 'outerwear' && (
                          <>
                            <option value='jacket'>{t('subJacket')}</option>
                            <option value='coat'>{t('subCoat')}</option>
                            <option value='blazer'>{t('subBlazer')}</option>
                            <option value='vest'>{t('subVest')}</option>
                          </>
                        )}
                        {customUploadCategory === 'shoes' && (
                          <>
                            <option value='sneakers'>{t('subSneakers')}</option>
                            <option value='heels'>{t('subHeels')}</option>
                            <option value='boots'>{t('subBoots')}</option>
                            <option value='flats'>{t('subFlats')}</option>
                          </>
                        )}
                        {customUploadCategory === 'accessories' && (
                          <>
                            <option value='hat'>{t('subHat')}</option>
                            <option value='bag'>{t('subBag')}</option>
                            <option value='scarf'>{t('subScarf')}</option>
                            <option value='belt'>{t('subBelt')}</option>
                            <option value='jewelry'>{t('subJewelry')}</option>
                          </>
                        )}
                        <option value='custom'>+ {t('subcategoryCustom')}</option>
                      </select>
                    </div>
                  </div>
                  {customUploadSubcategory === 'custom' && (
                    <div>
                      <label
                        htmlFor='custom-subcategory-custom'
                        className='mb-1.5 block text-xs font-medium text-charcoal'
                      >
                        {t('customSubcategoryLabel')}
                      </label>
                      <input
                        id='custom-subcategory-custom'
                        type='text'
                        value={customUploadSubcategoryCustom}
                        onChange={e => setCustomUploadSubcategoryCustom(e.target.value)}
                        className='placeholder:text-grayMuted/60 focus:ring-champagne/20 w-full rounded-xl border border-grayLight px-3 py-2.5 text-sm focus:border-champagne focus:outline-none focus:ring-2'
                        placeholder={t('customSubcategoryPlaceholder')}
                      />
                    </div>
                  )}
                  <div>
                    <label
                      htmlFor='custom-name'
                      className='mb-1.5 block text-xs font-medium text-charcoal'
                    >
                      {t('customUploadNameLabel')}
                    </label>
                    <input
                      id='custom-name'
                      type='text'
                      value={customUploadName}
                      onChange={e => setCustomUploadName(e.target.value)}
                      className='placeholder:text-grayMuted/60 focus:ring-champagne/20 w-full rounded-xl border border-grayLight px-3 py-2.5 text-sm focus:border-champagne focus:outline-none focus:ring-2'
                      placeholder={t('customUploadNamePlaceholder')}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor='custom-color'
                      className='mb-1.5 block text-xs font-medium text-charcoal'
                    >
                      {t('color') || '颜色'}
                    </label>
                    <select
                      id='custom-color'
                      value={customUploadColor}
                      onChange={e => setCustomUploadColor(e.target.value)}
                      className='focus:ring-champagne/20 w-full rounded-xl border border-grayLight px-3 py-2.5 text-sm focus:border-champagne focus:outline-none focus:ring-2'
                    >
                      {FALLBACK_COLOR_TAGS.map(c => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
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
                          customUploadName,
                          customUploadColor
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
                    className='flex w-full items-center justify-center gap-2 rounded-xl bg-champagne py-3 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-strong)]'
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
                    {t('cameraUpload')}
                  </button>
                </div>
                <div className='border-t border-grayLight px-6 py-3'>
                  <div className='mb-2 flex items-center justify-between'>
                    <span className='text-xs font-medium text-charcoal'>{t('customUploaded')}</span>
                    <span className='text-xs text-champagne'>{customClothing?.length || 0}</span>
                  </div>
                  <div className='grid max-h-40 grid-cols-4 gap-2 overflow-y-auto'>
                    {customClothing && customClothing.length > 0 ? (
                      customClothing.map(item => (
                        <div key={item.id} className='gc-thumb gc-scope'>
                          <CachedImage
                            src={item.image}
                            alt={item.name}
                            className='h-full w-full object-cover'
                          />
                          <button
                            type='button'
                            className='gc-thumb-remove'
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
                        <p className='text-xs text-grayMuted'>{t('wardrobeEmpty')}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {showConfirmModal && (
            <div
              className='fixed inset-0 z-[var(--z-modal-2)] flex items-center justify-center p-4'
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
                aria-label={t('confirmCloseAria')}
              />
              <div className='relative w-full max-w-sm animate-scale-in overflow-hidden rounded-2xl bg-[var(--bg-card)] shadow-2xl'>
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
                  <p className='mt-1.5 text-center text-sm text-grayMuted'>
                    {confirmConfig.message}
                  </p>
                </div>
                <div className='flex gap-3 px-6 py-4'>
                  <button
                    type='button'
                    className='flex-1 rounded-xl border border-grayLight py-2.5 text-sm font-medium text-charcoal transition-colors hover:bg-[var(--bg-secondary)]'
                    onClick={() => setShowConfirmModal(false)}
                  >
                    {t('confirmCancel')}
                  </button>
                  <button
                    type='button'
                    className='flex-1 rounded-xl bg-error py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-600'
                    onClick={handleConfirmAction}
                  >
                    {t('confirmOk')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {showPreviewModal && (
            <div
              className='fixed inset-0 z-[var(--z-modal-2)] flex items-center justify-center p-4'
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
                aria-label={t('previewCloseAria')}
              />
              <div className='relative animate-scale-in'>
                <CachedImage
                  src={previewModalData.src}
                  alt={previewModalData.name}
                  className='max-h-[70vh] min-h-[280px] w-auto min-w-[280px] max-w-[480px] rounded-xl object-contain shadow-2xl'
                />
                <div
                  className='bg-[var(--bg-card)]/95 absolute -right-2 -top-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full shadow-lg transition-colors hover:bg-[var(--bg-secondary)]'
                  onClick={closePreviewModal}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      closePreviewModal()
                    }
                  }}
                  role='button'
                  tabIndex={0}
                  aria-label={t('previewCloseAria')}
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

          {showCameraModal && (
            <div
              className='fixed inset-0 z-[var(--z-modal-2)] flex items-center justify-center'
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
                aria-label={t('cameraCloseAria')}
              />
              <div className='relative w-full max-w-xs animate-scale-in overflow-hidden rounded-2xl bg-[var(--bg-card)] shadow-2xl'>
                <div className='px-5 pb-3 pt-5'>
                  <h3 className='text-center text-base font-semibold text-charcoal'>
                    {t('cameraSelectTitle')}
                  </h3>
                </div>
                <div className='space-y-2.5 px-5 pb-5'>
                  <button
                    type='button'
                    className='flex w-full items-center gap-3.5 rounded-xl p-3.5 text-left transition-colors hover:bg-[var(--bg-secondary)]'
                    onClick={() => {
                      closeCameraModal()
                      if (cameraCallback) {
                        cameraCallback('user')
                      }
                    }}
                  >
                    <div className='bg-champagne/10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full'>
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
                      <p className='text-sm font-medium text-charcoal'>{t('cameraFront')}</p>
                      <p className='text-xs text-grayMuted'>{t('cameraFrontDesc')}</p>
                    </div>
                  </button>
                  <button
                    type='button'
                    className='flex w-full items-center gap-3.5 rounded-xl p-3.5 text-left transition-colors hover:bg-[var(--bg-secondary)]'
                    onClick={() => {
                      closeCameraModal()
                      if (cameraCallback) {
                        cameraCallback('environment')
                      }
                    }}
                  >
                    <div className='bg-champagne/10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full'>
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
                      <p className='text-sm font-medium text-charcoal'>{t('cameraBack')}</p>
                      <p className='text-xs text-grayMuted'>{t('cameraBackDesc')}</p>
                    </div>
                  </button>
                </div>
                <div className='px-5 pb-4'>
                  <button
                    type='button'
                    className='w-full py-2.5 text-sm font-medium text-grayMuted transition-colors hover:text-charcoal'
                    onClick={closeCameraModal}
                  >
                    {t('cancel')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {!isOnline && (
            <div
              className='fixed left-0 right-0 top-0 z-[var(--z-top)] bg-error px-4 py-2 text-center text-sm font-medium text-white transition-all duration-300'
              role='alert'
            >
              {t('networkOffline')}
            </div>
          )}

          <div
            id='notification-container'
            className='fixed right-6 top-24 z-[var(--z-top)] space-y-3'
            aria-live='polite'
            aria-relevant='additions'
          />
        </div>
      )}
    </>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </I18nProvider>
  )
}
