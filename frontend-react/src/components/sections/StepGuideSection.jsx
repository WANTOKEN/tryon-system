import PropTypes from 'prop-types'

import { Icon } from '../ui'

export default function StepGuideSection({ hasImage, t }) {
  if (hasImage) {
    return null
  }

  return (
    <div className='sidebar-section'>
      <div className='step-card to-[var(--bg-tertiary)]/50 rounded-xl border border-[var(--border-primary)] bg-gradient-to-br from-[var(--bg-secondary)] p-4'>
        <div className='mb-2 flex items-center gap-2 text-[var(--accent)]'>
          <Icon name='info' className='h-5 w-5' />
          <span className='font-medium'>{t('step1') || '第一步：上传形象'}</span>
        </div>
        <p className='text-[var(--text-secondary)]/80 text-xs leading-relaxed'>
          {t('stepUploadAvatar') || '请先上传您的形象照片或选择系统模特，开始AI试穿体验'}
        </p>
      </div>
    </div>
  )
}

StepGuideSection.propTypes = {
  hasImage: PropTypes.bool.isRequired,
  t: PropTypes.func.isRequired,
}
