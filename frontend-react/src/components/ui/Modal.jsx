import { useEffect } from 'react'

import PropTypes from 'prop-types'

export default function Modal({
  isOpen,
  onClose,
  title = null,
  children,
  footer = null,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  zIndex = 'var(--z-modal-1)',
}) {
  useEffect(() => {
    const handleEscape = e => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-[90vw]',
  }

  return (
    <div className='fixed inset-0 flex items-center justify-center' style={{ zIndex }}>
      <div
        className='absolute inset-0 bg-black/50 backdrop-blur-sm'
        onClick={closeOnOverlayClick ? onClose : undefined}
        onKeyDown={
          closeOnOverlayClick
            ? e => {
                if (e.key === 'Escape') {
                  onClose()
                }
              }
            : undefined
        }
        role='button'
        tabIndex={closeOnOverlayClick ? -1 : undefined}
        aria-label='关闭'
      />
      <div
        className={`relative flex max-h-[90vh] w-full ${sizeClasses[size]} flex-col overflow-hidden rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)]`}
        style={{
          background: 'var(--bg-primary)',
        }}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div
            className='flex items-center justify-between px-6 py-4'
            style={{ borderBottom: '1px solid var(--border-primary)' }}
          >
            {title && (
              <h3 className='text-lg font-semibold' style={{ color: 'var(--text-primary)' }}>
                {title}
              </h3>
            )}
            {showCloseButton && (
              <button
                type='button'
                onClick={onClose}
                className='rounded-[var(--radius-sm)] p-1.5 transition-colors'
                style={{ backgroundColor: 'transparent' }}
                onMouseEnter={e => {
                  e.target.style.backgroundColor = 'var(--bg-tertiary)'
                }}
                onMouseLeave={e => {
                  e.target.style.backgroundColor = 'transparent'
                }}
                aria-label='关闭'
              >
                <svg
                  className='h-5 w-5'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                  style={{ color: 'var(--text-muted)' }}
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M6 18L18 6M6 6l12 12'
                  />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className='flex-1 overflow-y-auto px-6 py-4'>{children}</div>

        {/* Footer */}
        {footer && (
          <div
            className='flex items-center justify-end gap-3 px-6 py-4'
            style={{ borderTop: '1px solid var(--border-primary)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.node,
  children: PropTypes.node.isRequired,
  footer: PropTypes.node,
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl', 'full']),
  showCloseButton: PropTypes.bool,
  closeOnOverlayClick: PropTypes.bool,
  zIndex: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
}
