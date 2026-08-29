import { useState, useRef, useEffect } from 'react'

import PropTypes from 'prop-types'

import { useI18n } from '../hooks/useI18n'

import BrandLogo from './BrandLogo'
import ThemePopover from './ThemePopover'
import LanguagePopover from './LanguagePopover'
import { Icon } from './ui'

function Header({
  user,
  sessionCustomer,
  onOpenSettings,
  onEndSession,
  onOpenHistory,
  history: _history = [],
  theme,
  mode,
  onThemeChange,
  onToggleMode,
}) {
  const { locale, changeLocale, t } = useI18n()
  const [showTheme, setShowTheme] = useState(false)
  const [showLang, setShowLang] = useState(false)
  const themeWrapRef = useRef(null)
  const langWrapRef = useRef(null)

  useEffect(() => {
    if (!showTheme && !showLang) {
      return undefined
    }
    const handler = e => {
      if (showTheme && themeWrapRef.current && !themeWrapRef.current.contains(e.target)) {
        setShowTheme(false)
      }
      if (showLang && langWrapRef.current && !langWrapRef.current.contains(e.target)) {
        setShowLang(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showTheme, showLang])

  const isSessionActive = !!sessionCustomer

  let userTitle
  if (isSessionActive) {
    userTitle = t('currentCustomer')
  } else if (user) {
    userTitle = user.store_name || user.phone || t('myAccount')
  } else {
    userTitle = t('login')
  }

  return (
    <header className='app-header'>
      {/* 左：品牌 */}
      <div className='header-brand'>
        <BrandLogo size={32} className='header-logo' />
        <div className='header-brand-text'>
          <span className='header-title'>{t('appTitle')}</span>
          <span className='header-subtitle'>{t('appSubtitle')}</span>
        </div>
      </div>

      {/* 右：操作区 */}
      <div className='header-actions'>
        {/* 工具组 */}
        <div className='header-tool-group'>
          <button
            type='button'
            className='header-icon-btn'
            onClick={onOpenHistory}
            title={t('history')}
            aria-label={t('history')}
          >
            <Icon name='history' className='h-5 w-5' />
          </button>

          <div className='header-popover-wrap' ref={langWrapRef}>
            <button
              type='button'
              className={`header-icon-btn${showLang ? ' is-active' : ''}`}
              onClick={() => setShowLang(v => !v)}
              title={t('settingsLanguage')}
              aria-label={t('settingsLanguage')}
            >
              <Icon name='globe' className='h-5 w-5' />
            </button>
            {showLang && (
              <LanguagePopover
                current={locale}
                onChange={changeLocale}
                onClose={() => setShowLang(false)}
                t={t}
              />
            )}
          </div>

          <div className='header-popover-wrap' ref={themeWrapRef}>
            <button
              type='button'
              className={`header-icon-btn${showTheme ? ' is-active' : ''}`}
              onClick={() => setShowTheme(v => !v)}
              title={t('settingsTheme')}
              aria-label={t('settingsTheme')}
            >
              <Icon name='palette' className='h-5 w-5' />
            </button>
            {showTheme && (
              <ThemePopover
                theme={theme}
                mode={mode}
                onThemeChange={onThemeChange}
                onToggleMode={onToggleMode}
                onClose={() => setShowTheme(false)}
                t={t}
              />
            )}
          </div>
        </div>

        <span className='header-divider' />

        {/* 用户区：仅展示圆形头像按钮，点击打开设置 */}
        <button
          type='button'
          className='header-user-circle'
          onClick={onOpenSettings}
          title={userTitle}
          aria-label={t('settingsTitle')}
        >
          <Icon name='user' className='h-4 w-4' />
        </button>

        {/* 结束会话（仅会话活跃时） */}
        {isSessionActive && (
          <button
            type='button'
            className='header-icon-btn header-end-session'
            onClick={onEndSession}
            title={t('endSession')}
            aria-label={t('endSession')}
          >
            <Icon name='logout' className='h-5 w-5' />
          </button>
        )}
      </div>
    </header>
  )
}

Header.propTypes = {
  user: PropTypes.object,
  sessionCustomer: PropTypes.string,
  onOpenSettings: PropTypes.func.isRequired,
  onEndSession: PropTypes.func,
  onOpenHistory: PropTypes.func.isRequired,
  history: PropTypes.arrayOf(PropTypes.object),
  theme: PropTypes.string.isRequired,
  mode: PropTypes.string.isRequired,
  onThemeChange: PropTypes.func.isRequired,
  onToggleMode: PropTypes.func.isRequired,
}

export default Header
