import { useState } from 'react'

import PropTypes from 'prop-types'

import PreviewCanvas from '../sections/PreviewCanvas'
import { Icon } from '../ui'
import AvatarSourceModal from '../modals/AvatarSourceModal'
import ImageDisplayModal from '../modals/ImageDisplayModal'

// 服装 category -> 槽位 key 的映射
const SLOT_CATEGORY_MAP = {
  tops: 'tops',
  bottoms: 'bottoms',
  dresses: 'other',
  outerwear: 'other',
  shoes: 'other',
  accessories: 'other',
}

function SlotRow({
  avatarPreview,
  selected,
  onOpenModelModal,
  onOpenClothingLibrary,
  onAvatarSource,
  onOpenImageDisplay,
  t,
}) {
  // 把已选服装按槽位分组（每个 category 在 selected 中至多 1 件）
  const bySlot = { tops: null, bottoms: null, other: null }
  ;(selected || []).forEach(item => {
    const slotKey = SLOT_CATEGORY_MAP[item.category] || 'other'
    bySlot[slotKey] = item
  })

  const slots = [
    {
      key: 'model',
      label: t('slotModel') || '形象',
      filled: !!avatarPreview,
      image: avatarPreview,
      isModel: true,
      onClick: onAvatarSource || onOpenModelModal,
    },
    {
      key: 'tops',
      label: t('slotTops') || '上装',
      filled: !!bySlot.tops,
      image: bySlot.tops?.image_url || bySlot.tops?.image,
      name: bySlot.tops?.name,
      onClick: onOpenClothingLibrary,
    },
    {
      key: 'bottoms',
      label: t('slotBottoms') || '下装',
      filled: !!bySlot.bottoms,
      image: bySlot.bottoms?.image_url || bySlot.bottoms?.image,
      name: bySlot.bottoms?.name,
      onClick: onOpenClothingLibrary,
    },
    {
      key: 'other',
      label: t('slotOther') || '其他',
      filled: !!bySlot.other,
      image: bySlot.other?.image_url || bySlot.other?.image,
      name: bySlot.other?.name,
      onClick: onOpenClothingLibrary,
    },
  ]

  return (
    <div className='slot-row'>
      {slots.map(slot => (
        <button
          key={slot.key}
          type='button'
          className={`slot ${slot.filled ? 'slot-filled' : 'slot-empty'}`}
          onClick={() => {
            if (slot.isModel) {
              // 形象槽位：始终弹出「我的形象」模态框
              slot.onClick()
            } else if (slot.filled) {
              // 已填（服装）：打开图片展示模块框
              onOpenImageDisplay?.({
                src: slot.image,
                title: slot.name || slot.label,
              })
            } else {
              slot.onClick()
            }
          }}
          aria-label={slot.label}
        >
          <div className='slot-media'>
            {slot.image ? (
              <img src={slot.image} alt={slot.name || slot.label} className='slot-img' />
            ) : (
              <Icon name={slot.key === 'model' ? 'user' : 'plus'} className='slot-icon' />
            )}
          </div>
          <span className='slot-label'>{slot.label}</span>
          {slot.filled && slot.name && <span className='slot-name'>{slot.name}</span>}
        </button>
      ))}
    </div>
  )
}

export default function MainStage({
  // Preview
  resultUrl = null,
  selectedClothing,
  avatarPreview = null,
  hasImage,
  hasClothing,
  onOpenPreviewModal,
  onClearSelection,
  onOpenModelModal,
  onOpenClothingLibrary,
  onAvatarChange,
  onSetAvatarPreview,
  sessionId,
  showToast,
  onOpenImageDisplay: _onOpenImageDisplay,
  // Generate
  userConsent,
  onConsentChange,
  onShowDisclaimer,
  onTryOn,
  canTryOn,
  isGenerating,
  tryOnBtnText,
  // Actions
  onEndSession: _onEndSession,
  // Loading
  progress,
  remainingTime,
  // Common
  t,
}) {
  const [showAvatarSource, setShowAvatarSource] = useState(false)
  const [showImageDisplay, setShowImageDisplay] = useState(false)
  const [imageDisplayData, setImageDisplayData] = useState({ src: '', title: '' })

  return (
    <main className='main-stage' role='main'>
      {/* 预览画布 */}
      <div className='relative'>
        <PreviewCanvas
          resultUrl={resultUrl}
          selectedClothing={selectedClothing}
          hasImage={hasImage}
          hasClothing={hasClothing}
          onOpenPreviewModal={onOpenPreviewModal}
          onClearSelection={onClearSelection}
          t={t}
        />

        {/* 加载遮罩 */}
        {isGenerating && (
          <div className='absolute inset-0 flex items-center justify-center rounded-[var(--radius-xl)] bg-black/30 backdrop-blur-sm'>
            <div className='loading-overlay-simple'>
              <div className='loading-spinner-simple' />
              <p className='loading-text-simple'>{t('generating')}</p>
              {progress > 0 && (
                <>
                  <div className='loading-progress-container'>
                    <div
                      className='loading-progress-bar'
                      style={{ width: `${Math.min(progress, 95)}%` }}
                    />
                  </div>
                  {remainingTime > 0 && (
                    <p className='loading-countdown-simple'>
                      {t('remainingTime', { n: remainingTime }) || `${remainingTime}s`}
                    </p>
                  )}
                  {remainingTime === 0 && progress > 0 && progress < 100 && (
                    <p className='mt-2 text-xs font-medium text-[var(--accent)]'>
                      {t('finishing') || '即将完成...'}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 添加图片槽位 - 形象 / 上装 / 下装 / 其他，与形象和服装库选择同步 */}
      {!resultUrl && (
        <SlotRow
          avatarPreview={avatarPreview}
          selected={selectedClothing}
          onOpenModelModal={onOpenModelModal}
          onOpenClothingLibrary={onOpenClothingLibrary}
          onAvatarSource={() => setShowAvatarSource(true)}
          onOpenImageDisplay={data => {
            setImageDisplayData(data)
            setShowImageDisplay(true)
          }}
          t={t}
        />
      )}

      {/* 形象来源选择弹窗：复用形象来源弹窗（与左侧「我的形象」一致） */}
      <AvatarSourceModal
        isOpen={showAvatarSource}
        onClose={() => {
          setShowAvatarSource(false)
        }}
        avatarPreview={avatarPreview}
        onAvatarChange={onAvatarChange}
        onSetAvatarPreview={onSetAvatarPreview}
        onOpenPreviewModal={onOpenPreviewModal}
        onShowModelModal={onOpenModelModal}
        sessionId={sessionId}
        showToast={showToast}
        t={t}
      />

      {/* 图片展示模块框：槽位复用 */}
      <ImageDisplayModal
        isOpen={showImageDisplay}
        onClose={() => setShowImageDisplay(false)}
        src={imageDisplayData.src}
        title={imageDisplayData.title}
        t={t}
      />

      {/* 生成按钮区域 - 常驻显示 */}
      {!resultUrl && (
        <div className='generate-section-simple'>
          {/* 免责声明复选框 - 常驻显示，必须勾选才能开始试穿 */}
          <div className='consent-row'>
            <input
              type='checkbox'
              id='main-consent'
              checked={userConsent}
              onChange={e => onConsentChange(e.target.checked)}
              className='checkbox-simple'
            />
            <label htmlFor='main-consent' className='consent-label'>
              <span>{t('tryOnConsentText') || '我已阅读并同意以上试穿服务免责声明'}</span>
              <button type='button' onClick={onShowDisclaimer} className='consent-link'>
                {t('viewDisclaimer') || '《服务免责声明》'}
              </button>
            </label>
          </div>

          {/* 生成按钮 + 次级操作 同一行 */}
          <div className='generate-cta-row'>
            {/* 生成按钮 - 常驻显示，未勾选协议或条件不足时置灰 */}
            <button
              type='button'
              className={`generate-btn-simple ${isGenerating ? 'loading' : ''}`}
              onClick={onTryOn}
              disabled={!canTryOn || isGenerating || !userConsent}
            >
              {isGenerating ? (
                <>
                  <Icon name='loader' className='h-4 w-4 animate-spin' />
                  {t('generating')}
                </>
              ) : (
                <>
                  <Icon name='sparkle' className='h-4 w-4' />
                  {tryOnBtnText}
                </>
              )}
            </button>
            {/* 清除按钮（仅图标）：重置槽位与预览框 */}
            <div className='tryon-actions-row'>
              <button
                type='button'
                className='tryon-action-btn'
                onClick={onClearSelection}
                disabled={isGenerating}
                aria-label={t('clear') || '清空'}
                title={t('clear') || '清空'}
              >
                <Icon name='trash' className='h-4 w-4' />
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

MainStage.propTypes = {
  resultUrl: PropTypes.string,
  selectedClothing: PropTypes.arrayOf(PropTypes.object).isRequired,
  avatarPreview: PropTypes.string,
  hasImage: PropTypes.bool.isRequired,
  hasClothing: PropTypes.bool.isRequired,
  onOpenPreviewModal: PropTypes.func.isRequired,
  onClearSelection: PropTypes.func.isRequired,
  onOpenModelModal: PropTypes.func,
  onOpenClothingLibrary: PropTypes.func,
  onAvatarChange: PropTypes.func,
  onSetAvatarPreview: PropTypes.func,
  sessionId: PropTypes.string,
  showToast: PropTypes.func,
  onOpenImageDisplay: PropTypes.func,
  userConsent: PropTypes.bool.isRequired,
  onConsentChange: PropTypes.func.isRequired,
  onShowDisclaimer: PropTypes.func.isRequired,
  onTryOn: PropTypes.func.isRequired,
  canTryOn: PropTypes.bool.isRequired,
  isGenerating: PropTypes.bool.isRequired,
  tryOnBtnText: PropTypes.string.isRequired,
  onEndSession: PropTypes.func,
  progress: PropTypes.number.isRequired,
  remainingTime: PropTypes.number.isRequired,
  t: PropTypes.func.isRequired,
}
