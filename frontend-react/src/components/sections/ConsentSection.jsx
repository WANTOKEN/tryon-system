import PropTypes from 'prop-types'

export default function ConsentSection({
  userConsent,
  onConsentChange,
  onShowDisclaimer,
  t,
  requireConsent = true,
}) {
  if (!requireConsent) {
    return null
  }

  return (
    <div className='consent-inline'>
      <input
        type='checkbox'
        id='consent-checkbox'
        checked={userConsent}
        onChange={e => onConsentChange(e.target.checked)}
        className='checkbox-simple'
      />
      <label htmlFor='consent-checkbox' className='cursor-pointer leading-relaxed'>
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
  )
}

ConsentSection.propTypes = {
  userConsent: PropTypes.bool.isRequired,
  onConsentChange: PropTypes.func.isRequired,
  onShowDisclaimer: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
  requireConsent: PropTypes.bool,
}
