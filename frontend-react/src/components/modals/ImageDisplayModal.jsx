import PropTypes from 'prop-types'

import { Icon } from '../ui'

/**
 * 图片展示模块框：居中模态，用于展示形象/服装等大图。
 * 形象槽位、服装槽位共用此组件。
 */
export default function ImageDisplayModal({
  isOpen,
  onClose,
  src = null,
  title = '',
  onEdit,
  onDelete,
  t,
}) {
  if (!isOpen) {
    return null
  }

  return (
    <div
      className='scan-overlay'
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
        className='image-display-modal'
        onClick={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
        role='presentation'
        tabIndex={-1}
      >
        <button
          type='button'
          className='scan-modal-close'
          onClick={onClose}
          aria-label={t('close') || '关闭'}
        >
          <Icon name='close' className='h-4 w-4' />
        </button>

        <div className='scan-modal-title'>{title || t('imagePreview') || '图片预览'}</div>

        <div className='image-display-body'>
          {src ? (
            <img src={src} alt={title} className='image-display-img' />
          ) : (
            <div className='image-display-empty'>
              <Icon name='image' className='h-10 w-10' />
              <span>{t('noImage') || '暂无图片'}</span>
            </div>
          )}
        </div>

        {(onEdit || onDelete) && (
          <div className='image-display-actions'>
            {onEdit && (
              <button type='button' className='image-display-btn' onClick={onEdit}>
                <Icon name='refresh' className='h-4 w-4' />
                {t('change') || '更换'}
              </button>
            )}
            {onDelete && (
              <button
                type='button'
                className='image-display-btn image-display-btn-danger'
                onClick={onDelete}
              >
                <Icon name='trash' className='h-4 w-4' />
                {t('delete') || '删除'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

ImageDisplayModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  src: PropTypes.string,
  title: PropTypes.string,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  t: PropTypes.func.isRequired,
}
