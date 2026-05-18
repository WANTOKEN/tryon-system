import { useState, useCallback, useMemo } from 'react'

import PropTypes from 'prop-types'

import { useI18n } from '../hooks/useI18n'

import { Sidebar, MainStage } from './layout'
import { ModelSelectModal, ConsentModal, HistoryModal } from './modals'
import ClothingLibraryModal from './ClothingLibraryModal'

export default function MainLayout({
  avatarPreview = null,
  onAvatarChange,
  onSetAvatarPreview,
  onModelSelect,
  selected,
  onToggleSelect,
  selectedClothing,
  onRemoveSelected,
  history = [],
  status = 'idle',
  resultUrl = null,
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
}) {
  const { t } = useI18n()

  // 模态框状态
  const [showModelModal, setShowModelModal] = useState(false)
  const [showClothingLibrary, setShowClothingLibrary] = useState(false)
  const [showConsentModal, setShowConsentModal] = useState(false)

  // 本地状态
  const [historyFilter, setHistoryFilter] = useState('all')
  const [tempSelectedModel, setTempSelectedModel] = useState(null)
  const [userConsent, setUserConsent] = useState(false)

  // 计算属性
  const hasImage = !!avatarPreview
  const hasClothing = selected.length > 0
  const isGenerating = status === 'pending' || status === 'processing'

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
    if (tempSelectedModel) {
      onSetAvatarPreview?.(tempSelectedModel.image_url)
      const modelKey = tempSelectedModel.image_key || `model:${tempSelectedModel.id}`
      onModelSelect?.(tempSelectedModel.image_url, modelKey, 'system')
      setShowModelModal(false)
    }
  }, [tempSelectedModel, onSetAvatarPreview, onModelSelect])

  return (
    <div className='app-layout'>
      {/* 左侧栏 */}
      <Sidebar
        avatarPreview={avatarPreview}
        onAvatarChange={onAvatarChange}
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
        onOpenClothingLibrary={() => setShowClothingLibrary(true)}
        selected={selected}
        customClothing={customClothing}
        wardrobeClothing={wardrobeClothing}
        onRemoveSelected={onRemoveSelected}
        onClearSelection={onClearSelection}
        t={t}
        showToast={showToast}
      />

      {/* 中央主舞台 */}
      <MainStage
        hasImage={hasImage}
        hasClothing={hasClothing}
        resultUrl={resultUrl}
        selectedClothing={selectedClothing}
        onOpenPreviewModal={onOpenPreviewModal}
        onClearSelection={onClearSelection}
        userConsent={userConsent}
        onConsentChange={setUserConsent}
        onShowDisclaimer={() => setShowConsentModal(true)}
        onTryOn={onTryOn}
        canTryOn={canTryOn}
        isGenerating={isGenerating}
        tryOnBtnText={tryOnBtnText}
        progress={progress}
        remainingTime={remainingTime}
        t={t}
      />

      {/* 服装库模态框 */}
      <ClothingLibraryModal
        isOpen={showClothingLibrary}
        onClose={() => setShowClothingLibrary(false)}
        clothing={clothing}
        customClothing={customClothing}
        wardrobeClothing={wardrobeClothing}
        selected={selected}
        onToggleSelect={onToggleSelect}
        onRemoveSelected={onRemoveSelected}
        categories={categories}
        t={t}
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
        formatTime={formatTime}
        t={t}
      />
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
}
