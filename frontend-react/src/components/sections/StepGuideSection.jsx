import PropTypes from 'prop-types'

import { Icon } from '../ui'

export default function StepGuideSection({ hasImage, t }) {
  if (hasImage) {
    return null
  }

  return (
    <div className='sidebar-section'>
      <div className='step-card rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-blue-100/50 p-4'>
        <div className='mb-2 flex items-center gap-2 text-blue-700'>
          <Icon name='info' className='h-5 w-5' />
          <span className='font-medium'>{t('step1') || '第一步：上传形象'}</span>
        </div>
        <p className='text-xs leading-relaxed text-blue-600/80'>
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
