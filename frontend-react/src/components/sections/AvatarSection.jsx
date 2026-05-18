import { useRef, useCallback } from 'react'

import PropTypes from 'prop-types'

import CachedImage from '../CachedImage'
import { Icon } from '../ui'

export default function AvatarSection({
  avatarPreview = null,
  onAvatarChange,
  onOpenPreviewModal,
  onShowModelModal,
  t,
  showToast = null,
}) {
  const fileInputRef = useRef(null)

  const handleAvatarFileChange = useCallback(
    e => {
      const file = e.target.files?.[0]
      if (file) {
        if (file.size > 10 * 1024 * 1024) {
          showToast?.('图片大小不能超过 10MB', 'warning')
          return
        }
        onAvatarChange(e)
      }
    },
    [onAvatarChange, showToast]
  )

  return (
    <div className='sidebar-section'>
      <div className='sidebar-section-title'>{t('myProfile')}</div>

      <div className='avatar-section-simple'>
        {/* 上传区域 */}
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div
          className={`avatar-upload-simple ${avatarPreview ? 'has-image' : 'empty'}`}
          onClick={() => !avatarPreview && fileInputRef.current?.click()}
          role={avatarPreview ? undefined : 'button'}
          tabIndex={avatarPreview ? undefined : 0}
          onKeyDown={e => {
            if (!avatarPreview && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              fileInputRef.current?.click()
            }
          }}
          aria-label={avatarPreview ? undefined : t('aria_upload_avatar')}
        >
          {avatarPreview ? (
            <>
              <CachedImage
                src={avatarPreview}
                alt={t('aria_user_photo')}
                className='avatar-img-simple'
              />
              <div className='avatar-actions-simple'>
                <button
                  type='button'
                  className='avatar-action-simple'
                  onClick={e => {
                    e.stopPropagation()
                    onOpenPreviewModal(avatarPreview, t('myProfile'))
                  }}
                  title={t('preview')}
                >
                  <Icon name='search' className='h-3.5 w-3.5' />
                </button>
                <button
                  type='button'
                  className='avatar-action-simple'
                  onClick={e => {
                    e.stopPropagation()
                    fileInputRef.current?.click()
                  }}
                  title={t('change')}
                >
                  <Icon name='refresh' className='h-3.5 w-3.5' />
                </button>
                <button
                  type='button'
                  className='avatar-action-simple'
                  onClick={e => {
                    e.stopPropagation()
                    onAvatarChange?.({ target: { files: null } })
                  }}
                  title={t('delete')}
                >
                  <Icon name='trash' className='h-3.5 w-3.5' />
                </button>
              </div>
            </>
          ) : (
            <>
              <Icon name='upload' className='h-8 w-8' strokeWidth={1.5} />
              <span className='text-sm'>{t('uploadPhoto')}</span>
            </>
          )}
        </div>

        {/* 提示和模特按钮 */}
        <div className='avatar-tips-simple'>
          <span>{t('avatarTip1')}</span>
          <span>{t('avatarTip3')}</span>
        </div>

        <button
          type='button'
          className='btn-simple btn-simple-secondary w-full'
          onClick={onShowModelModal}
        >
          <Icon name='user' className='h-4 w-4' />
          {t('useModel')}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type='file'
        accept='image/*'
        onChange={handleAvatarFileChange}
        className='hidden'
      />
    </div>
  )
}

AvatarSection.propTypes = {
  avatarPreview: PropTypes.string,
  onAvatarChange: PropTypes.func.isRequired,
  onOpenPreviewModal: PropTypes.func.isRequired,
  onShowModelModal: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
  showToast: PropTypes.func,
}
