import PropTypes from 'prop-types'

import { Modal, Button } from '../ui'

export default function ModelSelectModal({
  isOpen,
  onClose,
  modelPhotos,
  modelPhotosLoading,
  tempSelectedModel = null,
  onSelectModel,
  onConfirm,
  t,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('useModel') || '使用模特'}
      size='md'
      footer={
        <>
          <Button variant='secondary' onClick={onClose}>
            {t('cancel') || '取消'}
          </Button>
          <Button variant='primary' onClick={onConfirm} disabled={!tempSelectedModel}>
            {t('confirm') || '确认'}
          </Button>
        </>
      }
    >
      {(() => {
        if (modelPhotosLoading) {
          return (
            <div className='flex items-center justify-center py-12'>
              <div className='h-8 w-8 animate-spin rounded-full border-b-2 border-champagne' />
            </div>
          )
        }
        if (modelPhotos.length === 0) {
          return (
            <div className='py-12 text-center text-grayMuted'>
              <svg
                className='mx-auto mb-4 h-12 w-12 text-gray-300'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='1.5'
                  d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
                />
              </svg>
              <p>{t('noModelPhotos') || '暂无模特照片'}</p>
            </div>
          )
        }
        return (
          <div className='grid grid-cols-3 gap-4 sm:grid-cols-4'>
            {modelPhotos.map(model => {
              const isSelected = tempSelectedModel?.id === model.id
              return (
                <div
                  key={model.id}
                  className={`group relative cursor-pointer overflow-hidden rounded-xl border-2 transition-all duration-200 ${
                    isSelected
                      ? 'border-champagne shadow-lg'
                      : 'border-gray-200 hover:border-champagne/50 hover:shadow-md dark:border-gray-700'
                  }`}
                  onClick={() => onSelectModel(model)}
                  role='button'
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelectModel(model)
                    }
                  }}
                >
                  <div className='aspect-[2/3] overflow-hidden'>
                    <img
                      src={model.image_url}
                      alt={model.name}
                      className={`h-full w-full object-cover transition-transform duration-200 ${
                        isSelected ? 'scale-105' : 'group-hover:scale-105'
                      }`}
                      onError={e => {
                        const { target } = e
                        target.src =
                          'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300"%3E%3Crect fill="%23f0f0f0" width="200" height="300" rx="8"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="14" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3E%E6%A8%A1%E7%89%B9%E7%85%A7%E7%89%87%3C/text%3E%3C/svg%3E'
                        target.onerror = null
                      }}
                    />
                  </div>
                  {isSelected && (
                    <div className='absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-champagne text-white shadow-md'>
                      <svg
                        className='h-4 w-4'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={3}
                          d='M5 13l4 4L19 7'
                        />
                      </svg>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })()}

      <div className='mt-4 text-sm text-gray-500'>
        {(() => {
          if (tempSelectedModel) {
            return t('selectedModel', {
              name: tempSelectedModel.name || `模特 ${tempSelectedModel.id}`,
            })
          }
          return t('pleaseSelectModel')
        })()}
      </div>
    </Modal>
  )
}

ModelSelectModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  modelPhotos: PropTypes.arrayOf(PropTypes.object).isRequired,
  modelPhotosLoading: PropTypes.bool.isRequired,
  tempSelectedModel: PropTypes.object,
  onSelectModel: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
}
