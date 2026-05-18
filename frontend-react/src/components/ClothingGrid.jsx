import { useState, useMemo } from 'react'

import CachedImage from './CachedImage'

export default function ClothingGrid({ clothing, selected, onToggleSelect }) {
  const [showModal, setShowModal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  const categories = useMemo(() => {
    const cats = {}
    clothing.forEach(item => {
      if (!cats[item.category]) {
        cats[item.category] = []
      }
      cats[item.category].push(item)
    })
    return cats
  }, [clothing])

  const categoryNames = {
    tops: '上装',
    bottoms: '下装',
    dresses: '连衣裙',
    outerwear: '外套',
    shoes: '鞋',
    accessories: '配饰',
  }

  const filteredClothing = useMemo(() => {
    if (!selectedCategory) {
      return []
    }
    let items = categories[selectedCategory] || []
    if (searchQuery) {
      items = items.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
    }
    return items
  }, [selectedCategory, categories, searchQuery])

  const handleCategoryClick = category => {
    setSelectedCategory(category)
    setSearchQuery('')
    setShowModal(true)
  }

  const handleClothingSelect = item => {
    onToggleSelect(item)
    setShowModal(false)
  }

  const formatPrice = price => {
    if (!price || price === 0) {
      return '未定价'
    }
    return `¥${parseFloat(price).toFixed(2)}`
  }

  const formatSizes = sizes => {
    if (!sizes) {
      return '未标注'
    }
    return sizes
      .split(',')
      .filter(s => s.trim())
      .join(' / ')
  }

  if (clothing.length === 0) {
    return (
      <div className='py-12 text-center'>
        <svg
          className='mx-auto mb-4 h-16 w-16 text-grayLight dark:text-gray-600'
          fill='none'
          viewBox='0 0 24 24'
          stroke='currentColor'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={1}
            d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
          />
        </svg>
        <p className='text-grayMedium dark:text-gray-400'>衣橱为空</p>
        <p className='mt-1 text-sm text-grayMuted dark:text-gray-500'>点击上方"添加服装"上传</p>
      </div>
    )
  }

  return (
    <>
      <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4'>
        {Object.keys(categories).map(category => (
          <button
            type='button'
            key={category}
            onClick={() => handleCategoryClick(category)}
            className='clothing-card transition-shadow hover:shadow-lg'
          >
            <div className='relative aspect-square overflow-hidden rounded-lg bg-grayLight/50 dark:bg-gray-700/50'>
              {categories[category][0]?.image || categories[category][0]?.image_url ? (
                <CachedImage
                  src={categories[category][0].image || categories[category][0].image_url}
                  alt={categoryNames[category]}
                  className='h-full w-full object-cover'
                  lazy
                />
              ) : (
                <div className='flex h-full w-full items-center justify-center text-grayMuted'>
                  <svg className='h-8 w-8' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={1.5}
                      d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
                    />
                  </svg>
                </div>
              )}
              <div className='absolute inset-0 flex items-center justify-center bg-black/40'>
                <span className='text-lg font-semibold text-white'>{categoryNames[category]}</span>
              </div>
            </div>
            <div className='absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent p-2'>
              <p className='truncate text-xs font-medium text-white'>
                {categories[category].length} 件
              </p>
            </div>
          </button>
        ))}
      </div>

      {showModal && (
        <div
          className='fixed inset-0 z-[70] flex items-center justify-center p-4'
          role='dialog'
          aria-modal='true'
        >
          <div
            className='absolute inset-0 bg-black/50 backdrop-blur-sm'
            onClick={() => setShowModal(false)}
            onKeyDown={e => {
              if (e.key === 'Escape') {
                setShowModal(false)
              }
            }}
            role='button'
            tabIndex={-1}
            aria-label='关闭'
          />
          <div className='relative flex max-h-[80vh] w-full max-w-4xl animate-scale-in flex-col overflow-hidden rounded-2xl bg-white shadow-2xl'>
            <div className='flex items-center justify-between border-b border-grayLight px-6 py-4'>
              <h2 className='text-lg font-semibold text-charcoal'>
                {categoryNames[selectedCategory]}
              </h2>
              <button
                type='button'
                onClick={() => setShowModal(false)}
                className='rounded-lg p-1.5 transition-colors hover:bg-gray-100'
                aria-label='关闭'
              >
                <svg
                  className='h-5 w-5 text-grayMedium'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M6 18L18 6M6 6l12 12'
                  />
                </svg>
              </button>
            </div>

            <div className='border-b border-grayLight px-6 py-3'>
              <div className='relative'>
                <svg
                  className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grayMuted'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
                  />
                </svg>
                <input
                  type='text'
                  placeholder='搜索服装...'
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className='w-full rounded-lg border border-grayLight py-2 pl-10 pr-4 focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/20'
                />
              </div>
            </div>

            <div className='flex-1 overflow-y-auto p-6'>
              {filteredClothing.length === 0 ? (
                <div className='py-12 text-center'>
                  <p className='text-grayMuted'>没有找到服装</p>
                </div>
              ) : (
                <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4'>
                  {filteredClothing.map(item => {
                    const isSelected = selected.some(s => s.uuid === item.uuid)
                    return (
                      <button
                        type='button'
                        key={item.uuid}
                        onClick={() => handleClothingSelect(item)}
                        className={`clothing-card ${isSelected ? 'selected' : ''}`}
                      >
                        <div className='aspect-square overflow-hidden rounded-lg bg-grayLight/50 dark:bg-gray-700/50'>
                          {item.image || item.image_url ? (
                            <CachedImage
                              src={item.image || item.image_url}
                              alt={item.name}
                              className='h-full w-full object-cover'
                              lazy
                            />
                          ) : (
                            <div className='flex h-full w-full items-center justify-center text-grayMuted'>
                              <svg
                                className='h-8 w-8'
                                fill='none'
                                viewBox='0 0 24 24'
                                stroke='currentColor'
                              >
                                <path
                                  strokeLinecap='round'
                                  strokeLinejoin='round'
                                  strokeWidth={1.5}
                                  d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
                                />
                              </svg>
                            </div>
                          )}
                        </div>

                        <div className='check-mark'>
                          <svg fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth={3}
                              d='M5 13l4 4L19 7'
                            />
                          </svg>
                        </div>

                        <div className='absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2'>
                          <p className='truncate text-xs font-medium text-white'>{item.name}</p>
                          <div className='mt-1 flex items-center justify-between'>
                            <p className='text-xs font-semibold text-champagne'>
                              {formatPrice(item.price)}
                            </p>
                            {item.sizes && (
                              <p className='ml-1 truncate text-xs text-white/80'>
                                {formatSizes(item.sizes)}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
