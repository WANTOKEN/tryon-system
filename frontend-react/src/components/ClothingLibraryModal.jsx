import { useState, useMemo, useCallback } from 'react'

import CachedImage from './CachedImage'

export default function ClothingLibraryModal({
  isOpen,
  onClose,
  clothing,
  customClothing,
  wardrobeClothing,
  selected,
  onToggleSelect,
  onRemoveSelected,
  categories,
  t,
}) {
  const [currentCategory, setCurrentCategory] = useState('tops')
  const [currentSubcategory, setCurrentSubcategory] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')

  // 默认分类
  const defaultCategories = [
    { id: 'tops', name: t('cat_tops') || '上装', i18nKey: 'cat_tops' },
    { id: 'bottoms', name: t('cat_bottoms') || '下装', i18nKey: 'cat_bottoms' },
    { id: 'dresses', name: t('cat_dresses') || '连衣裙', i18nKey: 'cat_dresses' },
    { id: 'outerwear', name: t('cat_outerwear') || '外套', i18nKey: 'cat_outerwear' },
    { id: 'shoes', name: t('cat_shoes') || '鞋', i18nKey: 'cat_shoes' },
    { id: 'accessories', name: t('cat_accessories') || '配饰', i18nKey: 'cat_accessories' },
  ]

  // 使用传入的分类或默认分类
  const displayCategories = categories && categories.length > 0 ? categories : defaultCategories

  // 为每个分类添加"全部"子分类
  const allCategories = displayCategories.map(cat => ({
    ...cat,
    subcategories: [{ id: '', name: t('all') || '全部' }, ...(cat.subcategories || [])],
  }))

  // 搜索匹配函数
  const matchKeyword = useCallback((item, keyword) => {
    if (!keyword) {
      return true
    }
    const k = keyword.toLowerCase()
    const name = (item.name || '').toLowerCase()
    const colorName = (item.color_name || '').toLowerCase()
    const categoryName = (item.category || '').toLowerCase()
    return name.includes(k) || colorName.includes(k) || categoryName.includes(k)
  }, [])

  // 服装过滤
  const filterByCategoryAndSubcategory = useCallback(
    item => {
      if (currentCategory && item.category !== currentCategory) {
        return false
      }
      if (currentSubcategory && item.subcategory !== currentSubcategory) {
        return false
      }
      return true
    },
    [currentCategory, currentSubcategory]
  )

  // 获取当前分类的服装列表
  const getCategoryClothes = useCallback(() => {
    if (searchKeyword) {
      return clothing.filter(c => matchKeyword(c, searchKeyword))
    }
    if (!currentCategory) {
      return clothing
    }
    return clothing.filter(filterByCategoryAndSubcategory)
  }, [clothing, searchKeyword, matchKeyword, filterByCategoryAndSubcategory, currentCategory])

  // 自定义服装
  const getCustomClothes = useCallback(() => {
    const customList = customClothing || []
    if (searchKeyword) {
      return customList.filter(c => matchKeyword(c, searchKeyword))
    }
    if (!currentCategory) {
      return customList
    }
    return customList.filter(filterByCategoryAndSubcategory)
  }, [customClothing, searchKeyword, matchKeyword, filterByCategoryAndSubcategory, currentCategory])

  // 衣橱服装
  const getWardrobeClothes = useCallback(() => {
    const wardrobeList = wardrobeClothing || []
    if (searchKeyword) {
      return wardrobeList.filter(c => matchKeyword(c, searchKeyword))
    }
    if (!currentCategory) {
      return wardrobeList
    }
    return wardrobeList.filter(filterByCategoryAndSubcategory)
  }, [
    wardrobeClothing,
    searchKeyword,
    matchKeyword,
    filterByCategoryAndSubcategory,
    currentCategory,
  ])

  // 合并所有服装
  const allClothes = useMemo(() => {
    const categoryClothes = getCategoryClothes()
    const customClothes = getCustomClothes()
    const wardrobeClothes = getWardrobeClothes()
    const seen = new Set()
    return [...categoryClothes, ...wardrobeClothes, ...customClothes].filter(item => {
      const key = item.id || item.uuid
      if (key && !seen.has(key)) {
        seen.add(key)
        return true
      }
      return false
    })
  }, [getCategoryClothes, getCustomClothes, getWardrobeClothes])

  // 判断是否选中
  const isSelected = useCallback(
    id => selected.some(item => item.id === id || item.uuid === id),
    [selected]
  )

  // 切换选中（同类型只允许一件）
  const handleToggle = useCallback(
    item => {
      if (!item || (item.id === undefined && item.uuid === undefined)) {
        console.warn('handleToggle: 无效的服装项', item)
        return
      }
      const itemId = item.id || item.uuid
      const existing = selected.find(s => s.category === item.category)
      if (existing && existing.id !== item.id && existing.uuid !== item.uuid) {
        onRemoveSelected(existing.id || existing.uuid)
      }
      if (isSelected(itemId)) {
        onRemoveSelected(itemId)
      } else {
        onToggleSelect({
          id: itemId,
          uuid: item.uuid,
          color: item.color,
          name: item.name,
          category: item.category,
          image: item.image,
          imageFull: item.imageFull,
          isCustom: item.isCustom,
          isWardrobe: item.isWardrobe,
          subcategory: item.subcategory,
          price: item.price,
          sizes: item.sizes,
        })
      }
    },
    [selected, onToggleSelect, onRemoveSelected, isSelected]
  )

  // 选择主分类
  const handleCategoryChange = useCallback(cat => {
    setCurrentCategory(cat)
    setCurrentSubcategory('')
    setSearchKeyword('')
  }, [])

  // 格式化价格
  const formatPrice = price => {
    if (!price || price === 0) {
      return ''
    }
    return `¥${parseFloat(price).toFixed(0)}`
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className='fixed inset-0 z-[100] flex items-center justify-center'>
      {/* 遮罩层 - 点击不关闭 */}
      <div className='absolute inset-0 bg-black/60 backdrop-blur-sm' />

      {/* 模态框 */}
      <div className='relative flex h-[85vh] w-[90vw] max-w-[1200px] animate-scale-in flex-col overflow-hidden rounded-2xl bg-white shadow-2xl'>
        {/* 头部 */}
        <div className='flex items-center justify-between border-b border-gray-200 px-6 py-4'>
          <div className='flex items-center gap-1'>
            {/* 全部按钮 */}
            <button
              type='button'
              onClick={() => handleCategoryChange('')}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                currentCategory === ''
                  ? 'bg-champagne text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t('all') || '全部'}
            </button>

            {/* 主分类标签 */}
            {allCategories.map(cat => (
              <button
                type='button'
                key={cat.id}
                onClick={() => handleCategoryChange(cat.id)}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                  currentCategory === cat.id
                    ? 'bg-champagne text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {cat.name || t(cat.i18nKey)}
              </button>
            ))}
          </div>

          <div className='flex items-center gap-4'>
            {/* 搜索框 */}
            <div className='relative w-64'>
              <svg
                className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
                />
              </svg>
              <input
                type='text'
                placeholder={t('search') || '搜索服装...'}
                value={searchKeyword}
                onChange={e => setSearchKeyword(e.target.value)}
                className='w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 text-sm focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/20'
              />
              {searchKeyword && (
                <button
                  type='button'
                  onClick={() => setSearchKeyword('')}
                  className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600'
                  aria-label={t('clear') || '清除'}
                >
                  <svg className='h-4 w-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M6 18L18 6M6 6l12 12'
                    />
                  </svg>
                </button>
              )}
            </div>

            {/* 关闭按钮 */}
            <button
              type='button'
              onClick={onClose}
              className='rounded-lg p-1.5 transition-colors hover:bg-gray-100'
              aria-label='关闭'
            >
              <svg
                className='h-5 w-5 text-gray-400'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M6 18L18 6M6 6l12 12'
                />
              </svg>
            </button>
          </div>
        </div>

        {/* 子分类标签 */}
        {!searchKeyword && (
          <div className='border-b border-gray-100 px-6 py-3'>
            <div className='flex flex-wrap gap-2'>
              {(allCategories.find(c => c.id === currentCategory)?.subcategories || []).map(sub => (
                <button
                  type='button'
                  key={sub.id || 'all'}
                  onClick={() => setCurrentSubcategory(sub.id)}
                  className={`rounded-full px-3 py-1 text-xs transition-colors ${
                    currentSubcategory === sub.id
                      ? 'bg-champagne/15 font-medium text-champagne'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {sub.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 服装网格 */}
        <div className='flex-1 overflow-y-auto p-6'>
          {allClothes.length === 0 ? (
            <div className='flex h-full flex-col items-center justify-center text-center'>
              <svg
                className='mb-4 h-16 w-16 text-gray-300'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={1}
                  d='M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
                />
              </svg>
              <p className='text-gray-500'>{t('noClothing') || '暂无服装'}</p>
              <p className='mt-1 text-sm text-gray-400'>
                {t('uploadClothingHint') || '请上传或添加服装'}
              </p>
            </div>
          ) : (
            <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'>
              {allClothes.map(item => {
                const itemSelected = isSelected(item.id || item.uuid)
                const itemHasImage = !!(item.image || item.imageFull)

                return (
                  <div
                    key={item.id || item.uuid}
                    className={`group relative overflow-hidden rounded-xl border transition-all ${
                      itemSelected
                        ? 'border-champagne shadow-lg'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }`}
                  >
                    {/* 图片区域 */}
                    <div
                      className='relative aspect-[3/4] cursor-pointer overflow-hidden bg-gray-50'
                      style={{ backgroundColor: item.color || '#f9fafb' }}
                    >
                      {itemHasImage ? (
                        <CachedImage
                          src={item.imageFull || item.image}
                          alt={item.name}
                          className='h-full w-full object-cover'
                        />
                      ) : (
                        <div className='flex h-full w-full items-center justify-center'>
                          <svg
                            className='h-12 w-12 text-gray-300'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                          >
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth={1}
                              d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
                            />
                          </svg>
                        </div>
                      )}

                      {/* 选中标记 */}
                      {itemSelected && (
                        <div className='absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-champagne text-white'>
                          <svg
                            className='h-4 w-4'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                          >
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth={3}
                              d='M5 13l4 4L19 7'
                            />
                          </svg>
                        </div>
                      )}

                      {/* 悬停添加按钮 */}
                      <div
                        className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity ${
                          itemSelected ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        <button
                          type='button'
                          onClick={() => handleToggle(item)}
                          className='rounded-full bg-white px-4 py-2 text-sm font-medium text-charcoal transition-transform hover:scale-105'
                        >
                          {t('select') || '选择'}
                        </button>
                      </div>
                    </div>

                    {/* 信息区域 */}
                    <div className='p-3'>
                      <p className='truncate text-sm font-medium text-charcoal'>{item.name}</p>
                      <div className='mt-1 flex items-center justify-between'>
                        <span className='text-xs font-semibold text-champagne'>
                          {formatPrice(item.price)}
                        </span>
                        <div className='flex items-center gap-1'>
                          {item.sizes && (
                            <span className='truncate text-[10px] text-gray-500'>{item.sizes}</span>
                          )}
                          {item.isWardrobe && (
                            <span className='rounded bg-green-100 px-1.5 py-0.5 text-[10px] text-green-700'>
                              {t('wardrobe') || '衣橱'}
                            </span>
                          )}
                          {item.isCustom && !item.isWardrobe && (
                            <span className='rounded bg-champagne/15 px-1.5 py-0.5 text-[10px] text-champagne'>
                              {t('custom') || '自定义'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 点击卡片也可选择 */}
                    <button
                      type='button'
                      onClick={() => handleToggle(item)}
                      className='absolute inset-0 z-10'
                      aria-label={
                        itemSelected ? t('deselect') || '取消选择' : t('select') || '选择'
                      }
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 底部已选栏 */}
        <div className='border-t border-gray-200 bg-gray-50 px-6 py-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <span className='text-sm font-medium text-gray-700'>
                {t('selected') || '已选'} ({selected.length}):
              </span>
              {selected.length === 0 ? (
                <span className='text-sm text-gray-400'>{t('noSelection') || '未选择服装'}</span>
              ) : (
                <div className='flex items-center gap-2'>
                  {selected.map(item => (
                    <div
                      key={item.id}
                      className='flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm shadow-sm'
                    >
                      <span className='max-w-[100px] truncate'>{item.name}</span>
                      <button
                        type='button'
                        onClick={() => onRemoveSelected(item.id)}
                        className='text-gray-400 hover:text-red-500'
                        aria-label={t('remove') || '移除'}
                      >
                        <svg
                          className='h-4 w-4'
                          fill='none'
                          stroke='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M6 18L18 6M6 6l12 12'
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              type='button'
              onClick={onClose}
              className='rounded-xl bg-champagne px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-champagne/90'
            >
              {t('confirm') || '确认'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
