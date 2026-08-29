import { useRef } from 'react'

import PropTypes from 'prop-types'

import { Icon } from '../ui'
import AvatarSection from '../sections/AvatarSection'

/**
 * 「我的形象」居中模态框。内部直接复用左侧「我的形象」区块（AvatarSection），
 * 因此布局方式与按钮（拍照上传 / 扫码上传 / 使用模特）完全一致，
 * 区别仅在于它以居中弹窗形式展示。
 */
export default function AvatarSourceModal({
  isOpen,
  onClose,
  avatarPreview = null,
  onAvatarChange,
  onOpenPreviewModal,
  onShowModelModal,
  onSetAvatarPreview,
  onAvatarDelete,
  sessionId = null,
  showToast = null,
  t,
}) {
  const closeBtnRef = useRef(null)

  if (!isOpen) {
    return null
  }

  return (
    <div
      className='avatar-modal-backdrop'
      onClick={onClose}
      onKeyDown={e => {
        if (e.key === 'Escape') {
          onClose()
        }
      }}
      role='button'
      tabIndex={-1}
    >
      <div
        className='avatar-source-modal'
        onClick={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
        role='presentation'
        tabIndex={-1}
      >
        <button
          ref={closeBtnRef}
          type='button'
          className='scan-modal-close'
          onClick={onClose}
          aria-label={t('close') || '关闭'}
        >
          <Icon name='close' className='h-4 w-4' />
        </button>

        <AvatarSection
          avatarPreview={avatarPreview}
          onAvatarChange={onAvatarChange}
          onOpenPreviewModal={onOpenPreviewModal}
          onShowModelModal={onShowModelModal}
          onSetAvatarPreview={onSetAvatarPreview}
          onAvatarDelete={onAvatarDelete}
          sessionId={sessionId}
          t={t}
          showToast={showToast}
        />
      </div>
    </div>
  )
}

AvatarSourceModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  avatarPreview: PropTypes.string,
  onAvatarChange: PropTypes.func,
  onOpenPreviewModal: PropTypes.func,
  onShowModelModal: PropTypes.func,
  onSetAvatarPreview: PropTypes.func,
  onAvatarDelete: PropTypes.func,
  sessionId: PropTypes.string,
  showToast: PropTypes.func,
  t: PropTypes.func.isRequired,
}
