import PropTypes from 'prop-types'

import { AvatarSection, SelectedClothingSection } from '../sections'
import { Icon } from '../ui'

export default function Sidebar({
  // Avatar
  avatarPreview = null,
  onAvatarChange,
  onOpenPreviewModal,
  onShowModelModal,
  onSetAvatarPreview,
  sessionId = null,
  // Clothing library
  onOpenClothingLibrary,
  // Selected clothing
  selected,
  customClothing = [],
  wardrobeClothing = [],
  onRemoveSelected,
  onClearSelection,
  // Common
  t,
  showToast = null,
}) {
  return (
    <aside className='sidebar-left' aria-label='服装选择面板'>
      {/* 形象管理 */}
      <AvatarSection
        avatarPreview={avatarPreview}
        onAvatarChange={onAvatarChange}
        onSetAvatarPreview={onSetAvatarPreview}
        onOpenPreviewModal={onOpenPreviewModal}
        onShowModelModal={onShowModelModal}
        sessionId={sessionId}
        t={t}
        showToast={showToast}
      />

      {/* 打开服装库按钮 - 常驻显示，无需前置检验 */}
      <div className='sidebar-section'>
        <button
          type='button'
          className='btn-simple btn-simple-primary w-full'
          onClick={onOpenClothingLibrary}
        >
          <Icon name='menu' className='h-4 w-4' />
          {t('openClothingLibrary') || '打开服装库'}
        </button>
      </div>

      {/* 已选服装 */}
      <SelectedClothingSection
        selected={selected}
        customClothing={customClothing}
        wardrobeClothing={wardrobeClothing}
        onRemoveSelected={onRemoveSelected}
        onClearSelection={onClearSelection}
        onOpenPreviewModal={onOpenPreviewModal}
        t={t}
      />
    </aside>
  )
}

Sidebar.propTypes = {
  avatarPreview: PropTypes.string,
  onAvatarChange: PropTypes.func.isRequired,
  onOpenPreviewModal: PropTypes.func.isRequired,
  onShowModelModal: PropTypes.func.isRequired,
  onSetAvatarPreview: PropTypes.func,
  sessionId: PropTypes.string,
  onOpenClothingLibrary: PropTypes.func.isRequired,
  selected: PropTypes.arrayOf(PropTypes.object).isRequired,
  customClothing: PropTypes.arrayOf(PropTypes.object),
  wardrobeClothing: PropTypes.arrayOf(PropTypes.object),
  onRemoveSelected: PropTypes.func.isRequired,
  onClearSelection: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
  showToast: PropTypes.func,
}
