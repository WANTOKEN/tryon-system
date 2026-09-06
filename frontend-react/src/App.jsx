import { useState, useCallback, useEffect, useRef } from 'react'

import { I18nProvider, useI18n } from './hooks/useI18n'
import { useTryOn } from './hooks/useTryOn'
import { useClothing } from './hooks/useClothing'
import { useNetworkStatus } from './hooks/useNetworkStatus'
import useColorTags from './hooks/useColorTags'
import { api, TokenManager, setGlobalErrorHandler } from './utils/request'
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
import { useToast } from './hooks/useToast'
import { useModalManager } from './hooks/useModalManager'
import { useAppSession } from './hooks/useAppSession'
import { useAvatar } from './hooks/useAvatar'
import { useClothingSelection } from './hooks/useClothingSelection'
import { useClothingUpload } from './hooks/useClothingUpload'
import { useTryOnFlow } from './hooks/useTryOnFlow'
import { STORAGE_KEYS, CURRENT_CACHE_VERSION } from './constants/storageKeys'
import { safeStorage } from './utils/safeStorage'
import AdminContactItem from './components/AdminContactItem'
import ErrorBoundary from './components/ErrorBoundary'

function AppContent() {
  const { t } = useI18n()

  // === 应用全局状态 ===
  const [appLoading, setAppLoading] = useState(true) // 应用初始化加载中
  const { theme, mode, setTheme, toggleMode } = useTheme() // 主题配色系统
  const { toast, showToast, hideToast } = useToast() // 全局 Toast 提示
  // 颜色标签唯一数据源：后端 /api/v1/common/colors/
  const colorTags = useColorTags()

  // === 试穿核心状态 ===
  const {
    avatarFile,
    setAvatarFile,
    avatarPreview,
    avatarSource,
    handleAvatarChange,
    deleteAvatar,
    setAvatarPreviewWithPersist,
    selectModelAvatar,
    loadAvatarFromCache,
    resetAvatar,
  } = useAvatar({ showToast, t })
  const [_showUploadModal] = useState(false)
  const [hasResult, setHasResult] = useState(false) // 是否有试穿结果

  // === 服装选择状态 ===
  const {
    selected,
    customClothing,
    setCustomClothing,
    wardrobeClothing,
    setWardrobeClothing,
    handleToggle,
    handleRemoveSelected,
    handleAddWardrobeItem,
    handleRemoveWardrobeItem,
    setWardrobeClothingWithPersist,
    updateWardrobeClothing,
    removeWardrobeClothing,
    removeWardrobeByTempId,
    updateCustomClothing,
    removeCustomClothing,
    removeCustomClothingByTempId,
    deleteCustomClothing,
    deleteWardrobeClothing,
    clearAllClothing,
    loadFromCache,
  } = useClothingSelection({ showToast, t })

  // === 弹窗管理（集中化，避免散落大量 showXxxModal state） ===
  const {
    showLoginModal,
    setShowLoginModal,
    showSettingsModal,
    setShowSettingsModal,
    showStoreModal,
    setShowStoreModal,
    showWardrobeModal,
    setShowWardrobeModal,
    showCustomUploadModal,
    setShowCustomUploadModal,
    showConfirmModal,
    setShowConfirmModal,
    confirmConfig,
    showPreviewModal,
    previewModalData,
    replaceRequest,
    setReplaceRequest,
    showCameraModal,
    cameraCallback,
    showAdminContactModal,
    setShowAdminContactModal,
    showHistoryModal,
    setShowHistoryModal,
    wardrobeUploadCategory,
    setWardrobeUploadCategory,
    wardrobeUploadName,
    setWardrobeUploadName,
    wardrobeUploadColor,
    setWardrobeUploadColor,
    customUploadCategory,
    setCustomUploadCategory,
    customUploadName,
    setCustomUploadName,
    customUploadColor,
    setCustomUploadColor,
    showConfirmDialog,
    handleConfirmAction,
    openPreviewModal,
    closePreviewModal,
    openCameraModal,
    closeCameraModal,
    openCustomUploadModal,
  } = useModalManager()

  // === 会话与用户状态（集中管理：认证/配额/管理员/会话） ===
  // 使用 ref 打破循环依赖：useAppSession 需要 onShowAdminContact，
  // 而 handleShowAdminContact 又依赖 useAppSession 返回的 adminContactInfo/fetchAdminContact
  const adminContactCallbackRef = useRef(null)
  const tryOnAdminRef = useRef(null)
  const {
    isLoggedIn,
    setIsLoggedIn,
    userInfo,
    setUserInfo,
    loginLoading,
    quota,
    setQuota,
    adminContactInfo,
    adminContactLoading,
    fetchAdminContact,
    sessionCustomer,
    setSessionCustomer,
    refreshUserInfo,
    handleLogout: handleSessionLogout,
    handleLoginSubmit,
    handleSmsLogin,
    handleSendSms,
    handleRegister,
    maskPhone,
    maskWechat,
    maskEmail,
  } = useAppSession({
    t,
    showToast,
    onShowAdminContact: () => adminContactCallbackRef.current?.(),
  })

  // 注意：以下两个上传 hook 依赖 isLoggedIn / setShowLoginModal，
  // 必须放在 useAppSession、useModalManager 之后声明——否则读取的是 const 的 TDZ，
  // 首次渲染即抛 ReferenceError（白屏）。
  // === 自定义服装上传 ===
  const { uploadClothing: uploadCustomClothing } = useClothingUpload({
    showToast,
    t,
    isLoggedIn,
    onRequireLogin: () => setShowLoginModal(true),
    onAddPlaceholder: item => setCustomClothing(prev => [...prev, item]),
    onUpdateItem: updateCustomClothing,
    onRemoveByTempId: removeCustomClothingByTempId,
    type: 'custom',
  })

  // === 衣橱服装上传 ===
  const { uploadClothing: uploadWardrobeClothing } = useClothingUpload({
    showToast,
    t,
    isLoggedIn,
    onRequireLogin: () => setShowLoginModal(true),
    onAddPlaceholder: item => setWardrobeClothing(prev => [...prev, item]),
    onUpdateItem: updateWardrobeClothing,
    onRemoveByTempId: removeWardrobeByTempId,
    type: 'wardrobe',
  })

  // 防止 StrictMode 下重复初始化
  const initRef = useRef(false)

  /** 显示管理员联系弹窗（懒加载联系信息） — 胶水：数据来自 useAppSession，弹窗来自 useModalManager */
  const handleShowAdminContact = useCallback(async () => {
    if (!adminContactInfo) {
      await fetchAdminContact()
    }
    setShowAdminContactModal(true)
  }, [adminContactInfo, fetchAdminContact, setShowAdminContactModal])

  // 将 handleShowAdminContact 绑定到 ref，供 useAppSession 内的登录方法调用
  adminContactCallbackRef.current = handleShowAdminContact
  // 同时绑定到 tryOnAdminRef，供 useTryOnFlow 内的配额检查调用
  tryOnAdminRef.current = handleShowAdminContact

  // 登录成功后自动关闭登录弹窗
  useEffect(() => {
    if (isLoggedIn && showLoginModal) {
      setShowLoginModal(false)
    }
  }, [isLoggedIn, showLoginModal, setShowLoginModal])

  // 全局请求错误兜底提示：任何未被调用方自行处理的失败都会弹出 Toast，
  // 避免「后端报错但界面毫无反馈」。已自行提示的地方用 api.markHandled 标记去重。
  useEffect(() => {
    setGlobalErrorHandler((message, status) => {
      if (status === 401) {
        // 401 由认证流程统一处理（清 token + 登出），此处不再重复打扰
        return
      }
      showToast(message || t('n_tryOnFail') || '请求失败，请稍后重试', 'error')
    })
    return () => setGlobalErrorHandler(null)
  }, [showToast, t])

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
    loading: historyLoading,
    historyError,
    recordId,
    errorMessage,
    submitTask,
    fetchHistory,
    fetchModelPhotos,
    clearResult,
    clearError,
    clearHistory,
    startGenerating,
    cancelGenerating,
    saveHistoryRecord,
    deleteHistoryRecord,
    clearHistoryRecords,
  } = useTryOn({
    sessionId: sessionCustomer,
    onComplete: handleTryOnComplete,
    onError: handleTryOnError,
    t,
  })

  // === 试穿提交流程 ===
  const { handleTryOn } = useTryOnFlow({
    isLoggedIn,
    showToast,
    t,
    onRequireLogin: () => setShowLoginModal(true),
    onShowAdminContact: () => tryOnAdminRef.current?.(),
    avatarPreview,
    avatarFile,
    avatarSource,
    setAvatarFile,
    selected,
    quota,
    setQuota,
    startGenerating,
    cancelGenerating,
    submitTask,
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

        await loadAvatarFromCache()

        // 加载服装缓存（已登录时加载自定义和衣橱）
        await loadFromCache({ includeCustomAndWardrobe: isAuthenticated })

        // 获取模特照片（公开素材，登录与否均加载，供「使用模特」选用）
        await fetchModelPhotos()

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
    // loadAvatarFromCache / loadFromCache / setIsLoggedIn / setUserInfo 引用恒定
    // （useState setter 或依赖为 [] 的 useCallback），加入不会导致重复初始化
  }, [t, fetchModelPhotos, loadAvatarFromCache, loadFromCache, setIsLoggedIn, setUserInfo])

  useEffect(() => {
    if (isLoggedIn) {
      fetchHistory()
      fetchClothing().then(items => {
        if (items.length > 0) {
          setWardrobeClothingWithPersist(items)
        }
      })
      fetchCategories()
    }
  }, [isLoggedIn, fetchHistory, fetchClothing, fetchCategories, setWardrobeClothingWithPersist])

  /** 登出：清除所有认证状态和本地缓存 */
  const handleLogout = useCallback(() => {
    showConfirmDialog(t('logoutTitle'), t('logoutMsg'), () => {
      handleSessionLogout()

      clearAllClothing()
      resetAvatar()
      setHasResult(false)
      clearResult()
      clearHistory()

      safeStorage.removeItem(STORAGE_KEYS.SESSION_CUSTOMER)
    })
  }, [
    showConfirmDialog,
    handleSessionLogout,
    clearAllClothing,
    resetAvatar,
    clearResult,
    clearHistory,
    t,
  ])

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

      clearAllClothing()
      resetAvatar()
      setHasResult(false)
      clearResult()
      // 历史记录已在服务端清空，同步清掉本地列表，避免继续展示已删除的记录
      clearHistory()

      const now = new Date()
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
      const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '')
      const newCustomer = `Customer_${dateStr}_${timeStr}`
      safeStorage.setItem(STORAGE_KEYS.SESSION_CUSTOMER, newCustomer)
      setSessionCustomer(newCustomer)
      showToast(t('n_sessionEnded'), 'info')
    })
  }, [
    isLoggedIn,
    showConfirmDialog,
    showToast,
    clearAllClothing,
    resetAvatar,
    clearResult,
    clearHistory,
    sessionCustomer,
    setSessionCustomer,
    setShowLoginModal,
    t,
  ])

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
      const success = await clearHistoryRecords(sessionCustomer)
      showToast(success ? t('n_cleared') : t('n_clearFail'), success ? 'info' : 'error')
    })
  }, [
    isLoggedIn,
    tryOnHistory,
    showConfirmDialog,
    showToast,
    clearHistoryRecords,
    sessionCustomer,
    setShowLoginModal,
    t,
  ])

  const handleClearSelection = useCallback(() => {
    clearAllClothing()
    resetAvatar()
    setHasResult(false)
    clearResult()
    // clearResult 会保留失败文案（供结果页重试），回到初始态需显式清掉
    clearError()
  }, [clearAllClothing, resetAvatar, clearResult, clearError])

  const handleToggleHistorySaved = useCallback(
    async (uuid, newSavedState) => {
      if (!isLoggedIn) {
        showToast(t('n_needLogin'), 'warning')
        setShowLoginModal(true)
        return
      }
      const success = await saveHistoryRecord(uuid, newSavedState)
      if (success) {
        showToast(newSavedState ? t('n_saved') : t('n_unsaved'), 'success')
      } else {
        showToast(t('n_saveFail'), 'error')
      }
    },
    [isLoggedIn, showToast, t, saveHistoryRecord, setShowLoginModal]
  )

  const handleDeleteHistory = useCallback(
    async uuid => {
      if (!isLoggedIn) {
        showToast(t('n_needLogin'), 'warning')
        setShowLoginModal(true)
        return
      }
      const success = await deleteHistoryRecord(uuid)
      showToast(success ? t('n_deleted') : t('n_deleteFail'), success ? 'info' : 'error')
    },
    [isLoggedIn, showToast, t, deleteHistoryRecord, setShowLoginModal]
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
    setShowConfirmModal,
    setShowLoginModal,
    setShowSettingsModal,
    setShowStoreModal,
    setShowWardrobeModal,
    closeCameraModal,
  ])

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

  const handleCustomUpload = useCallback(
    async (file, category = 'tops', name = '', color = '黑色') => {
      await uploadCustomClothing(file, category, name, color)
    },
    [uploadCustomClothing]
  )

  const _handleUpdateWardrobeCategory = useCallback(
    category => {
      setWardrobeUploadCategory(category)
    },
    [setWardrobeUploadCategory]
  )

  // 服装库「自定义上传」入口回调：把选中的图按当前分类/颜色作为自定义服装上传
  const handleCustomUploadFile = useCallback(
    async (file, category = 'tops', color = '黑色') => {
      await handleCustomUpload(file, category, '', color)
    },
    [handleCustomUpload]
  )

  const handleWardrobeUpload = useCallback(
    async (file, category = 'tops', name = '', color = wardrobeUploadColor) => {
      await uploadWardrobeClothing(file, category, name, color)
    },
    [uploadWardrobeClothing, wardrobeUploadColor]
  )

  const handleRemoveCustomClothing = useCallback(
    async id => {
      if (!isLoggedIn) {
        showToast(t('n_needLogin'), 'warning')
        setShowLoginModal(true)
        return
      }
      await deleteCustomClothing(id)
      showToast(t('n_customRemoved'), 'info')
    },
    [isLoggedIn, showToast, deleteCustomClothing, t, setShowLoginModal]
  )

  const _handleRemoveWardrobeItem = useCallback(
    async id => {
      if (!isLoggedIn) {
        showToast(t('n_needLogin'), 'warning')
        setShowLoginModal(true)
        return
      }
      await deleteWardrobeClothing(id)
      showToast(t('n_wardrobeRemoved'), 'info')
    },
    [isLoggedIn, showToast, deleteWardrobeClothing, t, setShowLoginModal]
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
            onSetAvatarPreview={(preview, imageKey) =>
              setAvatarPreviewWithPersist(preview, imageKey, 'user')
            }
            onModelSelect={selectModelAvatar}
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
            recordId={recordId}
            errorMessage={errorMessage}
            clearResult={clearResult}
            onTryOn={handleTryOn}
            canTryOn={!!avatarPreview && selected.length > 0 && quota.remaining > 0}
            onOpenWardrobeUpload={() => setShowWardrobeModal(true)}
            onOpenCustomUploadModal={openCustomUploadModal}
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
            replaceRequest={replaceRequest}
            onReplaceRequestConsumed={() => setReplaceRequest(null)}
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
            historyLoading={historyLoading}
            historyError={historyError}
            onRetryHistory={fetchHistory}
            sessionCustomer={sessionCustomer}
            onCustomUploadFile={handleCustomUploadFile}
          />
          {toast && (
            <Toast
              // key 保证连续弹出同类提示时组件重挂载，进度条与倒计时重新开始
              key={`${toast.type}-${toast.message}-${toast.key ?? ''}`}
              message={toast.message}
              type={toast.type}
              duration={3000}
              onClose={hideToast}
            />
          )}

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
                    className='mt-5 w-full rounded-xl bg-[var(--text-primary)] py-3 text-sm font-semibold text-[var(--bg-secondary)] transition-opacity hover:opacity-90'
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
                <div className='bg-[#1a1a1a] px-6 py-5 text-center'>
                  <div className='mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#8a7a5c]/40 bg-[#8a7a5c]/10'>
                    <svg
                      className='h-7 w-7 text-[#8a7a5c]'
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
                  <p className='mt-1 text-xs text-white/50'>
                    {isLoggedIn
                      ? userInfo?.username || t('settingsMerchantAccount')
                      : t('storePleaseLogin')}
                  </p>
                </div>
                <div className='space-y-4 px-6 py-4'>
                  {isLoggedIn ? (
                    <>
                      <div className='rounded-xl bg-[var(--bg-tertiary)] p-4'>
                        <div className='mb-2 flex items-center justify-between'>
                          <span className='text-sm font-medium text-[var(--text-primary)]'>
                            {t('storeQuota')}
                          </span>
                          <span className='text-sm text-[var(--text-muted)]'>
                            {quota.used} / {quota.total} {t('historyUnit')}
                          </span>
                        </div>
                        <div className='h-2.5 overflow-hidden rounded-full bg-[var(--bg-tertiary)]'>
                          <div
                            className='h-full rounded-full bg-[#8a7a5c] transition-all duration-300'
                            style={{
                              width: `${quota.total > 0 ? Math.min((quota.used / quota.total) * 100, 100) : 0}%`,
                            }}
                          />
                        </div>
                        <div className='mt-2 flex items-center justify-between'>
                          <span className='text-xs text-[var(--text-muted)]'>
                            {t('storeQuotaUsed', { n: quota.used })}
                          </span>
                          <span className='text-xs font-medium text-[#8a7a5c]'>
                            {t('storeQuotaRemaining', { n: quota.remaining })}
                          </span>
                        </div>
                      </div>
                      <div className='flex items-center justify-between py-2'>
                        <span className='text-sm text-[var(--text-muted)]'>
                          {t('storeAccountStatus')}
                        </span>
                        <span className='text-sm font-medium text-[#8a7a5c]'>
                          {t('settingsLoggedIn')}
                        </span>
                      </div>
                      <div className='flex items-center justify-between py-2'>
                        <span className='text-sm text-[var(--text-muted)]'>
                          {t('storeWardrobeItems')}
                        </span>
                        <span className='text-sm font-medium text-[var(--text-primary)]'>
                          {t('storeItemsCount', { n: clothing?.length || 0 })}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className='flex items-center justify-between py-2'>
                        <span className='text-sm text-[var(--text-muted)]'>账号状态</span>
                        <span className='text-sm font-medium text-[var(--error)]'>未登录</span>
                      </div>
                      <div className='py-4 text-center'>
                        <p className='mb-4 text-sm text-[var(--text-muted)]'>
                          {t('storeLoginRequired')}
                        </p>
                        <button
                          type='button'
                          onClick={() => {
                            setShowStoreModal(false)
                            setShowLoginModal(true)
                          }}
                          className='rounded-xl bg-[var(--text-secondary)] px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90'
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
                    className='w-full rounded-xl bg-[var(--text-primary)] py-2.5 text-sm font-medium text-[var(--bg-secondary)] transition-opacity hover:opacity-90'
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
                  </div>
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
                      {colorTags.map(c => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    type='file'
                    accept='image/*'
                    id='wardrobe-file-input'
                    className='hidden'
                    onChange={e => {
                      const file = e.target.files[0]
                      if (file) {
                        handleWardrobeUpload(file, wardrobeUploadCategory, wardrobeUploadName)
                        setWardrobeUploadName('')
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
                              removeWardrobeClothing(item.id)
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
                  </div>
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
                      {colorTags.map(c => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    type='file'
                    accept='image/*'
                    id='custom-file-input-modal'
                    className='hidden'
                    onChange={e => {
                      const file = e.target.files[0]
                      if (file) {
                        handleCustomUpload(
                          file,
                          customUploadCategory,
                          customUploadName,
                          customUploadColor
                        )
                        setCustomUploadName('')
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
                              removeCustomClothing(item.id)
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
                  <div className='bg-error/10 mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full'>
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
              <div className='relative flex animate-scale-in flex-col items-center'>
                <button
                  type='button'
                  onClick={closePreviewModal}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      closePreviewModal()
                    }
                  }}
                  tabIndex={0}
                  aria-label={t('previewCloseAria')}
                  className='absolute -right-3 -top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#333] shadow-lg transition-colors hover:bg-white'
                >
                  <svg className='h-4 w-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M6 18L18 6M6 6l12 12'
                    />
                  </svg>
                </button>
                <div className='rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3 shadow-2xl'>
                  <CachedImage
                    src={previewModalData.src}
                    alt={previewModalData.name}
                    className='max-h-[68vh] min-h-[280px] w-auto min-w-[280px] max-w-[480px] rounded-xl object-contain'
                    lazy={false}
                  />
                  <p className='mt-2 text-center text-xs font-medium text-[var(--text-secondary)]'>
                    {previewModalData.name}
                  </p>
                  {/* 底部操作按钮：与「我的形象」卡操作按钮同款，常驻显示 */}
                  {previewModalData.actions?.length > 0 && (
                    <div className='preview-modal-actions'>
                      {previewModalData.actions.map(action => (
                        <button
                          key={action.key}
                          type='button'
                          className='avatar-action-simple'
                          onClick={() => {
                            action.onClick?.()
                            // 关闭弹窗，避免操作后弹窗遮挡结果
                            closePreviewModal()
                          }}
                          title={action.title}
                          aria-label={action.title}
                        >
                          <svg
                            className='h-4 w-4'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                          >
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth='2'
                              d={action.path}
                            />
                          </svg>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* 搭配展示区：直接显示该结果使用的服装 */}
                {previewModalData.clothing?.length > 0 && (
                  <div className='mt-3 w-full max-w-[480px]'>
                    <p className='mb-2 text-center text-[11px] font-medium uppercase tracking-wider text-white/60'>
                      {t('outfitTitle') || '本套搭配'}
                    </p>
                    <div className='flex flex-wrap justify-center gap-3'>
                      {previewModalData.clothing.map((item, idx) => (
                        <div
                          key={item.id || idx}
                          className='group flex w-20 flex-col items-center gap-1'
                        >
                          <div className='relative h-20 w-20 overflow-hidden rounded-lg bg-white/10'>
                            {item.thumb_url || item.image_url ? (
                              <img
                                src={item.thumb_url || item.image_url}
                                alt={item.name}
                                className='h-full w-full object-cover'
                              />
                            ) : (
                              <div className='flex h-full w-full items-center justify-center text-white/40'>
                                <svg
                                  className='h-6 w-6'
                                  fill='none'
                                  stroke='currentColor'
                                  viewBox='0 0 24 24'
                                >
                                  <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth='1.5'
                                    d='M12 4v16m8-8H4'
                                  />
                                </svg>
                              </div>
                            )}
                            {/* 替换按钮：常驻显示，打开服装库并预筛到该服装类别 */}
                            <button
                              type='button'
                              onClick={() => {
                                // 必须先关闭预览弹窗：它的层级(z-modal-2)高于服装库(z-modal-1)，
                                // 不关会导致服装库被完全遮挡、看起来"点了没反应"
                                closePreviewModal()
                                setReplaceRequest(item)
                              }}
                              title={t('replaceClothing') || '替换'}
                              aria-label={t('replaceClothing') || '替换'}
                              className='absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-[#333] shadow transition-colors hover:bg-white'
                            >
                              <svg
                                className='h-3.5 w-3.5'
                                fill='none'
                                stroke='currentColor'
                                viewBox='0 0 24 24'
                              >
                                <path
                                  strokeLinecap='round'
                                  strokeLinejoin='round'
                                  strokeWidth='2'
                                  d='M4 4v6h6M20 20v-6h-6'
                                />
                                <path
                                  strokeLinecap='round'
                                  strokeLinejoin='round'
                                  strokeWidth='2'
                                  d='M20 10a8 8 0 00-15.5-2M4 14a8 8 0 0015.5 2'
                                />
                              </svg>
                            </button>
                          </div>
                          <span className='line-clamp-1 w-full text-center text-[10px] text-white/80'>
                            {item.name || t('unnamed') || '未命名'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
