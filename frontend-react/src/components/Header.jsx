import { useState, useRef, useEffect, useMemo } from 'react'

import { useI18n } from '../hooks/useI18n'
import BrandLogo from './BrandLogo'

export default function Header({
  user,
  sessionCustomer,
  onOpenSettings,
  onEndSession,
  onOpenHistory,
  history = [],
  theme,
  mode,
  onThemeChange,
  onToggleMode,
}) {
  const { t, locale, changeLocale, languages, currentLang } = useI18n()
  const [showLangDropdown, setShowLangDropdown] = useState(false)
  const langRef = useRef(null)
  const [showThemeDropdown, setShowThemeDropdown] = useState(false)
  const themeRef = useRef(null)

  const THEME_OPTIONS = [
    { key: 'luxury-gold', name: '香槟金', color: '#c8a45c' },
    { key: 'frost-blue', name: '冰川蓝', color: '#4a90d9' },
    { key: 'sakura-pink', name: '樱花粉', color: '#e89ab0' },
    { key: 'forest-green', name: '森林绿', color: '#5a9e7a' },
  ]

  const activeThemeColor =
    THEME_OPTIONS.find(o => o.key === theme)?.color || '#c8a45c'

  const savedCount = useMemo(
    () => (history || []).filter(r => r.is_saved || r.saved).length,
    [history]
  )

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
      if (themeRef.current && !themeRef.current.contains(e.target)) {
        setShowThemeDropdown(false)
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const siteTitle = t('siteTitle')
  const aiStr = 'AI '

  return (
    <header
      className='sticky top-0 z-50 px-3 py-2 text-white shadow-lg shadow-black/10 md:px-5 md:py-2.5'
      style={{
        background: 'linear-gradient(to right, var(--header-bg-1), var(--header-bg-2), var(--header-bg-1))',
        color: 'var(--header-on)',
      }}
      role='banner'
    >
      <div className='mx-auto flex max-w-7xl items-center justify-between'>
        {/* Logo */}
        <div className='flex items-center space-x-2 md:space-x-2.5'>
          <BrandLogo size={28} className='flex-shrink-0 md:h-8 md:w-8' />

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
          {/* 历史记录按钮 */}
          <button
            type='button'
            className='touch-target relative flex items-center justify-center gap-1.5 rounded-lg p-2 transition-colors hover:bg-white/10'
            aria-label={t('tryOnHistory')}
            title={t('tryOnHistory')}
            onClick={onOpenHistory}
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
                d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
              />
            </svg>
            <span className='header-btn-text hidden text-[10px] font-medium text-gray-400 sm:inline'>
              {t('history')}
            </span>
            {savedCount > 0 && (
              <span className='absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[9px] font-bold text-white shadow-sm'>
                {savedCount}
              </span>
            )}
          </button>

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
              <div className='absolute right-0 top-full z-[60] mt-2 w-36 animate-fade-in overflow-hidden rounded-xl border border-white/10 bg-[var(--header-bg-2)] shadow-xl shadow-black/30'>
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

          {/* 主题切换 */}
          <div className='relative' ref={themeRef}>
            <button
              type='button'
              className='touch-target flex items-center justify-center gap-1.5 rounded-lg p-2 transition-colors hover:bg-white/10'
              aria-label='主题配色'
              title='主题配色'
              onClick={() => setShowThemeDropdown(!showThemeDropdown)}
            >
              <span
                className='flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-white/20'
                style={{ backgroundColor: activeThemeColor }}
              >
                <svg className='h-2.5 w-2.5 text-white/90' fill='currentColor' viewBox='0 0 24 24'>
                  <path d='M12 3a9 9 0 100 18c1.66 0 3-1.34 3-3 0-.55-.45-1-1-1H12a1 1 0 01-1-1v-2a1 1 0 011-1h2c1.1 0 2-.9 2-2 0-1.66-1.34-3-3-3 .55 0 1-.45 1-1V5c0-1.1-.9-2-2-2z' />
                </svg>
              </span>
              <svg
                className={`h-3 w-3 text-gray-500 transition-transform duration-200 ${showThemeDropdown ? 'rotate-180' : ''}`}
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M19 9l-7 7-7-7' />
              </svg>
            </button>
            {showThemeDropdown && (
              <div className='absolute right-0 top-full z-[60] mt-2 w-44 animate-fade-in overflow-hidden rounded-xl border border-white/10 bg-[var(--header-bg-2)] p-2 shadow-xl shadow-black/30'>
                <p className='px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-gray-500'>
                  配色方案
                </p>
                {THEME_OPTIONS.map(opt => (
                  <button
                    type='button'
                    key={opt.key}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-white/10 ${
                      theme === opt.key ? 'bg-white/10 text-white' : 'text-gray-300'
                    }`}
                    onClick={() => {
                      onThemeChange(opt.key)
                      setShowThemeDropdown(false)
                    }}
                  >
                    <span
                      className='h-4 w-4 flex-shrink-0 rounded-full ring-1 ring-white/20'
                      style={{ backgroundColor: opt.color }}
                    />
                    {opt.name}
                    {theme === opt.key && (
                      <svg className='ml-auto h-3.5 w-3.5 text-accent' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='3' d='M5 13l4 4L19 7' />
                      </svg>
                    )}
                  </button>
                ))}
                <div className='my-1.5 border-t border-white/10' />
                <button
                  type='button'
                  className='flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm text-gray-300 transition-colors hover:bg-white/10'
                  onClick={() => {
                    onToggleMode()
                    setShowThemeDropdown(false)
                  }}
                >
                  {mode === 'dark' ? (
                    <svg className='h-4 w-4 text-accent' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z' />
                    </svg>
                  ) : (
                    <svg className='h-4 w-4 text-accent' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z' />
                    </svg>
                  )}
                  {mode === 'dark' ? '切换到亮色' : '切换到暗色'}
                </button>
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
              className='flex items-center justify-center rounded-full transition-all hover:ring-2 hover:ring-champagne/40 hover:ring-offset-2 hover:ring-offset-[var(--header-bg-1)] active:scale-[0.97]'
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
                      ? 'bg-gradient-to-br from-champagne to-champagne-dark text-[var(--header-on)] ring-2 ring-champagne/30'
                      : 'bg-gray-600 text-gray-300 ring-2 ring-gray-500/30'
                  }`}
                >
                  {getAvatarText()}
                </div>
              )}
            </button>
            {/* 登录状态指示器 */}
            {user && (
              <span className='absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full border-2 border-[var(--header-bg-1)] bg-success shadow-sm shadow-success/50 lg:h-3 lg:w-3' />
            )}
          </div>
        </nav>
      </div>
    </header>
  )
}
