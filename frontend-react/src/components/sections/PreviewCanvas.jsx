import PropTypes from 'prop-types'

import CachedImage from '../CachedImage'
import { Icon } from '../ui'

export default function PreviewCanvas({
  resultUrl = null,
  selectedClothing,
  hasImage,
  hasClothing,
  onOpenPreviewModal,
  t,
}) {
  const getStepStatus = () => {
    if (!hasImage) {
      return { step: 1, text: t('stepUploadAvatar') || '上传形象' }
    }
    if (!hasClothing) {
      return { step: 2, text: t('stepSelectClothing') || '选择服装' }
    }
    return { step: 3, text: t('stepGenerate') || '点击开始试穿' }
  }

  const getStepClass = stepNum => {
    const currentStep = getStepStatus().step
    if (currentStep === stepNum) {
      return 'active'
    }
    if (currentStep > stepNum) {
      return 'completed'
    }
    return ''
  }

  const getPlaceholderIcon = () => {
    const { step } = getStepStatus()
    if (step === 1) {
      return 'user'
    }
    if (step === 2) {
      return 'image'
    }
    return 'sparkle'
  }

  const status = getStepStatus()

  return (
    <div className='preview-simple'>
      {/* 步骤指示器 */}
      <div className='steps-simple'>
        <div className={`step-simple ${getStepClass(1)}`}>
          <div className='step-dot-simple' />
          <span>{t('step1')}</span>
        </div>
        <div className='step-line-simple' />
        <div className={`step-simple ${getStepClass(2)}`}>
          <div className='step-dot-simple' />
          <span>{t('step2')}</span>
        </div>
        <div className='step-line-simple' />
        <div className={`step-simple ${getStepClass(3)}`}>
          <div className='step-dot-simple' />
          <span>{t('step3')}</span>
        </div>
      </div>

      {/* 预览图容器 */}
      <div className={`preview-image-container ${resultUrl ? 'has-result' : ''}`}>
        {resultUrl ? (
          <div
            className='h-full w-full cursor-pointer'
            onClick={() =>
              onOpenPreviewModal(resultUrl, selectedClothing.map(c => c.name).join(' + '))
            }
            role='button'
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onOpenPreviewModal(resultUrl, selectedClothing.map(c => c.name).join(' + '))
              }
            }}
          >
            <CachedImage
              src={resultUrl}
              alt={t('aria_tryon_preview')}
              className='preview-image-simple'
            />
          </div>
        ) : (
          <div className='preview-placeholder-simple'>
            <div className='preview-placeholder-icon'>
              <Icon name={getPlaceholderIcon()} className='h-6 w-6' />
            </div>
            <p className='preview-hint-simple'>{status.text}</p>
          </div>
        )}
      </div>

      {/* 结果信息 */}
      {resultUrl && (
        <div className='result-info-simple animate-fade-in'>
          <p className='result-clothing-simple'>{selectedClothing.map(c => c.name).join(' + ')}</p>
          <p className='result-meta-simple'>{t('matched', { n: selectedClothing.length })}</p>
        </div>
      )}
    </div>
  )
}

PreviewCanvas.propTypes = {
  resultUrl: PropTypes.string,
  selectedClothing: PropTypes.arrayOf(PropTypes.object).isRequired,
  hasImage: PropTypes.bool.isRequired,
  hasClothing: PropTypes.bool.isRequired,
  onOpenPreviewModal: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
}
