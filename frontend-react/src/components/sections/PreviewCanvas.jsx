import PropTypes from 'prop-types'

import CachedImage from '../CachedImage'
import { Icon } from '../ui'

export default function PreviewCanvas({
  resultUrl = null,
  recordId = null,
  selectedClothing,
  hasImage,
  hasClothing,
  onOpenPreviewModal,
  isResultSaved = false,
  onToggleHistorySaved,
  onRegenerate,
  onClearSelection,
  canTryOn = false,
  isGenerating = false,
  status = 'idle',
  errorMessage = null,
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

  const stepStatus = getStepStatus()

  return (
    <div className='preview-simple' id='tryon-result-area'>
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
              onOpenPreviewModal(
                resultUrl,
                selectedClothing.map(c => c.name).join(' + '),
                selectedClothing
              )
            }
            role='button'
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onOpenPreviewModal(
                  resultUrl,
                  selectedClothing.map(c => c.name).join(' + '),
                  selectedClothing
                )
              }
            }}
          >
            <CachedImage
              src={resultUrl}
              alt={t('aria_tryon_preview')}
              className='preview-image-simple'
              lazy={false}
            />
          </div>
        ) : (
          <div className='preview-placeholder-simple'>
            <div className='preview-placeholder-icon'>
              <Icon name={getPlaceholderIcon()} className='h-6 w-6' />
            </div>
            <p className='preview-hint-simple'>{stepStatus.text}</p>
          </div>
        )}

        {/* 结果态悬浮操作条：下载 / 收藏 / 重新生成 / 清空重来
            绝对定位浮在图上，不占文档流高度，避免生成后挤占下方布局 */}
        {resultUrl && (
          <div className='result-actions-floating'>
            <a
              href={resultUrl}
              download
              target='_blank'
              rel='noreferrer'
              className='result-fab'
              title={t('download') || '下载'}
              aria-label={t('download') || '下载'}
            >
              <Icon name='download' className='h-4 w-4' />
            </a>
            <button
              type='button'
              className={`result-fab ${isResultSaved ? 'is-active' : ''}`}
              onClick={() => onToggleHistorySaved?.(recordId, !isResultSaved)}
              disabled={!recordId}
              title={isResultSaved ? t('unsave') || '取消收藏' : t('save') || '收藏'}
              aria-label={isResultSaved ? t('unsave') || '取消收藏' : t('save') || '收藏'}
            >
              <Icon name={isResultSaved ? 'heartFilled' : 'heart'} className='h-4 w-4' />
            </button>
            <button
              type='button'
              className='result-fab'
              onClick={onRegenerate}
              disabled={!canTryOn || isGenerating}
              title={
                isGenerating ? t('regenerating') || '重新生成中' : t('regenerate') || '重新生成'
              }
              aria-label={
                isGenerating ? t('regenerating') || '重新生成中' : t('regenerate') || '重新生成'
              }
            >
              <Icon name='refresh' className='h-4 w-4' />
            </button>
            <button
              type='button'
              className='result-fab'
              onClick={onClearSelection}
              title={t('clearRestart') || '清空重来'}
              aria-label={t('clearRestart') || '清空重来'}
            >
              <Icon name='trash' className='h-4 w-4' />
            </button>
          </div>
        )}
      </div>

      {/* 失败持久态：保留错误文案 + 重试入口 */}
      {status === 'failed' && errorMessage && (
        <div className='result-error-card animate-fade-in' role='alert'>
          <Icon name='info' className='h-4 w-4 flex-shrink-0' />
          <p className='result-error-text'>{errorMessage}</p>
          <button
            type='button'
            className='result-error-retry'
            onClick={onRegenerate}
            disabled={!canTryOn || isGenerating}
          >
            <Icon name='refresh' className='h-3.5 w-3.5' />
            <span>{t('retry') || '重试'}</span>
          </button>
        </div>
      )}
    </div>
  )
}

PreviewCanvas.propTypes = {
  resultUrl: PropTypes.string,
  recordId: PropTypes.string,
  selectedClothing: PropTypes.arrayOf(PropTypes.object).isRequired,
  hasImage: PropTypes.bool.isRequired,
  hasClothing: PropTypes.bool.isRequired,
  onOpenPreviewModal: PropTypes.func.isRequired,
  isResultSaved: PropTypes.bool,
  onToggleHistorySaved: PropTypes.func,
  onRegenerate: PropTypes.func,
  onClearSelection: PropTypes.func,
  canTryOn: PropTypes.bool,
  isGenerating: PropTypes.bool,
  status: PropTypes.string,
  errorMessage: PropTypes.string,
  t: PropTypes.func.isRequired,
}
