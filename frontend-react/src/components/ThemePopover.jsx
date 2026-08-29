import PropTypes from 'prop-types'

import { THEMES } from '../hooks/useTheme'

import { Icon } from './ui'

export default function ThemePopover({
  theme,
  mode,
  onThemeChange,
  onToggleMode,
  onClose: _onClose,
  t,
}) {
  return (
    <div
      className='theme-popover'
      onClick={e => e.stopPropagation()}
      onKeyDown={e => e.stopPropagation()}
      role='menu'
      tabIndex={-1}
      aria-label={t('settingsTheme') || '主题'}
    >
      <div className='theme-popover-section'>
        <p className='theme-popover-label'>{t('settingsThemeColor') || '主题色'}</p>
        <div className='theme-popover-colors'>
          {THEMES.map(item => {
            const active = item.key === theme
            return (
              <button
                key={item.key}
                type='button'
                className={`theme-color-dot${active ? ' is-active' : ''}`}
                style={{ background: item.primary }}
                onClick={() => onThemeChange(item.key)}
                title={item.name}
                aria-label={item.name}
                aria-pressed={active}
              >
                {active && <Icon name='check' className='h-3.5 w-3.5 text-white' />}
              </button>
            )
          })}
        </div>
      </div>

      <div className='theme-popover-section theme-popover-mode'>
        <p className='theme-popover-label'>{t('settingsMode') || '明暗'}</p>
        <button
          type='button'
          className='theme-mode-btn'
          onClick={onToggleMode}
          aria-label={mode === 'dark' ? t('modeLight') : t('modeDark')}
        >
          <Icon name={mode === 'dark' ? 'sun' : 'moon'} className='h-4 w-4' />
          <span>{mode === 'dark' ? t('modeLight') || '浅色' : t('modeDark') || '深色'}</span>
        </button>
      </div>
    </div>
  )
}

ThemePopover.propTypes = {
  theme: PropTypes.string.isRequired,
  mode: PropTypes.string.isRequired,
  onThemeChange: PropTypes.func.isRequired,
  onToggleMode: PropTypes.func.isRequired,
  onClose: PropTypes.func,
  t: PropTypes.func.isRequired,
}
