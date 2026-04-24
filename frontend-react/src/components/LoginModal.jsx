import { useState, useEffect } from 'react'
import { useI18n } from '../hooks/useI18n'

export default function LoginModal({
  isOpen,
  onClose,
  onLogin,
  onSmsLogin,
  onSendSms,
  loading = false,
}) {
  const { t } = useI18n()
  const [tab, setTab] = useState('password') // 'password' | 'sms'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [countdown, setCountdown] = useState(0)

  // 倒计时
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [countdown])

  // 重置表单
  useEffect(() => {
    if (!isOpen) {
      setUsername('')
      setPassword('')
      setPhone('')
      setSmsCode('')
      setCountdown(0)
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  const handlePasswordLogin = e => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      return
    }
    onLogin(username.trim(), password)
  }

  const handleSmsLogin = e => {
    e.preventDefault()
    if (!phone.trim() || !smsCode.trim()) {
      return
    }
    onSmsLogin(phone.trim(), smsCode)
  }

  const handleSendSms = async () => {
    if (countdown > 0 || !phone.trim()) {
      return
    }
    const success = await onSendSms(phone.trim())
    if (success) {
      setCountdown(60)
    }
  }

  return (
    <div
      className='fixed inset-0 z-[90] flex items-center justify-center p-4'
      role='dialog'
      aria-modal='true'
    >
      <div
        className='absolute inset-0 bg-black/50 backdrop-blur-sm'
        onClick={onClose}
        onKeyDown={e => {
          if (e.key === 'Escape') {
            onClose()
          }
        }}
        role='button'
        tabIndex={-1}
        aria-label={t('loginClose')}
      />
      <div className='relative w-full max-w-sm animate-scale-in overflow-hidden rounded-2xl bg-white shadow-2xl'>
        {/* Header */}
        <div className='bg-gradient-to-r from-[#1A1A1A] to-[#2A2A2A] px-6 py-6 text-center'>
          <div className='mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border-2 border-champagne/40 bg-champagne/20'>
            <svg
              className='h-7 w-7 text-champagne'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
              />
            </svg>
          </div>
          <h2 className='text-lg font-semibold text-white'>{t('loginTitle')}</h2>
          <p className='mt-1 text-xs text-gray-400'>{t('loginSubtitle')}</p>
        </div>

        {/* Tab 切换 */}
        <div className='px-6 pt-5'>
          <div className='mb-5 flex rounded-xl bg-gray-100 p-1'>
            <button
              type='button'
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                tab === 'password'
                  ? 'bg-white text-charcoal shadow-sm'
                  : 'text-grayMuted hover:text-charcoal'
              }`}
              onClick={() => setTab('password')}
            >
              {t('loginTabPassword')}
            </button>
            <button
              type='button'
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                tab === 'sms'
                  ? 'bg-white text-charcoal shadow-sm'
                  : 'text-grayMuted hover:text-charcoal'
              }`}
              onClick={() => setTab('sms')}
            >
              {t('loginTabSms')}
            </button>
          </div>

          {/* 账号密码表单 */}
          {tab === 'password' && (
            <form onSubmit={handlePasswordLogin} className='space-y-3'>
              <div>
                <label
                  htmlFor='login-username'
                  className='mb-1.5 block text-xs font-medium text-charcoal'
                >
                  {t('loginUsernameLabel')}
                </label>
                <input
                  id='login-username'
                  type='text'
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className='w-full rounded-xl border border-grayLight px-3 py-2.5 text-sm transition-all placeholder:text-grayMuted/60 focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/20'
                  placeholder={t('loginUsernamePlaceholder')}
                />
              </div>
              <div>
                <label
                  htmlFor='login-password'
                  className='mb-1.5 block text-xs font-medium text-charcoal'
                >
                  {t('loginPasswordLabel')}
                </label>
                <input
                  id='login-password'
                  type='password'
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className='w-full rounded-xl border border-grayLight px-3 py-2.5 text-sm transition-all placeholder:text-grayMuted/60 focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/20'
                  placeholder={t('loginPasswordPlaceholder')}
                />
              </div>
              <button
                type='submit'
                disabled={loading || !username.trim() || !password.trim()}
                className='mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-charcoal py-3 text-sm font-semibold text-white transition-colors hover:bg-charcoal/90 disabled:cursor-not-allowed disabled:opacity-50'
              >
                {loading ? (
                  <>
                    <svg className='h-4 w-4 animate-spin' fill='none' viewBox='0 0 24 24'>
                      <circle
                        className='opacity-25'
                        cx='12'
                        cy='12'
                        r='10'
                        stroke='currentColor'
                        strokeWidth='4'
                      />
                      <path
                        className='opacity-75'
                        fill='currentColor'
                        d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                      />
                    </svg>
                    {t('loginLoading')}
                  </>
                ) : (
                  t('loginBtn')
                )}
              </button>
            </form>
          )}

          {/* 短信验证码表单 */}
          {tab === 'sms' && (
            <form onSubmit={handleSmsLogin} className='space-y-3'>
              <div>
                <label
                  htmlFor='login-phone'
                  className='mb-1.5 block text-xs font-medium text-charcoal'
                >
                  {t('loginPhoneLabel')}
                </label>
                <input
                  id='login-phone'
                  type='tel'
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className='w-full rounded-xl border border-grayLight px-3 py-2.5 text-sm transition-all placeholder:text-grayMuted/60 focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/20'
                  placeholder={t('loginPhonePlaceholder')}
                />
              </div>
              <div>
                <label
                  htmlFor='login-sms-code'
                  className='mb-1.5 block text-xs font-medium text-charcoal'
                >
                  {t('loginSmsLabel')}
                </label>
                <div className='flex gap-2'>
                  <input
                    id='login-sms-code'
                    type='text'
                    value={smsCode}
                    onChange={e => setSmsCode(e.target.value)}
                    maxLength={6}
                    className='flex-1 rounded-xl border border-grayLight px-3 py-2.5 text-sm transition-all placeholder:text-grayMuted/60 focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/20'
                    placeholder={t('loginSmsPlaceholder')}
                  />
                  <button
                    type='button'
                    onClick={handleSendSms}
                    disabled={countdown > 0 || !phone.trim()}
                    className='whitespace-nowrap rounded-xl border border-champagne/30 px-4 py-2.5 text-sm font-medium text-champagne transition-colors hover:bg-champagne/5 disabled:cursor-not-allowed disabled:opacity-50'
                  >
                    {countdown > 0 ? t('loginSendSmsCountdown', { n: countdown }) : t('loginSendSms')}
                  </button>
                </div>
              </div>
              <button
                type='submit'
                disabled={loading || !phone.trim() || !smsCode.trim()}
                className='mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-charcoal py-3 text-sm font-semibold text-white transition-colors hover:bg-charcoal/90 disabled:cursor-not-allowed disabled:opacity-50'
              >
                {loading ? (
                  <>
                    <svg className='h-4 w-4 animate-spin' fill='none' viewBox='0 0 24 24'>
                      <circle
                        className='opacity-25'
                        cx='12'
                        cy='12'
                        r='10'
                        stroke='currentColor'
                        strokeWidth='4'
                      />
                      <path
                        className='opacity-75'
                        fill='currentColor'
                        d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                      />
                    </svg>
                    {t('loginLoading')}
                  </>
                ) : (
                  t('loginBtn')
                )}
              </button>
            </form>
          )}

          {/* 取消按钮 */}
          <button
            type='button'
            onClick={onClose}
            className='mt-3 w-full py-2 text-sm text-grayMuted transition-colors hover:text-charcoal'
          >
            {t('loginCancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
