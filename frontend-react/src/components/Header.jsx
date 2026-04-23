import { useState, useRef, useEffect } from 'react'

import { useI18n } from '../hooks/useI18n'

export default function Header({
  user,
  sessionCustomer,
  onOpenSettings,
  onOpenStoreInfo,
  onEndSession,
}) {
  const { t, locale, changeLocale, languages, currentLang } = useI18n()
  const [showLangDropdown, setShowLangDropdown] = useState(false)
  const langRef = useRef(null)

  // 点击外部关闭语言下拉
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
      className='sticky top-0 z-50 bg-gradient-to-r from-[#1A1A1A] via-[#222222] to-[#1A1A1A] px-6 py-2.5 text-white shadow-lg shadow-black/10'
      role='banner'
    >
      <div className='mx-auto flex max-w-7xl items-center justify-between'>
        {/* Logo */}
        <div className='flex items-center space-x-2.5'>
          <div
            className='flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-champagne to-yellow-600'
            aria-hidden='true'
          >
            <svg
              className='h-5 w-5 text-charcoal'
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
            <h1 id='site-title' className='text-lg font-semibold leading-tight tracking-wide'>
              <span className='text-champagne'>AI</span>{' '}
              {siteTitle.startsWith(aiStr) ? siteTitle.substring(aiStr.length) : siteTitle}
            </h1>
            <p
              id='site-subtitle'
              className='text-[10px] leading-tight tracking-wider text-gray-400'
            >
              {t('siteSubtitle')}
            </p>
          </div>
        </div>

        {/* 当前顾客标识 - 只显示尾号 */}
        {sessionCustomer && (
          <div className='flex items-center gap-2 rounded-lg border border-champagne/30 bg-champagne/10 px-3 py-1.5'>
            <svg
              className='h-4 w-4 text-champagne'
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
            <span className='text-xs font-medium text-champagne'>{sessionCustomer.slice(-6)}</span>
          </div>
        )}

        {/* Nav */}
        <nav className='flex items-center space-x-4' aria-label='用户操作'>
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
                  d='M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9'
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

          {/* 设置 */}
          <div className='relative'>
            <button
              type='button'
              className='touch-target flex items-center justify-center rounded-lg p-2 transition-colors hover:bg-white/10'
              aria-label={t('settingsTitle')}
              title={t('settingsTitle')}
              onClick={onOpenSettings}
            >
              <svg
                className='h-5 w-5 text-gray-400'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
                />
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
                />
              </svg>
            </button>
            {/* 登录状态指示器 */}
            {user && (
              <span className='absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full border-2 border-[#1A1A1A] bg-success' />
            )}
          </div>

          {/* 门店名 */}
          <button
            type='button'
            className='touch-target header-mobile-hide flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors hover:bg-white/10'
            aria-label={t('settingsStoreLabel')}
            title={t('settingsStoreLabel')}
            onClick={onOpenStoreInfo}
          >
            <div className='flex h-6 w-6 items-center justify-center rounded-full border border-champagne/40 bg-gradient-to-br from-champagne/30 to-champagne/50'>
              <svg
                className='h-3.5 w-3.5 text-champagne'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
                />
              </svg>
            </div>
            <span className='header-btn-text max-w-[80px] truncate text-xs font-medium text-gray-300'>
              {user?.store_name || t('storeNotActivated')}
            </span>
          </button>
        </nav>
      </div>
    </header>
  )
}
