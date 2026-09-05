import { useState } from 'react'

import PropTypes from 'prop-types'

import PreviewCanvas from '../sections/PreviewCanvas'
import { Icon } from '../ui'
import AvatarSourceModal from '../modals/AvatarSourceModal'

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
  onOpenPreviewModal,
  onReplaceClothing,
  onRemoveSelected,
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
      item: bySlot.tops,
      // 点击槽位直接跳到服装库对应类别
      category: 'tops',
      onClick: () => onOpenClothingLibrary('tops'),
    },
    {
      key: 'bottoms',
      label: t('slotBottoms') || '下装',
      filled: !!bySlot.bottoms,
      image: bySlot.bottoms?.image_url || bySlot.bottoms?.image,
      name: bySlot.bottoms?.name,
      item: bySlot.bottoms,
      category: 'bottoms',
      onClick: () => onOpenClothingLibrary('bottoms'),
    },
    {
      key: 'other',
      label: t('slotOther') || '其他',
      filled: !!bySlot.other,
      image: bySlot.other?.image_url || bySlot.other?.image,
      name: bySlot.other?.name,
      item: bySlot.other,
      // 「其他」是 dresses/outerwear/shoes/accessories 合并槽位，
      // 没有单一 category 值可筛，跳到全部
      category: 'all',
      onClick: () => onOpenClothingLibrary('all'),
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
              // 已填（服装）：与「我的形象」共用同一预览弹窗（flex 居中，无 transform 动画位移），
              // 底部带常驻操作按钮：更换 / 移出
              const actions = []
              if (slot.item) {
                actions.push({
                  key: 'replace',
                  title: t('replaceClothing') || '更换',
                  path: 'M4 4v6h6M20 20v-6h-6M20 10a8 8 0 00-15.5-2M4 14a8 8 0 0015.5 2',
                  onClick: () => onReplaceClothing?.(slot.item),
                })
              }
              // 只有拿到真实 id 才能移出（onRemoveSelected 按 id 定位），
              // 用严格比较替代 != null，同时排除 undefined 与 null
              const slotId = slot.item?.id
              if (slotId !== undefined && slotId !== null) {
                actions.push({
                  key: 'remove',
                  title: t('clear') || '移出',
                  path: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
                  onClick: () => onRemoveSelected?.(slotId),
                })
              }
              onOpenPreviewModal?.(slot.image, slot.name || slot.label, [], actions)
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
  recordId = null,
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
  // Result actions
  isResultSaved = false,
  onToggleHistorySaved,
  onRegenerate,
  status = 'idle',
  errorMessage = null,
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
  // Slot actions：槽位弹窗内的「更换 / 移出」
  onReplaceClothing,
  onRemoveSelected,
  // Common
  t,
}) {
  const [showAvatarSource, setShowAvatarSource] = useState(false)

  return (
    <main className='main-stage' role='main'>
      {/* 预览画布 */}
      <div className='relative'>
        <PreviewCanvas
          resultUrl={resultUrl}
          recordId={recordId}
          selectedClothing={selectedClothing}
          hasImage={hasImage}
          hasClothing={hasClothing}
          onOpenPreviewModal={onOpenPreviewModal}
          onClearSelection={onClearSelection}
          isResultSaved={isResultSaved}
          onToggleHistorySaved={onToggleHistorySaved}
          onRegenerate={onRegenerate}
          canTryOn={canTryOn}
          isGenerating={isGenerating}
          status={status}
          errorMessage={errorMessage}
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
                      {t('n_remainingTime', { n: remainingTime }) || `剩余 ${remainingTime} 秒`}
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

      {/* 添加图片槽位 - 形象 / 上装 / 下装 / 其他，与形象和服装库选择同步
          出图后依然常驻，否则结果页无法再换形象/换装，形成死胡同 */}
      <SlotRow
        avatarPreview={avatarPreview}
        selected={selectedClothing}
        onOpenModelModal={onOpenModelModal}
        onOpenClothingLibrary={onOpenClothingLibrary}
        onAvatarSource={() => setShowAvatarSource(true)}
        onOpenPreviewModal={onOpenPreviewModal}
        onReplaceClothing={onReplaceClothing}
        onRemoveSelected={onRemoveSelected}
        t={t}
      />

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

      {/* 生成按钮区域 - 常驻显示（出图后文案由 tryOnBtnText 切换为「重新生成」） */}
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
    </main>
  )
}

MainStage.propTypes = {
  resultUrl: PropTypes.string,
  recordId: PropTypes.string,
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
  isResultSaved: PropTypes.bool,
  onToggleHistorySaved: PropTypes.func,
  onRegenerate: PropTypes.func,
  status: PropTypes.string,
  errorMessage: PropTypes.string,
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
