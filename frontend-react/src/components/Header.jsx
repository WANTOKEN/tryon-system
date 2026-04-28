import { useState, useRef, useEffect } from 'react'

import { useI18n } from '../hooks/useI18n'

export default function Header({ user, sessionCustomer, onOpenSettings, onEndSession }) {
  const { t, locale, changeLocale, languages, currentLang } = useI18n()
  const [showLangDropdown, setShowLangDropdown] = useState(false)
  const langRef = useRef(null)

  const getAvatarText = () => {
    if (user?.store_name) {
      return user.store_name.charAt(0).toUpperCase()
    }
    if (user?.username) {
      return user.username.charAt(0).toUpperCase()
    }
    return '?'
  }

  useEffect(() => {
    const handler = e => {
      if (langRef.current && !langRef.current.contains(e.target)) {
        setShowLangDropdown(false)
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const siteTitle = t('siteTitle')
  const aiStr = 'AI '

  return (
    <header
      className='sticky top-0 z-50 bg-gradient-to-r from-[#1A1A1A] via-[#222222] to-[#1A1A1A] px-3 py-2 text-white shadow-lg shadow-black/10 md:px-5 md:py-2.5'
      role='banner'
    >
      <div className='mx-auto flex max-w-7xl items-center justify-between'>
        {/* Logo */}
        <div className='flex items-center space-x-2 md:space-x-2.5'>
          <div
            className='flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-champagne to-yellow-600 md:h-8 md:w-8'
            aria-hidden='true'
          >
            <svg
              className='h-4 w-4 text-charcoal md:h-5 md:w-5'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01'
              />
            </svg>
          </div>
          <div>
            <h1
              id='site-title'
              className='text-base font-semibold leading-tight tracking-wide md:text-lg'
            >
              <span className='text-champagne'>AI</span>{' '}
              {siteTitle.startsWith(aiStr) ? siteTitle.substring(aiStr.length) : siteTitle}
            </h1>
            <p
              id='site-subtitle'
              className='text-[9px] leading-tight tracking-wider text-gray-400 md:text-[10px]'
            >
              {t('siteSubtitle')}
            </p>
          </div>
        </div>

        {/* 当前顾客标识 - 只显示尾号 */}
        {sessionCustomer && (
          <div className='flex items-center gap-1.5 rounded-lg border border-champagne/30 bg-champagne/10 px-2 py-1 md:gap-2 md:px-3 md:py-1.5'>
            <svg
              className='h-3.5 w-3.5 text-champagne md:h-4 md:w-4'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M16 7a4 4 0 11-8 0a4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
              />
            </svg>
            <span className='text-[11px] font-medium text-champagne md:text-xs'>
              {sessionCustomer.slice(-6)}
            </span>
          </div>
        )}

        {/* Nav */}
        <nav className='flex items-center gap-2 lg:gap-3' aria-label='用户操作'>
          {/* 语言切换 */}
          <div className='relative' ref={langRef}>
            <button
              type='button'
              className='touch-target flex items-center justify-center gap-1.5 rounded-lg p-2 transition-colors hover:bg-white/10'
              aria-label={t('langName')}
              title={t('langName')}
              onClick={() => setShowLangDropdown(!showLangDropdown)}
            >
              <svg
                className='h-4 w-4 text-gray-400'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0 3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9'
                />
              </svg>
              <span className='header-btn-text text-[10px] font-medium text-gray-400'>
                {currentLang.flag} {currentLang.name}
              </span>
              <svg
                className={`h-3 w-3 text-gray-500 transition-transform duration-200 ${showLangDropdown ? 'rotate-180' : ''}`}
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M19 9l-7 7-7-7'
                />
              </svg>
            </button>
            {showLangDropdown && (
              <div className='absolute right-0 top-full z-[60] mt-2 w-36 animate-fade-in overflow-hidden rounded-xl border border-white/10 bg-[#2A2A2A] shadow-xl shadow-black/30'>
                {languages.map(lang => (
                  <button
                    type='button'
                    key={lang.code}
                    className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-white/10 hover:text-white ${
                      locale === lang.code ? 'bg-white/10 text-white' : 'text-gray-300'
                    }`}
                    onClick={() => {
                      changeLocale(lang.code)
                      setShowLangDropdown(false)
                    }}
                  >
                    <span className='text-base'>{lang.flag}</span> {lang.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 结束试穿 */}
          <button
            type='button'
            className='touch-target flex items-center gap-1.5 rounded-lg bg-error/80 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-error'
            aria-label={t('endSession')}
            title={t('endSession')}
            onClick={onEndSession}
          >
            <svg className='h-4 w-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1'
              />
            </svg>
            <span className='header-btn-text'>{t('endSession')}</span>
          </button>

          {/* 商家信息头像 */}
          <div className='relative'>
            <button
              type='button'
              className='flex items-center justify-center rounded-full transition-all hover:ring-2 hover:ring-champagne/40 hover:ring-offset-2 hover:ring-offset-[#1A1A1A] active:scale-[0.97]'
              aria-label={
                user ? user.store_name || t('settingsMerchantAccount') : t('storeNotLoggedIn')
              }
              title={user ? user.store_name || t('settingsMerchantAccount') : t('storeNotLoggedIn')}
              onClick={onOpenSettings}
            >
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.store_name || 'Avatar'}
                  className='h-9 w-9 rounded-full object-cover ring-2 ring-champagne/30 lg:h-10 lg:w-10'
                />
              ) : (
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold lg:h-10 lg:w-10 lg:text-sm ${
                    user
                      ? 'bg-gradient-to-br from-champagne to-yellow-600 text-charcoal ring-2 ring-champagne/30'
                      : 'bg-gray-600 text-gray-300 ring-2 ring-gray-500/30'
                  }`}
                >
                  {getAvatarText()}
                </div>
              )}
            </button>
            {/* 登录状态指示器 */}
            {user && (
              <span className='absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full border-2 border-[#1A1A1A] bg-success shadow-sm shadow-success/50 lg:h-3 lg:w-3' />
            )}
          </div>
        </nav>
      </div>
    </header>
  )
}
