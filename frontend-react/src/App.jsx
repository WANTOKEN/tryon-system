/* eslint-disable no-console */
import { useState, useCallback, useEffect, useRef } from 'react'

import { I18nProvider, useI18n } from './hooks/useI18n'
import { useTryOn } from './hooks/useTryOn'
import { useClothing } from './hooks/useClothing'
import { api, TokenManager, setSessionId } from './utils/request'
import { API_ENDPOINTS } from './config/api'
import Header from './components/Header'
import MainLayout from './components/MainLayout'
import Toast from './components/Toast'
import LoginModal from './components/LoginModal'
import GlobalLoading from './components/GlobalLoading'
import CachedImage from './components/CachedImage'
import { STORAGE_KEYS, CURRENT_CACHE_VERSION } from './constants/storageKeys'
import { safeStorage } from './utils/safeStorage'

const compressImage = (file, maxSizeMB = 5, maxWidth = 1920, maxHeight = 1920) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width } = img
        let { height } = img

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = (height * maxWidth) / width
            width = maxWidth
          } else {
            width = (width * maxHeight) / height
            height = maxHeight
          }
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        const targetSize = maxSizeMB * 1024 * 1024
        const fileSize = file.size

        let initialQuality = 0.9
        if (fileSize > targetSize * 2) {
          initialQuality = 0.7
        } else if (fileSize > targetSize * 1.5) {
          initialQuality = 0.8
        }

        const compressWithQuality = quality =>
          new Promise(res => {
            canvas.toBlob(
              blob => {
                if (blob) {
                  if (blob.size <= targetSize || quality <= 0.1) {
                    if (blob.size > file.size) {
                      res(file)
                    } else {
                      const compressedFile = new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now(),
                      })
                      res(compressedFile)
                    }
                  } else {
                    const newQuality = Math.max(0.1, quality - 0.15)
                    compressWithQuality(newQuality).then(res)
                  }
                } else {
                  res(file)
                }
              },
              'image/jpeg',
              quality
            )
          })

        compressWithQuality(initialQuality).then(resolve)
      }
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = e.target.result
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })

const truncateFileName = (fileName, maxLength = 30) => {
  if (!fileName || fileName.length <= maxLength) {
    return fileName
  }
  const extIndex = fileName.lastIndexOf('.')
  if (extIndex === -1 || extIndex === 0) {
    return `${fileName.substring(0, maxLength - 3)}...`
  }
  const extension = fileName.substring(extIndex)
  const nameWithoutExt = fileName.substring(0, extIndex)
  const truncatedName = `${nameWithoutExt.substring(0, maxLength - extension.length - 3)}...`
  return truncatedName + extension
}

const extractDominantColor = (file, timeout = 500) =>
  new Promise(resolve => {
    const timer = setTimeout(() => resolve('#F5F4F0'), timeout)

    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          const size = 20
          canvas.width = size
          canvas.height = size
          ctx.drawImage(img, 0, 0, size, size)

          const { data } = ctx.getImageData(0, 0, size, size)
          const colorCounts = {}
          let maxCount = 0
          let dominantColor = '#F5F4F0'

          /* eslint-disable no-continue, no-bitwise */
          for (let i = 0; i < data.length; i += 16) {
            const r = data[i]
            const g = data[i + 1]
            const b = data[i + 2]
            const a = data[i + 3]

            if (a < 200) {
              continue
            }

            const brightness = (r + g + b) / 3
            if (brightness > 245 || brightness < 10) {
              continue
            }

            const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5)
            colorCounts[key] = (colorCounts[key] || 0) + 1

            if (colorCounts[key] > maxCount) {
              maxCount = colorCounts[key]
              const rHex = Math.min(255, r).toString(16).padStart(2, '0')
              const gHex = Math.min(255, g).toString(16).padStart(2, '0')
              const bHex = Math.min(255, b).toString(16).padStart(2, '0')
              dominantColor = `#${rHex}${gHex}${bHex}`
            }
          }
          /* eslint-enable no-continue, no-bitwise */

          clearTimeout(timer)
          resolve(dominantColor)
        } catch {
          clearTimeout(timer)
          resolve('#F5F4F0')
        }
      }
      img.onerror = () => {
        clearTimeout(timer)
        resolve('#F5F4F0')
      }
      img.src = e.target.result
    }
    reader.onerror = () => {
      clearTimeout(timer)
      resolve('#F5F4F0')
    }
    reader.readAsDataURL(file)
  })

function AdminContactItem({ icon, label, value, maskedValue }) {
  const [revealed, setRevealed] = useState(false)

  return (
    <div className='flex items-center gap-3 rounded-xl border border-grayLight p-3'>
      <div className='flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-champagne/20'>
        {icon}
      </div>
      <div className='min-w-0 flex-1'>
        <p className='text-xs text-grayMuted'>{label}</p>
        <p className='text-sm font-medium text-charcoal'>{revealed ? value : maskedValue}</p>
      </div>
      <button
        type='button'
        onClick={() => setRevealed(!revealed)}
        className='flex-shrink-0 text-xs text-champagne hover:underline'
      >
        {revealed ? '隐藏' : '查看'}
      </button>
    </div>
  )
}

function AppContent() {
  const { t } = useI18n()
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
  const [wardrobeUploadCategory, setWardrobeUploadCategory] = useState('tops')
  const [wardrobeUploadSubcategory, setWardrobeUploadSubcategory] = useState('')
  const [wardrobeUploadSubcategoryCustom, setWardrobeUploadSubcategoryCustom] = useState('')
  const [wardrobeUploadName, setWardrobeUploadName] = useState('')
  const [customUploadCategory, setCustomUploadCategory] = useState('tops')
  const [customUploadSubcategory, setCustomUploadSubcategory] = useState('')
  const [customUploadSubcategoryCustom, setCustomUploadSubcategoryCustom] = useState('')
  const [customUploadName, setCustomUploadName] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userInfo, setUserInfo] = useState(null)
  const [loginLoading, setLoginLoading] = useState(false)
  const [showAdminContactModal, setShowAdminContactModal] = useState(false)
  const [adminContactInfo, setAdminContactInfo] = useState(null)
  const [adminContactLoading, setAdminContactLoading] = useState(false)

  // 防止 StrictMode 下重复初始化
  const initRef = useRef(false)

  const fetchAdminContact = useCallback(async () => {
    setAdminContactLoading(true)
    try {
      const response = await api.get(API_ENDPOINTS.AUTH.ADMIN_CONTACT, { requiresAuth: false })
      if (response.success) {
        setAdminContactInfo(response.data?.data || response.data)
      }
    } catch (error) {
      console.error('Failed to fetch admin contact:', error)
    } finally {
      setAdminContactLoading(false)
    }
  }, [])

  const handleShowAdminContact = useCallback(async () => {
    if (!adminContactInfo) {
      await fetchAdminContact()
    }
    setShowAdminContactModal(true)
  }, [adminContactInfo, fetchAdminContact])

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

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

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

  const handleTryOnComplete = useCallback(
    ({ resultUrl: _url }) => {
      showToast(t('n_genSuccess'), 'success')
      setHasResult(true)
      refreshUserInfo()
    },
    [showToast, refreshUserInfo, t]
  )

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
  } = useTryOn({
    sessionId: sessionCustomer,
    onComplete: handleTryOnComplete,
    onError: handleTryOnError
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

      // 检查缓存版本，版本不匹配时清除旧缓存
      const cachedVersion = localStorage.getItem(STORAGE_KEYS.CACHE_VERSION)
      if (cachedVersion !== CURRENT_CACHE_VERSION) {
        console.log('[Cache] 版本不匹配，清除旧缓存')
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
            setIsLoggedIn(true)
          } catch (e) {
            // 忽略解析错误
          }
        }

        try {
          const response = await api.get(API_ENDPOINTS.AUTH.ME)
          if (response.success) {
            const userData = response.data?.data || response.data
            setIsLoggedIn(true)
            setUserInfo(userData)
            localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(userData))
          } else {
            TokenManager.clearTokens()
            localStorage.removeItem(STORAGE_KEYS.USER_INFO)
            setIsLoggedIn(false)
            setUserInfo(null)
          }
        } catch (error) {
          if (!cachedUserInfo) {
            setIsLoggedIn(true)
            setUserInfo({ store_name: t('settingsLoggedIn') })
          }
        }
      }

      const cachedAvatar = await safeStorage.getItem(STORAGE_KEYS.AVATAR_PREVIEW)
      if (cachedAvatar) {
        setAvatarPreview(cachedAvatar)
      }

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

      const cachedSelected = await safeStorage.getItem(STORAGE_KEYS.SELECTED_CLOTHING)
      if (cachedSelected) {
        try {
          const parsed =
            typeof cachedSelected === 'string' ? JSON.parse(cachedSelected) : cachedSelected
          console.log('[Cache] 读取已选服装缓存:', parsed)
          // 检查是否有图片 URL
          if (parsed.length > 0 && !parsed[0].image_url) {
            console.log('[Cache] 缓存数据缺少 image_url，清除旧缓存')
            safeStorage.removeItem(STORAGE_KEYS.SELECTED_CLOTHING)
          } else {
            setSelected(parsed)
          }
        } catch (e) {
          console.error('[Cache] 解析已选服装缓存失败:', e)
        }
      }

      // 获取模特照片
      await fetchModelPhotos()

      const elapsed = Date.now() - startTime
      const waitTime = MIN_LOADING_TIME - elapsed
      if (waitTime > 0) {
        await new Promise(resolve => {
          setTimeout(resolve, waitTime)
        })
      }
      setAppLoading(false)
    }

    initApp()
  }, [t, fetchModelPhotos])

  useEffect(() => {
    if (isLoggedIn) {
      fetchHistory()
      fetchClothing()
      fetchCategories()
    }
  }, [isLoggedIn, fetchHistory, fetchClothing, fetchCategories])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const handleAvatarChange = useCallback(
    e => {
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

        setAvatarFile(file)

        const objectUrl = URL.createObjectURL(file)
        setAvatarPreview(objectUrl)
        safeStorage.removeItem(STORAGE_KEYS.REUSE_AVATAR_KEY)

        const reader = new FileReader()
        reader.onload = ev => {
          const base64 = ev.target.result
          setAvatarPreview(base64)
          safeStorage.setItem(STORAGE_KEYS.AVATAR_PREVIEW, base64)
          setTimeout(() => URL.revokeObjectURL(objectUrl), 100)
        }
        reader.onerror = () => {
          URL.revokeObjectURL(objectUrl)
          showToast(t('n_imgReadFail'), 'error')
        }
        reader.readAsDataURL(file)
      } else if (e.target.files === null) {
        setAvatarFile(null)
        setAvatarPreview(null)
        safeStorage.removeItem(STORAGE_KEYS.AVATAR_PREVIEW)
        safeStorage.removeItem(STORAGE_KEYS.REUSE_AVATAR_KEY)
      }
    },
    [showToast, t]
  )

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

    const reuseAvatarKey = await safeStorage.getItem(STORAGE_KEYS.REUSE_AVATAR_KEY)
    let fileToSubmit = null
    let keyToReuse = null

    if (reuseAvatarKey) {
      keyToReuse = reuseAvatarKey
      safeStorage.removeItem(STORAGE_KEYS.REUSE_AVATAR_KEY)
    } else if (avatarFile) {
      fileToSubmit = avatarFile
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
      } catch (e) {
        cancelGenerating()
        showToast(t('n_imgReadFail'), 'error')
        return
      }
    }

    await submitTask(fileToSubmit, selected, keyToReuse)

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
    setHasResult(false)
  }, [])

  const handleToggleHistorySaved = useCallback(
    async uuid => {
      if (!isLoggedIn) {
        showToast(t('n_needLogin'), 'warning')
        setShowLoginModal(true)
        return
      }

      const record = tryOnHistory?.find(r => r.uuid === uuid)
      const newSavedState = record ? !record.is_saved : true

      try {
        const response = await api.post(API_ENDPOINTS.TRYON.SAVE(uuid), { is_saved: newSavedState })
        if (response.success) {
          fetchHistory()
          showToast(newSavedState ? t('n_saved') : t('n_unsaved'), 'success')
        }
      } catch (error) {
        showToast(t('n_saveFail'), 'error')
      }
    },
    [isLoggedIn, tryOnHistory, fetchHistory, showToast, t]
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

  const handleReuseAvatarFromHistory = useCallback(
    recordUuid => {
      const record = tryOnHistory?.find(r => r.uuid === recordUuid)
      if (!record) {
        showToast(t('n_notFound'), 'error')
        return
      }

      const keyToReuse = record.avatar_key || record.uuid

      if (!keyToReuse) {
        showToast(t('n_noAvatar'), 'warning')
        return
      }

      if (record.avatar_url) {
        setAvatarPreview(record.avatar_url)
        safeStorage.setItem(STORAGE_KEYS.AVATAR_PREVIEW, record.avatar_url)
        setAvatarFile(null)
      }

      safeStorage.setItem(STORAGE_KEYS.REUSE_AVATAR_KEY, keyToReuse)

      showToast(t('n_avatarReused'), 'success')
    },
    [tryOnHistory, showToast, t]
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
          localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(loginData.merchant))
          setIsLoggedIn(true)
          setUserInfo(loginData.merchant)
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
          localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(loginData.merchant))
          setIsLoggedIn(true)
          setUserInfo(loginData.merchant)
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

  const handleSendResetSms = useCallback(
    async phone => {
      if (!phone) {
        showToast(t('n_phoneEmpty'), 'warning')
        return false
      }

      try {
        const response = await api.post(
          API_ENDPOINTS.AUTH.SEND_RESET_SMS,
          { phone },
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

  const handleResetPassword = useCallback(
    async (phone, code, newPassword) => {
      if (!phone || !code || !newPassword) {
        showToast(t('n_resetInputEmpty', '请填写完整信息'), 'warning')
        return
      }

      setLoginLoading(true)
      try {
        const response = await api.post(
          API_ENDPOINTS.AUTH.RESET_PASSWORD,
          {
            phone,
            code,
            new_password: newPassword,
          },
          { requiresAuth: false }
        )

        if (response.success) {
          showToast(t('n_resetSuccess', '密码重置成功，请登录'), 'success')
          setShowLoginModal(false)
        } else {
          showToast(response.error || t('n_resetError', '重置失败'), 'error')
        }
      } catch (error) {
        showToast(t('n_resetFail', '重置失败，请稍后重试'), 'error')
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
        console.log('[Storage] 存储已选服装:', storageList)
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
    async (file, category = 'tops', subcategory = '', name = '') => {
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
          processedFile = await compressImage(processedFile, 5, 1920, 1920)
        } catch (error) {
          console.warn('图片压缩失败，使用原始文件:', error)
        }
      }

      const tempId = `custom_uploading_${Date.now()}`
      const reader = new FileReader()

      const placeholderItem = {
        id: tempId,
        uuid: tempId,
        name: fileName,
        category,
        subcategory,
        color: '#F5F4F0',
        image: null,
        imageFull: null,
        isUploading: true,
        isCustom: true,
      }

      setCustomClothing(prev => [...prev, placeholderItem])

      reader.onload = async e => {
        const localPreview = e.target.result
        const dominantColor = await extractDominantColor(file)
        setCustomClothing(prev =>
          prev.map(item =>
            item.id === tempId ? { ...item, image: localPreview, color: dominantColor } : item
          )
        )

        try {
          const formData = new FormData()
          formData.append('image', processedFile)
          formData.append('name', fileName)
          formData.append('category', category)
          formData.append('subcategory', subcategory || 'other')
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
              color: item.color || dominantColor,
              image: item.image_thumb_url || item.image_url,
              imageFull: item.image_url,
              image_key: item.image_key,
              source: item.source || 'custom',
              isCustom: true,
              isUploading: false,
            }

            setCustomClothing(prev => {
              const newList = prev.map(i => (i.id === tempId ? newItem : i))
              safeStorage.setItem(STORAGE_KEYS.CUSTOM_CLOTHING, newList)
              return newList
            })
            showToast(t('n_customAdded', { count: 1 }), 'success')
          } else {
            setCustomClothing(prev => prev.filter(item => item.id !== tempId))
            showToast(response.error || t('n_uploadFail'), 'error')
          }
        } catch (error) {
          console.error('[CustomUpload] 上传失败:', error)
          setCustomClothing(prev => prev.filter(item => item.id !== tempId))
          showToast(t('n_imgUploadFail'), 'error')
        }
      }

      reader.readAsDataURL(file)
    },
    [isLoggedIn, showToast, t]
  )

  const _handleUpdateWardrobeCategory = useCallback((category, subcategory) => {
    setWardrobeUploadCategory(category)
    setWardrobeUploadSubcategory(subcategory || '')
    setWardrobeUploadSubcategoryCustom('')
  }, [])

  const handleWardrobeUpload = useCallback(
    async (file, category = 'tops', subcategory = '', name = '') => {
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
          processedFile = await compressImage(processedFile, 5, 1920, 1920)
        } catch (error) {
          console.warn('图片压缩失败，使用原始文件:', error)
        }
      }

      const tempId = `wardrobe_uploading_${Date.now()}`
      const reader = new FileReader()

      const finalSubcategory = wardrobeUploadSubcategoryCustom || subcategory

      const placeholderItem = {
        id: tempId,
        uuid: tempId,
        name: fileName,
        category,
        subcategory: finalSubcategory,
        color: '#F5F4F0',
        image: null,
        imageFull: null,
        isUploading: true,
        isWardrobe: true,
      }

      setWardrobeClothing(prev => [...prev, placeholderItem])

      reader.onload = async e => {
        const localPreview = e.target.result
        const dominantColor = await extractDominantColor(file)
        setWardrobeClothing(prev =>
          prev.map(item =>
            item.id === tempId ? { ...item, image: localPreview, color: dominantColor } : item
          )
        )

        try {
          const formData = new FormData()
          formData.append('image', processedFile)
          formData.append('name', fileName)
          formData.append('category', category)
          formData.append('subcategory', finalSubcategory || 'other')
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
              color: item.color || dominantColor,
              image: item.image_thumb_url || item.image_url,
              imageFull: item.image_url,
              image_key: item.image_key,
              source: item.source || 'wardrobe',
              isWardrobe: true,
              isUploading: false,
            }

            setWardrobeClothing(prev => {
              const newList = prev.map(i => (i.id === tempId ? newItem : i))
              safeStorage.setItem(STORAGE_KEYS.WARDROBE_CLOTHING, newList)
              return newList
            })
            showToast(t('n_wardrobeAdded'), 'success')
          } else {
            setWardrobeClothing(prev => prev.filter(item => item.id !== tempId))
            showToast(response.error || t('n_uploadFail'), 'error')
          }
        } catch (error) {
          console.error('[WardrobeUpload] 上传失败:', error)
          setWardrobeClothing(prev => prev.filter(item => item.id !== tempId))
          showToast(t('n_imgUploadFail'), 'error')
        }
      }

      reader.readAsDataURL(file)
    },
    [isLoggedIn, showToast, wardrobeUploadSubcategoryCustom, t]
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

  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      if (toast && toast.message === '网络已断开，部分功能不可用') {
        showToast(t('networkRecovered'), 'success')
      }
    }
    const handleOffline = () => {
      setIsOnline(false)
      showToast(t('networkOffline'), 'warning')
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [showToast, toast, t])

  return (
    <>
      {appLoading && <GlobalLoading />}
      <div
        className={`bg-texture min-h-screen transition-colors ${theme === 'dark' ? 'dark' : ''}`}
      >
        <Header
          user={isLoggedIn ? userInfo : null}
          sessionCustomer={sessionCustomer}
          onOpenSettings={() => setShowSettingsModal(true)}
          onEndSession={handleEndSession}
        />
        <MainLayout
          avatarPreview={avatarPreview}
          onAvatarChange={handleAvatarChange}
          onSetAvatarPreview={preview => {
            setAvatarPreview(preview)
            safeStorage.setItem(STORAGE_KEYS.AVATAR_PREVIEW, preview)
            if (preview && preview.startsWith('/images/')) {
              setAvatarFile(null)
              safeStorage.removeItem(STORAGE_KEYS.AVATAR_FILE)
            }
          }}
          onModelSelect={(imageUrl, imageKey) => {
            setAvatarPreview(imageUrl)
            safeStorage.setItem(STORAGE_KEYS.AVATAR_PREVIEW, imageUrl)
            if (imageKey) {
              safeStorage.setItem(STORAGE_KEYS.REUSE_AVATAR_KEY, imageKey)
            }
            setAvatarFile(null)
            safeStorage.removeItem(STORAGE_KEYS.AVATAR_FILE)
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
          modelPhotos={modelPhotos}
          modelPhotosLoading={modelPhotosLoading}
          fetchModelPhotos={fetchModelPhotos}
          remainingTime={remainingTime}
        />
        {toast && <Toast message={toast.message} type={toast.type} />}

        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onLogin={handleLoginSubmit}
          onSmsLogin={handleSmsLogin}
          onSendSms={handleSendSms}
          onRegister={handleRegister}
          onSendResetSms={handleSendResetSms}
          onResetPassword={handleResetPassword}
          loading={loginLoading}
        />

        {showAdminContactModal && (
          <div
            className='fixed inset-0 z-[91] flex items-center justify-center p-4'
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
            <div className='relative w-full max-w-sm animate-scale-in overflow-hidden rounded-2xl bg-white shadow-2xl'>
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
              <div className='bg-gradient-to-r from-[#1A1A1A] to-[#2A2A2A] px-6 py-5 text-center'>
                <h2 className='text-lg font-semibold text-white'>
                  {t('adminContactTitle', '联系管理员')}
                </h2>
                <p className='mt-1 text-xs text-gray-400'>
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
                            <div className='flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-champagne/20'>
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
                  className='mt-5 w-full rounded-xl bg-charcoal py-3 text-sm font-semibold text-white transition-colors hover:bg-charcoal/90'
                >
                  {t('close', '关闭')}
                </button>
              </div>
            </div>
          </div>
        )}

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
              aria-label={t('settingsClose')}
            />
            <div className='relative w-full max-w-md animate-scale-in overflow-hidden rounded-2xl bg-white shadow-2xl'>
              <div className='flex items-center justify-between border-b border-grayLight px-6 py-4'>
                <h2 className='text-lg font-semibold text-charcoal'>{t('settingsTitle')}</h2>
                <button
                  type='button'
                  onClick={() => setShowSettingsModal(false)}
                  className='rounded-lg p-1.5 transition-colors hover:bg-gray-100'
                  aria-label={t('settingsClose')}
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
                    <span className='text-sm font-semibold text-charcoal'>
                      {t('settingsAccountInfo')}
                    </span>
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
                          {userInfo?.store_name || t('settingsMerchantAccount')}
                        </p>
                        <p className='mt-0.5 truncate text-xs text-grayMuted'>
                          {userInfo?.phone || t('settingsLoggedIn')}
                        </p>
                      </div>
                      <button
                        type='button'
                        onClick={handleLogout}
                        className='text-xs font-medium text-error hover:text-error/80'
                      >
                        {t('settingsLogout')}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className='mb-2 text-xs text-grayMuted'>{t('settingsLoginHint')}</p>
                      <button
                        type='button'
                        onClick={() => {
                          setShowSettingsModal(false)
                          setShowLoginModal(true)
                        }}
                        className='w-full rounded-xl bg-champagne py-2.5 text-sm font-medium text-white transition-colors hover:bg-yellow-600'
                      >
                        {t('settingsLoginBtn')}
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
                      <p className='text-sm font-medium text-charcoal'>{t('settingsStoreInfo')}</p>
                      <p className='text-xs text-grayMuted'>{t('settingsStoreHint')}</p>
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
                      <p className='text-sm font-medium text-error'>{t('settingsEndSession')}</p>
                      <p className='text-xs text-grayMuted'>{t('settingsEndHint')}</p>
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
                      <span className='text-sm font-semibold text-charcoal'>
                        {t('settingsLogoutSection')}
                      </span>
                    </div>
                    <p className='mb-2 text-xs text-grayMuted'>{t('settingsLogoutHint')}</p>
                    <button
                      type='button'
                      onClick={() => {
                        setShowSettingsModal(false)
                        handleLogout()
                      }}
                      className='w-full rounded-xl border border-error/30 py-2.5 text-sm font-medium text-error transition-colors hover:bg-error/5'
                    >
                      {t('settingsLogoutBtn')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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
              aria-label={t('storeClose')}
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
                  {isLoggedIn ? userInfo?.store_name || t('storeMyStore') : t('storeNotLoggedIn')}
                </h2>
                <p className='mt-1 text-xs text-gray-400'>
                  {isLoggedIn
                    ? userInfo?.username || t('settingsMerchantAccount')
                    : t('storePleaseLogin')}
                </p>
              </div>
              <div className='space-y-4 px-6 py-4'>
                {isLoggedIn ? (
                  <>
                    <div className='rounded-xl bg-grayLight/30 p-4'>
                      <div className='mb-2 flex items-center justify-between'>
                        <span className='text-sm font-medium text-charcoal'>{t('storeQuota')}</span>
                        <span className='text-sm text-grayMuted'>
                          {quota.used} / {quota.total} {t('historyUnit')}
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
                        className='rounded-xl bg-champagne px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-champagne/90'
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
                  className='w-full rounded-xl bg-charcoal py-2.5 text-sm font-medium text-white transition-colors hover:bg-charcoal/90'
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
              aria-label={t('wardrobeCloseAria')}
            />
            <div className='relative w-full max-w-md animate-scale-in overflow-hidden rounded-2xl bg-white shadow-2xl'>
              <div className='flex items-center justify-between border-b border-grayLight px-6 py-4'>
                <h2 className='text-lg font-semibold text-charcoal'>{t('wardrobeTitle')}</h2>
                <button
                  type='button'
                  onClick={() => setShowWardrobeModal(false)}
                  className='rounded-lg p-1.5 transition-colors hover:bg-gray-100'
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
                      className='w-full rounded-xl border border-grayLight bg-white px-3 py-2.5 text-sm focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/20'
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
                      className='w-full rounded-xl border border-grayLight bg-white px-3 py-2.5 text-sm focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/20'
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
                      className='w-full rounded-xl border border-grayLight px-3 py-2.5 text-sm placeholder:text-grayMuted/60 focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/20'
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
                    className='w-full rounded-xl border border-grayLight px-3 py-2.5 text-sm placeholder:text-grayMuted/60 focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/20'
                    placeholder={t('clothingNamePlaceholder')}
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
                  {t('cameraUpload')}
                </button>
              </div>
              <div className='border-t border-grayLight px-6 py-3'>
                <div className='mb-2 flex items-center justify-between'>
                  <span className='text-xs font-medium text-charcoal'>{t('wardrobeUploaded')}</span>
                  <span className='text-xs text-champagne'>{wardrobeClothing?.length || 0}</span>
                </div>
                <div className='grid max-h-40 grid-cols-4 gap-2 overflow-y-auto'>
                  {wardrobeClothing && wardrobeClothing.length > 0 ? (
                    wardrobeClothing.map(item => (
                      <div
                        key={item.id}
                        className='relative aspect-square overflow-hidden rounded-lg bg-grayLight'
                      >
                        <CachedImage
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
              aria-label={t('customUploadCloseAria')}
            />
            <div className='relative w-full max-w-md animate-scale-in overflow-hidden rounded-2xl bg-white shadow-2xl'>
              <div className='flex items-center justify-between border-b border-grayLight px-6 py-4'>
                <h2 className='text-lg font-semibold text-charcoal'>{t('customUploadTitle')}</h2>
                <button
                  type='button'
                  onClick={() => setShowCustomUploadModal(false)}
                  className='rounded-lg p-1.5 transition-colors hover:bg-gray-100'
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
                      className='w-full rounded-xl border border-grayLight bg-white px-3 py-2.5 text-sm focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/20'
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
                      className='w-full rounded-xl border border-grayLight bg-white px-3 py-2.5 text-sm focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/20'
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
                      className='w-full rounded-xl border border-grayLight px-3 py-2.5 text-sm placeholder:text-grayMuted/60 focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/20'
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
                    className='w-full rounded-xl border border-grayLight px-3 py-2.5 text-sm placeholder:text-grayMuted/60 focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/20'
                    placeholder={t('customUploadNamePlaceholder')}
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
                      <div
                        key={item.id}
                        className='relative aspect-square overflow-hidden rounded-lg bg-grayLight'
                      >
                        <CachedImage
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
              aria-label={t('confirmCloseAria')}
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
              aria-label={t('previewCloseAria')}
            />
            <div className='relative animate-scale-in'>
              <CachedImage
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
              aria-label={t('cameraCloseAria')}
            />
            <div className='relative w-full max-w-xs animate-slide-up overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl'>
              <div className='px-5 pb-3 pt-5'>
                <h3 className='text-center text-base font-semibold text-charcoal'>
                  {t('cameraSelectTitle')}
                </h3>
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
                    <p className='text-sm font-medium text-charcoal'>{t('cameraFront')}</p>
                    <p className='text-xs text-grayMuted'>{t('cameraFrontDesc')}</p>
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
            className='fixed left-0 right-0 top-0 z-[100] bg-error px-4 py-2 text-center text-sm font-medium text-white transition-all duration-300'
            role='alert'
          >
            {t('networkOffline')}
          </div>
        )}

        <div
          id='notification-container'
          className='fixed right-6 top-24 z-[80] space-y-3'
          aria-live='polite'
          aria-relevant='additions'
        />
      </div>
    </>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  )
}
