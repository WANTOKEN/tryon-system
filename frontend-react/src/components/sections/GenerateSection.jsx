import PropTypes from 'prop-types'

import { Button, Checkbox, Icon } from '../ui'

export default function GenerateSection({
  userConsent,
  onConsentChange,
  onShowDisclaimer,
  onTryOn,
  canTryOn,
  hasImage,
  hasClothing,
  isGenerating,
  tryOnBtnText,
  t,
  showToast,
}) {
  const handleTryOn = () => {
    if (!hasClothing) {
      showToast?.('请先选择至少一件服装', 'warning')
      return
    }
    if (!userConsent) {
      showToast?.('请先勾选同意免责声明', 'warning')
      return
    }
    onTryOn()
  }

  const getButtonIcon = () => {
    if (isGenerating) {
      return null
    }
    if (!hasImage) {
      return <Icon name='user' className='h-5 w-5' />
    }
    if (!hasClothing) {
      return <Icon name='image' className='h-5 w-5' />
    }
    if (!userConsent) {
      return <Icon name='document' className='h-5 w-5' />
    }
    return <Icon name='sparkle' className='h-5 w-5' />
  }

  const getButtonText = () => {
    if (!hasImage) {
      return t('uploadAvatarFirst') || '请先上传形象'
    }
    if (!hasClothing) {
      return t('selectClothingFirst') || '请先选择服装'
    }
    if (!userConsent) {
      return t('pleaseCheckTryOnConsent') || '请同意免责声明'
    }
    return tryOnBtnText
  }

  const isDisabled = isGenerating || (!canTryOn && hasImage && hasClothing && userConsent)

  return (
    <div className='border-t border-gray-100 bg-gray-50/50 p-3'>
      {/* 免责声明 */}
      <div className='mb-3 flex items-start gap-2'>
        <Checkbox
          id='generate-disclaimer-checkbox'
          checked={userConsent}
          onChange={e => onConsentChange(e.target.checked)}
          label={
            <>
              <span>{t('agree') || '同意'}</span>
              <button
                type='button'
                onClick={e => {
                  e.preventDefault()
                  onShowDisclaimer()
                }}
                className='ml-1 text-xs text-champagne hover:underline'
              >
                {t('tryOnDisclaimerShort') || '《AI生成免责声明》'}
              </button>
            </>
          }
        />
      </div>

      {/* 开始试穿按钮 */}
      <Button
        id='try-on-btn'
        variant='primary'
        size='xl'
        className='w-full'
        disabled={isDisabled}
        loading={isGenerating}
        leftIcon={getButtonIcon()}
        onClick={handleTryOn}
      >
        {getButtonText()}
      </Button>
    </div>
  )
}

GenerateSection.propTypes = {
  userConsent: PropTypes.bool.isRequired,
  onConsentChange: PropTypes.func.isRequired,
  onShowDisclaimer: PropTypes.func.isRequired,
  onTryOn: PropTypes.func.isRequired,
  canTryOn: PropTypes.bool.isRequired,
  hasImage: PropTypes.bool.isRequired,
  hasClothing: PropTypes.bool.isRequired,
  isGenerating: PropTypes.bool.isRequired,
  tryOnBtnText: PropTypes.string.isRequired,
  t: PropTypes.func.isRequired,
  showToast: PropTypes.func,
}
