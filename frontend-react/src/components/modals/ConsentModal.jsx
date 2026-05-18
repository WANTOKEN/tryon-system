import PropTypes from 'prop-types'

import { Modal, Button } from '../ui'

export default function ConsentModal({ isOpen, onClose, onAgree, t }) {
  const sections = [
    {
      title: t('disclaimerSection1Title') || '1. 服务说明',
      content:
        t('disclaimerSection1Content') ||
        'AI虚拟试衣服务使用人工智能技术生成试穿效果，结果仅供参考。实际穿着效果可能因光线、角度、面料、体型差异等因素与生成结果有所不同。',
    },
    {
      title: t('disclaimerSection2Title') || '2. 上传内容授权',
      content:
        t('disclaimerSection2Content') ||
        '您上传的照片仅用于AI虚拟试衣服务，我们承诺不会将您的照片用于其他商业用途或分享给第三方。',
    },
    {
      title: t('disclaimerSection3Title') || '3. 隐私保护',
      content:
        t('disclaimerSection3Content') ||
        '我们采用加密技术保护您的数据安全，严格遵守相关隐私保护法律法规。您可随时要求删除您的数据。',
    },
    {
      title: t('disclaimerSection4Title') || '4. 责任限制',
      content:
        t('disclaimerSection4Content') ||
        '在法律允许的最大范围内，我们对因使用本服务而产生的任何直接或间接损失不承担责任。',
    },
  ]

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('serviceDisclaimer') || '服务免责声明'}
      size='sm'
      footer={
        <>
          <Button variant='secondary' onClick={onClose}>
            {t('close') || '关闭'}
          </Button>
          <Button
            variant='primary'
            onClick={() => {
              onAgree()
              onClose()
            }}
          >
            {t('agree') || '同意'}
          </Button>
        </>
      }
    >
      <div className='space-y-4 text-sm text-gray-700'>
        {sections.map(section => (
          <div key={section.title}>
            <p className='font-medium'>{section.title}</p>
            <p className='leading-relaxed'>{section.content}</p>
          </div>
        ))}
      </div>
    </Modal>
  )
}

ConsentModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onAgree: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
}
