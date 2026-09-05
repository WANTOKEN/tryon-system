import { useState, useCallback, useMemo, useEffect, useLayoutEffect, useRef } from 'react'

import PropTypes from 'prop-types'

import { useI18n } from '../hooks/useI18n'

import { Sidebar, MainStage } from './layout'
import { ModelSelectModal, ConsentModal, HistoryModal } from './modals'
import ClothingLibraryModal from './ClothingLibraryModal'
import AvatarSourceModal from './modals/AvatarSourceModal'
import { Icon } from './ui'

export default function MainLayout({
  avatarPreview = null,
  onAvatarChange,
  onSetAvatarPreview,
  onModelSelect,
  selected,
  onToggleSelect,
  selectedClothing,
  onRemoveSelected,
  onRemoveWardrobeItem,
  onAddWardrobeItem,
  history = [],
  status = 'idle',
  resultUrl = null,
  recordId = null,
  errorMessage = null,
  clearResult,
  onTryOn,
  canTryOn,
  onOpenPreviewModal,
  onToggleHistorySaved,
  onClearHistory,
  onDeleteHistory,
  onClearSelection,
  hasResult,
  customClothing = [],
  wardrobeClothing = [],
  clothing = [],
  categories = [],
  showToast = null,
  remainingTime = 0,
  progress = 0,
  modelPhotos = [],
  modelPhotosLoading = false,
  requireConsent = true,
  showHistoryModal,
  onCloseHistoryModal,
  historyLoading = false,
  historyError = null,
  onRetryHistory = null,
  sessionCustomer,
  onCustomUploadFile,
  onEndSession,
  onDeleteAvatar,
  // 由 App 的预览弹窗搭配区触发：请求打开服装库并预筛到对应类别做替换
  replaceRequest = null,
  onReplaceRequestConsumed,
}) {
  const { t } = useI18n()

  // 模态框状态
  const [showModelModal, setShowModelModal] = useState(false)
  const [showClothingLibrary, setShowClothingLibrary] = useState(false)
  const [showConsentModal, setShowConsentModal] = useState(false)
  // 小屏"我的形象"：用悬浮按钮打开居中模态（复用形象来源弹窗）
  const [showAvatarModal, setShowAvatarModal] = useState(false)
  // 替换服装时，打开服装库并预筛到对应类别
  const [libraryInitialCategory, setLibraryInitialCategory] = useState('all')
  const [libraryReplaceMode, setLibraryReplaceMode] = useState(false)

  // 打开服装库的统一入口：始终显式设置类别与替换模式，避免残留上次的筛选/模式
  const openClothingLibrary = useCallback((category = 'all', replace = false) => {
    setLibraryInitialCategory(category || 'all')
    setLibraryReplaceMode(replace)
    setShowClothingLibrary(true)
  }, [])

  // App 预览弹窗搭配区的"替换"按钮通过 replaceRequest 触发：打开服装库预筛类别
  useEffect(() => {
    if (replaceRequest) {
      openClothingLibrary(replaceRequest.category || 'all', true)
      // 消费后通知 App 清空，避免同一引用重复点击不触发
      if (typeof onReplaceRequestConsumed === 'function') {
        onReplaceRequestConsumed()
      }
    }
  }, [replaceRequest, onReplaceRequestConsumed, openClothingLibrary])

  // 本地状态
  const [historyFilter, setHistoryFilter] = useState('all')
  const [tempSelectedModel, setTempSelectedModel] = useState(null)
  const [userConsent, setUserConsent] = useState(false)

  // 计算属性
  const hasImage = !!avatarPreview
  const hasClothing = selected.length > 0
  const isGenerating = status === 'pending' || status === 'processing'

  // 当前结果是否已被收藏（收藏按钮态）
  const isResultSaved = useMemo(() => {
    if (!recordId) {
      return false
    }
    const record = (history || []).find(r => r.id === recordId)
    return !!(record?.is_saved || record?.saved)
  }, [history, recordId])

  // 「重新生成」：先清掉当前结果再重新发起，避免旧结果残留造成死胡同
  const handleRegenerate = useCallback(() => {
    clearResult?.()
    onTryOn?.()
  }, [clearResult, onTryOn])

  // 试穿按钮文字
  const tryOnBtnText = useMemo(() => {
    if (isGenerating) {
      return t('regenerating')
    }
    if (hasResult) {
      return t('regenerate')
    }
    return t('startTryOn')
  }, [isGenerating, hasResult, t])

  // 时间格式化
  const formatTime = useCallback(
    date => {
      const now = new Date()
      const diff = now - new Date(date)
      if (diff < 60000) {
        return t('justNow')
      }
      if (diff < 3600000) {
        return t('minutesAgo', { n: Math.floor(diff / 60000) })
      }
      if (diff < 86400000) {
        return t('hoursAgo', { n: Math.floor(diff / 3600000) })
      }
      const d = new Date(date)
      return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    },
    [t]
  )

  // 模特选择确认
  const handleModelConfirm = useCallback(() => {
    // 后端按 FileRecord.uuid 精确匹配模特图；没有 image_key 的素材不可用，
    // 此前拼 `model:${id}` 兜底必然查不到，改为直接禁止选择。
    if (!tempSelectedModel?.image_key) {
      return
    }
    onSetAvatarPreview?.(tempSelectedModel.image_url)
    onModelSelect?.(tempSelectedModel.image_url, tempSelectedModel.image_key, 'system')
    setShowModelModal(false)
  }, [tempSelectedModel, onSetAvatarPreview, onModelSelect])

  // 替换服装：打开服装库（替换模式）并预筛到该服装的类别
  const handleReplaceClothing = useCallback(
    item => {
      openClothingLibrary(item?.category || 'all', true)
    },
    [openClothingLibrary]
  )

  // onTryOn 最新引用：selected 变化后 App 会重建 handleTryOn，
  // 但本回调闭包捕获的是旧引用，必须用 ref 取最新值，否则重算提交的是替换前的旧服装列表。
  // 用 useLayoutEffect 而非 useEffect：它在 commit 阶段同步执行，必定早于下面的
  // setTimeout 宏任务；useEffect 是 passive effect，执行时机晚于绘制，与宏任务顺序不确定。
  const onTryOnRef = useRef(onTryOn)
  useLayoutEffect(() => {
    onTryOnRef.current = onTryOn
  }, [onTryOn])

  // 在服装库中选好替换单品：同类替换进已选列表，并立即重新生成试穿图
  const handleReplaceConfirm = useCallback(
    item => {
      setShowClothingLibrary(false)
      setLibraryReplaceMode(false)
      // 替换成"当前已选的同一件"时直接结束：onToggleSelect 对已选项是「取消选择」语义，
      // 继续调用会把这件移出已选并触发一次无意义（甚至无服装）的重算。
      const keyOf = i => i?.id ?? i?.image_key ?? i?.key
      if ((selected || []).some(s => keyOf(s) === keyOf(item))) {
        return
      }
      // onToggleSelect 内部按 category 自动替换同类旧项
      onToggleSelect?.(item)
      // 等 selected 更新提交后再重算，且通过 ref 调用最新的 onTryOn
      setTimeout(() => {
        if (typeof onTryOnRef.current === 'function') {
          onTryOnRef.current()
        }
      }, 0)
    },
    [onToggleSelect, selected]
  )

  return (
    <div className='app-layout'>
      {/* 左侧栏 */}
      <Sidebar
        avatarPreview={avatarPreview}
        onAvatarChange={onAvatarChange}
        onSetAvatarPreview={onSetAvatarPreview}
        onOpenPreviewModal={onOpenPreviewModal}
        onShowModelModal={() => {
          setTempSelectedModel(null)
          setShowModelModal(true)
        }}
        userConsent={userConsent}
        onConsentChange={setUserConsent}
        onShowDisclaimer={() => setShowConsentModal(true)}
        requireConsent={requireConsent}
        hasImage={hasImage}
        hasClothing={hasClothing}
        onOpenClothingLibrary={() => openClothingLibrary('all', false)}
        selected={selected}
        customClothing={customClothing}
        wardrobeClothing={wardrobeClothing}
        onRemoveSelected={onRemoveSelected}
        onClearSelection={onClearSelection}
        onReplaceClothing={handleReplaceClothing}
        sessionId={sessionCustomer}
        t={t}
        showToast={showToast}
      />

      {/* 中央主舞台 */}
      <MainStage
        hasImage={hasImage}
        hasClothing={hasClothing}
        resultUrl={resultUrl}
        recordId={recordId}
        errorMessage={errorMessage}
        isResultSaved={isResultSaved}
        avatarPreview={avatarPreview}
        selectedClothing={selectedClothing}
        onOpenPreviewModal={onOpenPreviewModal}
        onClearSelection={onClearSelection}
        onToggleHistorySaved={onToggleHistorySaved}
        onRegenerate={handleRegenerate}
        onOpenModelModal={() => setShowModelModal(true)}
        onOpenClothingLibrary={category => openClothingLibrary(category, false)}
        onAvatarChange={onAvatarChange}
        onSetAvatarPreview={onSetAvatarPreview}
        sessionId={sessionCustomer}
        showToast={showToast}
        userConsent={userConsent}
        onConsentChange={setUserConsent}
        onShowDisclaimer={() => setShowConsentModal(true)}
        onTryOn={onTryOn}
        canTryOn={canTryOn}
        isGenerating={isGenerating}
        tryOnBtnText={tryOnBtnText}
        progress={progress}
        remainingTime={remainingTime}
        onEndSession={onEndSession}
        onReplaceClothing={handleReplaceClothing}
        onRemoveSelected={onRemoveSelected}
        t={t}
      />

      {/* 服装库模态框 */}
      <ClothingLibraryModal
        isOpen={showClothingLibrary}
        onClose={() => {
          setShowClothingLibrary(false)
          setLibraryReplaceMode(false)
        }}
        initialCategory={libraryInitialCategory}
        replaceMode={libraryReplaceMode}
        onReplaceConfirm={handleReplaceConfirm}
        clothing={clothing}
        customClothing={customClothing}
        wardrobeClothing={wardrobeClothing}
        selected={selected}
        onToggleSelect={onToggleSelect}
        onRemoveSelected={onRemoveSelected}
        onRemoveWardrobeItem={onRemoveWardrobeItem}
        onAddWardrobeItem={onAddWardrobeItem}
        categories={categories}
        t={t}
        sessionId={sessionCustomer}
        onCustomUploadFile={onCustomUploadFile}
      />

      {/* 模特选择模态框 */}
      <ModelSelectModal
        isOpen={showModelModal}
        onClose={() => setShowModelModal(false)}
        modelPhotos={modelPhotos}
        modelPhotosLoading={modelPhotosLoading}
        tempSelectedModel={tempSelectedModel}
        onSelectModel={setTempSelectedModel}
        onConfirm={handleModelConfirm}
        t={t}
      />

      {/* 免责声明模态框 */}
      <ConsentModal
        isOpen={showConsentModal}
        onClose={() => setShowConsentModal(false)}
        onAgree={() => setUserConsent(true)}
        t={t}
      />

      {/* 试穿记录模态框 */}
      <HistoryModal
        isOpen={showHistoryModal}
        onClose={onCloseHistoryModal}
        history={history}
        historyFilter={historyFilter}
        onFilterChange={setHistoryFilter}
        onClearHistory={onClearHistory}
        onToggleSaved={onToggleHistorySaved}
        onDelete={onDeleteHistory}
        onPreview={onOpenPreviewModal}
        onRetry={onRetryHistory}
        loading={historyLoading}
        historyError={historyError}
        formatTime={formatTime}
        t={t}
      />

      {/* 小屏"我的形象"居中模态：悬浮按钮打开，复用形象来源弹窗 */}
      <AvatarSourceModal
        isOpen={showAvatarModal}
        onClose={() => setShowAvatarModal(false)}
        avatarPreview={avatarPreview}
        onAvatarChange={e => {
          onAvatarChange(e)
          if (e?.target?.files) {
            setShowAvatarModal(false)
          }
        }}
        onAvatarDelete={onDeleteAvatar}
        onOpenPreviewModal={onOpenPreviewModal}
        onShowModelModal={() => {
          setShowAvatarModal(false)
          setShowModelModal(true)
        }}
        onSetAvatarPreview={onSetAvatarPreview}
        sessionId={sessionCustomer}
        showToast={showToast}
        t={t}
      />

      {/* 小屏悬浮按钮：我的形象 / 服装库 */}
      <div className='mobile-fab-group'>
        <button
          type='button'
          className='mobile-fab'
          onClick={() => setShowAvatarModal(true)}
          aria-label={t('myAvatar') || '我的形象'}
        >
          <Icon name='user' className='h-5 w-5' />
          <span>{t('myAvatar') || '我的形象'}</span>
        </button>
        <button
          type='button'
          className='mobile-fab'
          onClick={() => openClothingLibrary('all', false)}
          aria-label={t('openClothingLibrary') || '服装库'}
        >
          <Icon name='wardrobe' className='h-5 w-5' />
          <span>{t('clothingLibrary') || '服装库'}</span>
        </button>
      </div>
    </div>
  )
}

MainLayout.propTypes = {
  avatarPreview: PropTypes.string,
  onAvatarChange: PropTypes.func.isRequired,
  onSetAvatarPreview: PropTypes.func.isRequired,
  onModelSelect: PropTypes.func.isRequired,
  selected: PropTypes.arrayOf(PropTypes.object).isRequired,
  onToggleSelect: PropTypes.func.isRequired,
  selectedClothing: PropTypes.arrayOf(PropTypes.object).isRequired,
  onRemoveSelected: PropTypes.func.isRequired,
  history: PropTypes.arrayOf(PropTypes.object),
  status: PropTypes.string,
  resultUrl: PropTypes.string,
  recordId: PropTypes.string,
  errorMessage: PropTypes.string,
  clearResult: PropTypes.func,
  onTryOn: PropTypes.func.isRequired,
  canTryOn: PropTypes.bool.isRequired,
  onOpenPreviewModal: PropTypes.func.isRequired,
  onToggleHistorySaved: PropTypes.func.isRequired,
  onClearHistory: PropTypes.func.isRequired,
  onDeleteHistory: PropTypes.func.isRequired,
  onClearSelection: PropTypes.func.isRequired,
  hasResult: PropTypes.bool.isRequired,
  customClothing: PropTypes.arrayOf(PropTypes.object),
  wardrobeClothing: PropTypes.arrayOf(PropTypes.object),
  clothing: PropTypes.arrayOf(PropTypes.object),
  categories: PropTypes.arrayOf(PropTypes.object),
  showToast: PropTypes.func,
  remainingTime: PropTypes.number,
  progress: PropTypes.number,
  modelPhotos: PropTypes.arrayOf(PropTypes.object),
  modelPhotosLoading: PropTypes.bool,
  requireConsent: PropTypes.bool,
  showHistoryModal: PropTypes.bool.isRequired,
  onCloseHistoryModal: PropTypes.func.isRequired,
  historyLoading: PropTypes.bool,
  historyError: PropTypes.string,
  onRetryHistory: PropTypes.func,
  onEndSession: PropTypes.func,
  onDeleteAvatar: PropTypes.func,
}
