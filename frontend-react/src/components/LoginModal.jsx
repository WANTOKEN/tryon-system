import { useState, useEffect } from 'react'

import { useI18n } from '../hooks/useI18n'
import BrandLogo from './BrandLogo'

export default function LoginModal({
  isOpen,
  onClose,
  onLogin,
  onSmsLogin,
  onSendSms,
  onRegister,
  loading = false,
}) {
  const { t } = useI18n()
  const [mode, setMode] = useState('login') // 'login' | 'register' | 'reset'
  const [tab, setTab] = useState('password') // 'password' | 'sms'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [storeName, setStoreName] = useState('')

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [countdown])

  useEffect(() => {
    if (!isOpen) {
      setUsername('')
      setPassword('')
      setPhone('')
      setSmsCode('')
      setCountdown(0)
      setStoreName('')
      setMode('login')
      setTab('password')
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

  const handleRegister = e => {
    e.preventDefault()
    if (!username.trim() || !phone.trim() || !password.trim()) {
      return
    }
    onRegister(username.trim(), phone.trim(), password, storeName.trim())
  }

  const handleSendSms = async purpose => {
    if (countdown > 0 || !phone.trim()) {
      return
    }
    const success = await onSendSms(phone.trim())
    if (success) {
      setCountdown(60)
    }
  }

  const titles = {
    login: t('loginTitle'),
    register: t('registerTitle', '注册账号'),
  }

  const subtitles = {
    login: t('loginSubtitle'),
    register: t('registerSubtitle', '创建您的商家账号'),
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
        <div className='bg-gradient-to-r from-[#1A1A1A] to-[#2A2A2A] px-6 py-6 text-center'>
          <div className='mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border-2 border-champagne/40 bg-champagne/20'>
            <BrandLogo size={32} />
          </div>
          <h2 className='text-lg font-semibold text-white'>{titles[mode]}</h2>
          <p className='mt-1 text-xs text-gray-400'>{subtitles[mode]}</p>
        </div>

        <div className='px-6 pt-5'>
          {mode === 'login' && (
            <>
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
                        onClick={() => handleSendSms('login')}
                        disabled={countdown > 0 || !phone.trim()}
                        className='whitespace-nowrap rounded-xl border border-champagne/30 px-4 py-2.5 text-sm font-medium text-champagne transition-colors hover:bg-champagne/5 disabled:cursor-not-allowed disabled:opacity-50'
                      >
                        {countdown > 0
                          ? t('loginSendSmsCountdown', { n: countdown })
                          : t('loginSendSms')}
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

              <div className='mt-4 text-center text-xs text-grayMuted'>
                {t('noAccount', '还没有账号？')}
                <button
                  type='button'
                  onClick={() => setMode('register')}
                  className='ml-1 text-champagne hover:underline'
                >
                  {t('registerNow', '立即注册')}
                </button>
              </div>
            </>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className='space-y-3'>
              <div>
                <label
                  htmlFor='register-username'
                  className='mb-1.5 block text-xs font-medium text-charcoal'
                >
                  {t('registerUsernameLabel', '用户名')}
                </label>
                <input
                  id='register-username'
                  type='text'
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className='w-full rounded-xl border border-grayLight px-3 py-2.5 text-sm transition-all placeholder:text-grayMuted/60 focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/20'
                  placeholder={t('registerUsernamePlaceholder', '请输入用户名')}
                />
              </div>
              <div>
                <label
                  htmlFor='register-phone'
                  className='mb-1.5 block text-xs font-medium text-charcoal'
                >
                  {t('registerPhoneLabel', '手机号')}
                </label>
                <input
                  id='register-phone'
                  type='tel'
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className='w-full rounded-xl border border-grayLight px-3 py-2.5 text-sm transition-all placeholder:text-grayMuted/60 focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/20'
                  placeholder={t('registerPhonePlaceholder', '请输入手机号')}
                />
              </div>
              <div>
                <label
                  htmlFor='register-password'
                  className='mb-1.5 block text-xs font-medium text-charcoal'
                >
                  {t('registerPasswordLabel', '密码')}
                </label>
                <input
                  id='register-password'
                  type='password'
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className='w-full rounded-xl border border-grayLight px-3 py-2.5 text-sm transition-all placeholder:text-grayMuted/60 focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/20'
                  placeholder={t('registerPasswordPlaceholder', '请输入密码（至少6位）')}
                />
              </div>
              <div>
                <label
                  htmlFor='register-store-name'
                  className='mb-1.5 block text-xs font-medium text-charcoal'
                >
                  {t('registerStoreNameLabel', '门店名称（选填）')}
                </label>
                <input
                  id='register-store-name'
                  type='text'
                  value={storeName}
                  onChange={e => setStoreName(e.target.value)}
                  className='w-full rounded-xl border border-grayLight px-3 py-2.5 text-sm transition-all placeholder:text-grayMuted/60 focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/20'
                  placeholder={t('registerStoreNamePlaceholder', '请输入门店名称')}
                />
              </div>
              <button
                type='submit'
                disabled={loading || !username.trim() || !phone.trim() || !password.trim()}
                className='mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-champagne py-3 text-sm font-semibold text-white transition-colors hover:bg-yellow-600 disabled:cursor-not-allowed disabled:opacity-50'
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
                    {t('registerLoading', '注册中...')}
                  </>
                ) : (
                  t('registerBtn', '注册')
                )}
              </button>
              <div className='mt-3 text-center text-xs text-grayMuted'>
                {t('hasAccount', '已有账号？')}
                <button
                  type='button'
                  onClick={() => setMode('login')}
                  className='ml-1 text-champagne hover:underline'
                >
                  {t('loginNow', '立即登录')}
                </button>
              </div>
            </form>
          )}


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
