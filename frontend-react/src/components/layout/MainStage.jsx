import PropTypes from 'prop-types'

import PreviewCanvas from '../sections/PreviewCanvas'
import { Icon } from '../ui'

export default function MainStage({
  // Preview
  resultUrl = null,
  selectedClothing,
  hasImage,
  hasClothing,
  onOpenPreviewModal,
  onClearSelection,
  // Generate
  userConsent,
  onConsentChange,
  onShowDisclaimer,
  onTryOn,
  canTryOn,
  isGenerating,
  tryOnBtnText,
  // Loading
  progress,
  remainingTime,
  // Common
  t,
}) {
  return (
    <main className='main-stage' role='main'>
      {/* 顶部工具栏 */}
      {(hasImage || hasClothing || resultUrl) && (
        <div className='mb-1 flex w-full max-w-[380px] justify-end'>
          <button
            type='button'
            className='btn-simple btn-simple-ghost text-xs'
            onClick={onClearSelection}
          >
            <Icon name='refresh' className='h-3.5 w-3.5' />
            {t('restart')}
          </button>
        </div>
      )}

      {/* 预览画布 */}
      <div className='relative'>
        <PreviewCanvas
          resultUrl={resultUrl}
          selectedClothing={selectedClothing}
          hasImage={hasImage}
          hasClothing={hasClothing}
          onOpenPreviewModal={onOpenPreviewModal}
          onClearSelection={onClearSelection}
          t={t}
        />

        {/* 加载遮罩 */}
        {isGenerating && (
          <div className='absolute inset-0 flex items-center justify-center rounded-[var(--radius-xl)] bg-black/30 backdrop-blur-sm'>
            <div className='loading-overlay-simple'>
              <div className='loading-spinner-simple' />
              <p className='loading-text-simple'>{t('generating')}</p>
              {progress > 0 && (
                <>
                  <div className='loading-progress-container'>
                    <div
                      className='loading-progress-bar'
                      style={{ width: `${Math.min(progress, 95)}%` }}
                    />
                  </div>
                  {remainingTime > 0 && (
                    <p className='loading-countdown-simple'>
                      {t('remainingTime', { n: remainingTime }) || `${remainingTime}s`}
                    </p>
                  )}
                  {remainingTime === 0 && progress > 0 && progress < 100 && (
                    <p className='mt-2 text-xs font-medium text-[var(--accent)]'>
                      {t('finishing') || '即将完成...'}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 生成按钮区域 - 常驻显示 */}
      {!resultUrl && (
        <div className='generate-section-simple mt-4'>
          {/* 免责声明复选框 - 只有在有图片和服装时显示 */}
          {hasImage && hasClothing && (
            <div className='flex items-start gap-2 text-sm text-[var(--text-secondary)]'>
              <input
                type='checkbox'
                id='main-consent'
                checked={userConsent}
                onChange={e => onConsentChange(e.target.checked)}
                className='checkbox-simple mt-0.5'
              />
              <label htmlFor='main-consent' className='cursor-pointer leading-relaxed'>
                <span>{t('consentText') || '我已阅读并同意'}</span>
                <button
                  type='button'
                  onClick={onShowDisclaimer}
                  className='ml-1 text-[var(--accent)] hover:underline'
                >
                  {t('viewDisclaimer') || '服务免责声明'}
                </button>
              </label>
            </div>
          )}

          {/* 生成按钮 - 常驻显示，不可点击时置灰 */}
          <button
            type='button'
            className={`generate-btn-simple ${isGenerating ? 'loading' : ''}`}
            onClick={onTryOn}
            disabled={!canTryOn || isGenerating}
          >
            {isGenerating ? (
              <>
                <Icon name='loader' className='h-4 w-4 animate-spin' />
                {t('generating')}
              </>
            ) : (
              <>
                <Icon name='sparkle' className='h-4 w-4' />
                {tryOnBtnText}
              </>
            )}
          </button>
        </div>
      )}
    </main>
  )
}

MainStage.propTypes = {
  resultUrl: PropTypes.string,
  selectedClothing: PropTypes.arrayOf(PropTypes.object).isRequired,
  hasImage: PropTypes.bool.isRequired,
  hasClothing: PropTypes.bool.isRequired,
  onOpenPreviewModal: PropTypes.func.isRequired,
  onClearSelection: PropTypes.func.isRequired,
  userConsent: PropTypes.bool.isRequired,
  onConsentChange: PropTypes.func.isRequired,
  onShowDisclaimer: PropTypes.func.isRequired,
  onTryOn: PropTypes.func.isRequired,
  canTryOn: PropTypes.bool.isRequired,
  isGenerating: PropTypes.bool.isRequired,
  tryOnBtnText: PropTypes.string.isRequired,
  progress: PropTypes.number.isRequired,
  remainingTime: PropTypes.number.isRequired,
  t: PropTypes.func.isRequired,
}
