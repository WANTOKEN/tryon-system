import PropTypes from 'prop-types'

import { Modal, Icon } from '../ui'
import CachedImage from '../CachedImage'

export default function HistoryModal({
  isOpen,
  onClose,
  history,
  historyFilter,
  onFilterChange,
  onClearHistory,
  onToggleSaved,
  onDelete,
  onPreview,
  formatTime,
  t,
}) {
  const filteredHistory =
    historyFilter === 'saved' ? (history || []).filter(r => r.is_saved || r.saved) : history || []
  const savedCount = (history || []).filter(r => r.is_saved || r.saved).length

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className='flex items-center gap-3'>
          <span>{t('tryOnHistory')}</span>
          <span className='rounded-full bg-[var(--bg-secondary)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-muted)]'>
            {filteredHistory.length}
          </span>
        </div>
      }
      size='lg'
    >
      {/* 筛选和操作 */}
      <div className='mb-4 flex items-center justify-between'>
        <div className='flex rounded-lg bg-[var(--bg-secondary)] p-1'>
          <button
            type='button'
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              historyFilter === 'all'
                ? 'bg-[var(--bg-card)] text-charcoal shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
            onClick={() => onFilterChange('all')}
          >
            全部
          </button>
          <button
            type='button'
            className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              historyFilter === 'saved'
                ? 'bg-[var(--bg-card)] text-[var(--accent-strong)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
            onClick={() => onFilterChange('saved')}
          >
            <Icon name='heart' className='h-3 w-3' />
            {savedCount}
          </button>
        </div>

        {(history || []).length > 0 && (
          <button
            type='button'
            className='rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-red-500'
            onClick={onClearHistory}
            title='清空记录'
          >
            <Icon name='trash' className='h-4 w-4' />
          </button>
        )}
      </div>

      {/* 历史记录列表 */}
      {filteredHistory.length === 0 ? (
        <div className='flex flex-col items-center justify-center py-20 text-center'>
          <div className='mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--bg-secondary)]'>
            <Icon name='clock' className='h-10 w-10 text-[var(--text-tertiary)]' />
          </div>
          <p className='text-[var(--text-muted)]'>
            {historyFilter === 'saved' ? t('noSaved') : t('noHistory')}
          </p>
        </div>
      ) : (
        <div className='grid grid-cols-2 gap-4 md:grid-cols-3'>
          {filteredHistory.map(record => {
            const names = record.clothing?.map(c => c.clothing_name || c.name).join(' + ') || ''
            const imgSrc =
              record.result_thumb_url ||
              record.result_url ||
              record.userImageThumb ||
              record.userImage ||
              ''
            const recordId = record.uuid || record.id
            const isSaved = record.is_saved || record.saved

            return (
              <div
                key={recordId}
                className='group relative overflow-hidden rounded-xl bg-[var(--bg-card)] shadow-sm transition-shadow hover:shadow-md'
              >
                {/* 图片区域 */}
                <div
                  className='relative aspect-[3/4] cursor-pointer overflow-hidden'
                  onClick={() => imgSrc && onPreview(imgSrc, names)}
                  role='button'
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      if (imgSrc) {
                        onPreview(imgSrc, names)
                      }
                    }
                  }}
                >
                  {imgSrc ? (
                    <CachedImage
                      src={imgSrc}
                      alt={names}
                      className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
                    />
                  ) : (
                    <div className='flex h-full w-full items-center justify-center bg-[var(--bg-secondary)] text-[var(--text-tertiary)]'>
                      <Icon name='image' className='h-10 w-10' />
                    </div>
                  )}

                  {/* 悬浮操作层 */}
                  <div className='absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100'>
                    <button
                      type='button'
                      onClick={e => {
                        e.stopPropagation()
                        if (imgSrc) {
                          onPreview(imgSrc, names)
                        }
                      }}
                      className='flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg-card)] text-[var(--text-secondary)] shadow-lg transition-transform hover:scale-110'
                    >
                      <Icon name='eye' className='h-4 w-4' />
                    </button>
                    <button
                      type='button'
                      className={`flex h-9 w-9 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110 ${
                        isSaved
                          ? 'bg-[var(--accent-strong)] text-white'
                          : 'bg-[var(--bg-card)] text-[var(--text-secondary)]'
                      }`}
                      onClick={e => {
                        e.stopPropagation()
                        onToggleSaved(recordId, !isSaved)
                      }}
                    >
                      <Icon
                        name={isSaved ? 'heartFilled' : 'heart'}
                        className='h-4 w-4'
                        fill={isSaved ? 'currentColor' : 'none'}
                      />
                    </button>
                    <button
                      type='button'
                      className='flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg-card)] text-red-500 shadow-lg transition-transform hover:scale-110'
                      onClick={e => {
                        e.stopPropagation()
                        onDelete(recordId)
                      }}
                    >
                      <Icon name='trash' className='h-4 w-4' />
                    </button>
                  </div>

                  {/* 收藏标记 */}
                  {isSaved && (
                    <div className='absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent-strong)] text-white shadow-md'>
                      <Icon name='heartFilled' className='h-3 w-3' />
                    </div>
                  )}
                </div>

                {/* 底部信息 */}
                <div className='border-t border-[var(--border-primary)] p-3'>
                  <p className='truncate text-xs font-medium text-[var(--text-secondary)]'>
                    {names || '未选择服装'}
                  </p>
                  <p className='mt-1 text-[11px] text-[var(--text-muted)]'>
                    {formatTime(record.created_at)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}

HistoryModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  history: PropTypes.arrayOf(PropTypes.object).isRequired,
  historyFilter: PropTypes.oneOf(['all', 'saved']).isRequired,
  onFilterChange: PropTypes.func.isRequired,
  onClearHistory: PropTypes.func.isRequired,
  onToggleSaved: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onPreview: PropTypes.func.isRequired,
  formatTime: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
}
