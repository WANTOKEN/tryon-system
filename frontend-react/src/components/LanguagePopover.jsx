import PropTypes from 'prop-types'

import { languages } from '../hooks/useI18n'

import { Icon } from './ui'

/**
 * 语言选择弹层（内容组件，定位由父级负责）。
 */
export default function LanguagePopover({ current, onChange, onClose, t }) {
  return (
    <div
      className='popover-panel lang-popover'
      onClick={e => e.stopPropagation()}
      onKeyDown={e => e.stopPropagation()}
      role='presentation'
      tabIndex={-1}
    >
      <div className='popover-section-label'>{t?.('settingsLanguage') || '语言'}</div>
      <div className='lang-option-list'>
        {languages.map(lang => (
          <button
            key={lang.code}
            type='button'
            className={`lang-option${current === lang.code ? ' is-active' : ''}`}
            onClick={() => {
              onChange(lang.code)
              onClose?.()
            }}
          >
            <span className='lang-option-label'>{lang.name}</span>
            {current === lang.code && <Icon name='check' className='h-4 w-4' />}
          </button>
        ))}
      </div>
    </div>
  )
}

LanguagePopover.propTypes = {
  current: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  onClose: PropTypes.func,
  t: PropTypes.func,
}
