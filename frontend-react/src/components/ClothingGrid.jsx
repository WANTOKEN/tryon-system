import { memo } from 'react'

import PropTypes from 'prop-types'

import { Icon } from './ui'

function formatPrice(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const n = Number(value)
  if (Number.isNaN(n)) {
    return String(value)
  }
  return `¥${n.toLocaleString('zh-CN')}`
}

function ClothingCard({
  item,
  variant = 'modal',
  isSelected,
  isFavorite,
  onToggleSelect,
  onToggleFavorite,
  showToast,
  t,
}) {
  const isShowcase = variant === 'showcase'
  const isWardrobe = variant === 'wardrobe'

  const imageUrl = item.image || (item.colors && item.colors[0]?.image) || null
  const name = item.name || item.category || t('clothingUnnamed')
  const sub = item.subcategory || item.brand || ''
  const price = formatPrice(item.price ?? item.price_min)
  const original = formatPrice(item.original_price ?? item.price_original)
  const popularity = item.popularity || item.try_count
  let colors = []
  if (Array.isArray(item.colors)) {
    colors = item.colors
  } else if (item.color) {
    colors = [{ color: item.color, name: item.colorName }]
  }

  const discount =
    original &&
    price &&
    Number(String(price).replace(/[^\d.]/g, '')) < Number(String(original).replace(/[^\d.]/g, ''))

  const handleSelect = () => {
    if (onToggleSelect) {
      onToggleSelect(item, !isSelected)
    } else if (showToast) {
      showToast(isSelected ? t('clothingDeselected') : t('n_clothingAdded', { name }))
    }
  }

  const handleFavorite = e => {
    e.stopPropagation()
    if (onToggleFavorite) {
      onToggleFavorite(item, !isFavorite)
    }
  }

  const cardClass = [
    'gc-card',
    'gc-scope',
    isShowcase ? 'gc-showcase' : '',
    isWardrobe ? 'gc-ob' : '',
    isSelected ? 'is-selected' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cardClass} role='listitem'>
      <div className={`gc-media${imageUrl ? '' : ' gc-media--placeholder'}`}>
        {imageUrl ? (
          <img src={imageUrl} alt={name} loading='lazy' />
        ) : (
          <div
            className='gc-placeholder-dot'
            style={{ background: colors[0]?.color || item.color || 'var(--gc-bg-secondary)' }}
          />
        )}

        {sub && !isWardrobe && <span className='gc-badge'>{sub}</span>}
        {discount && <span className='gc-badge gc-badge--discount'>{t('discountBadge')}</span>}
      </div>

      <button
        type='button'
        className={`gc-heart${isFavorite ? ' is-active' : ''}`}
        onClick={handleFavorite}
        aria-label={isFavorite ? t('unsave') : t('save')}
      >
        <Icon name={isFavorite ? 'heartFilled' : 'heart'} />
      </button>

      <div className='gc-body'>
        <div className='gc-title-row'>
          <span className='gc-name' title={name}>
            {name}
          </span>
          {isWardrobe && (
            <button type='button' className='gc-cta' onClick={handleSelect}>
              {isSelected ? t('remove') : t('tryOn')}
            </button>
          )}
        </div>

        {!isWardrobe && sub && <span className='gc-sub'>{sub}</span>}

        {colors.length > 0 && (
          <div className='gc-colors'>
            {colors.slice(0, 5).map(c => (
              <span
                key={c.color || c.name}
                className='gc-color-dot'
                style={{ background: c.color }}
                title={c.name || c.color}
              />
            ))}
            {colors.length > 5 && <span className='gc-color-more'>+{colors.length - 5}</span>}
          </div>
        )}

        {isShowcase && item.tags?.length > 0 && (
          <div className='gc-tags'>
            {item.tags.map(tag => (
              <span key={tag} className='gc-tag'>
                {tag}
              </span>
            ))}
          </div>
        )}

        {price && (
          <div className='gc-price-row'>
            <span className='gc-price'>{price}</span>
            {original && <span className='gc-price-original'>{original}</span>}
            {popularity !== null && popularity !== undefined && (
              <span className='gc-popularity'>{t('tryOnCount', { n: popularity })}</span>
            )}
          </div>
        )}

        {!isWardrobe && (
          <button
            type='button'
            className={`gc-cta${isSelected ? ' is-added' : ''}`}
            onClick={handleSelect}
          >
            {isSelected ? (
              <>
                <Icon name='check' className='h-4 w-4' />
                {t('selected')}
              </>
            ) : (
              <>
                <Icon name='plus' className='h-4 w-4' />
                {t('selectTryOn')}
              </>
            )}
          </button>
        )}

        {isShowcase && (
          <div className='gc-actions'>
            <button type='button' className='gc-cta' onClick={handleSelect}>
              {isSelected ? t('selected') : t('selectTryOn')}
            </button>
            <button type='button' className='gc-cta gc-cta--ghost'>
              {t('details')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ClothingGrid({
  items = [],
  variant = 'modal',
  selected = [],
  favorites = [],
  onToggleSelect,
  onToggleFavorite,
  showToast,
  t,
}) {
  const selectedIds = new Set(selected.map(s => s.id ?? s.image_key ?? s.key))
  const favoriteIds = new Set(favorites.map(f => f.id ?? f.image_key ?? f.key ?? f.uuid))

  if (!items.length) {
    return <div className='gc-empty'>{t('noClothing')}</div>
  }

  return (
    <div className={`gc-grid${variant === 'wardrobe' ? ' gc-grid--wardrobe' : ''}`} role='list'>
      {items.map(item => {
        const key = item.id ?? item.image_key ?? item.key ?? `${item.category}-${item.name}`
        return (
          <ClothingCard
            key={key}
            item={item}
            variant={variant}
            isSelected={selectedIds.has(key)}
            isFavorite={favoriteIds.has(key)}
            onToggleSelect={onToggleSelect}
            onToggleFavorite={onToggleFavorite}
            showToast={showToast}
            t={t}
          />
        )
      })}
    </div>
  )
}

ClothingGrid.propTypes = {
  items: PropTypes.arrayOf(PropTypes.object),
  variant: PropTypes.oneOf(['modal', 'wardrobe', 'showcase']),
  selected: PropTypes.arrayOf(PropTypes.object),
  favorites: PropTypes.arrayOf(PropTypes.object),
  onToggleSelect: PropTypes.func,
  onToggleFavorite: PropTypes.func,
  showToast: PropTypes.func,
  t: PropTypes.func.isRequired,
}

export default memo(ClothingGrid)
