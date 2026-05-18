import PropTypes from 'prop-types'

import CachedImage from '../CachedImage'
import { Icon } from '../ui'

export default function SelectedClothingSection({
  selected,
  customClothing = [],
  wardrobeClothing = [],
  onRemoveSelected,
  onClearSelection,
  onOpenPreviewModal,
  t,
}) {
  const allClothing = [...(customClothing || []), ...(wardrobeClothing || [])]

  if (selected.length === 0) {
    return null
  }

  return (
    <div className='sidebar-section'>
      <div className='mb-3 flex items-center justify-between'>
        <span className='sidebar-section-title' style={{ margin: 0 }}>
          {t('selectedClothing')}
        </span>
        <button
          type='button'
          className='text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--error)]'
          onClick={onClearSelection}
        >
          {t('clearSelection')}
        </button>
      </div>

      <div className='selected-list-simple'>
        {selected.map(item => {
          const customItem = allClothing.find(c => c.id === item.id)
          const displayImage =
            customItem?.image ||
            customItem?.imageFull ||
            item.image_url ||
            item.image_thumb_url ||
            item.image ||
            item.imageFull

          return (
            <div key={item.id} className='selected-item-simple'>
              <div
                className='selected-item-thumb cursor-pointer'
                style={{ backgroundColor: item.color || 'var(--bg-tertiary)' }}
                onClick={() => displayImage && onOpenPreviewModal(displayImage, item.name)}
                role='button'
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    if (displayImage) {
                      onOpenPreviewModal(displayImage, item.name)
                    }
                  }
                }}
              >
                {displayImage && (
                  <CachedImage
                    src={displayImage}
                    alt={item.name}
                    className='h-full w-full rounded-[var(--radius-sm)] object-cover'
                  />
                )}
              </div>
              <span className='selected-item-name'>{item.name}</span>
              <button
                type='button'
                className='selected-item-remove'
                onClick={() => onRemoveSelected(item.id)}
                title={t('clear')}
              >
                <Icon name='close' className='h-3.5 w-3.5' />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

SelectedClothingSection.propTypes = {
  selected: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      name: PropTypes.string.isRequired,
      category: PropTypes.string.isRequired,
      color: PropTypes.string,
      image_url: PropTypes.string,
      image_thumb_url: PropTypes.string,
      image: PropTypes.string,
      imageFull: PropTypes.string,
    })
  ).isRequired,
  customClothing: PropTypes.arrayOf(PropTypes.object),
  wardrobeClothing: PropTypes.arrayOf(PropTypes.object),
  onRemoveSelected: PropTypes.func.isRequired,
  onClearSelection: PropTypes.func.isRequired,
  onOpenPreviewModal: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
}
