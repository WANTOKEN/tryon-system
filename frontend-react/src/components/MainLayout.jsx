import { useState, useRef, useCallback } from 'react'

import { useI18n } from '../hooks/useI18n'
import { categoryIcons, categories as defaultCategories } from '../data/clothingData'

export default function MainLayout({
  avatarPreview,
  onAvatarChange,
  onSetAvatarPreview,
  selected,
  onToggleSelect,
  selectedClothing,
  onRemoveSelected,
  history,
  status,
  resultUrl,
  onTryOn,
  canTryOn,
  onOpenWardrobeUpload,
  onOpenCustomUploadModal,
  onOpenPreviewModal,
  onToggleHistorySaved,
  onClearHistory,
  onDeleteHistory,
  onReuseAvatarFromHistory,
  onClearSelection,
  hasResult,
  customClothing,
  wardrobeClothing,
  // 从后端获取的服装数据
  clothing = [],
  categories,
  clothingLoading,
  // Toast 提示
  showToast,
  // 删除自定义服装
  onRemoveCustomClothing,
  // 预计等待时间
  remainingTime = 0,
}) {
  const { t } = useI18n()
  const [currentCategory, setCurrentCategory] = useState('tops')
  const [currentSubcategory, setCurrentSubcategory] = useState('')
  const [historyFilter, setHistoryFilter] = useState('all')
  const fileInputRef = useRef(null)

  // 使用后端分类或默认分类
  const displayCategories = categories && categories.length > 0 ? categories : defaultCategories

  // 添加"自定义上传"分类
  const customUploadCategory = {
    id: 'custom_upload',
    name: t('cat_custom_upload'),
    i18nKey: 'cat_custom_upload',
    subcategories: [
      { id: '', name: t('all') }, // 全部
      { id: 'tops', name: t('cat_tops') },
      { id: 'bottoms', name: t('cat_bottoms') },
      { id: 'dresses', name: t('cat_dresses') },
      { id: 'outerwear', name: t('cat_outerwear') },
      { id: 'shoes', name: t('cat_shoes') },
      { id: 'accessories', name: t('cat_accessories') },
    ],
  }

  // 所有分类（包含自定义上传分类）
  // 为每个分类添加"全部"子分类
  const allCategories = [
    ...displayCategories.map(cat => ({
      ...cat,
      subcategories: [{ id: '', name: t('all') }, ...(cat.subcategories || [])],
    })),
    customUploadCategory,
  ]

  // 搜索关键词
  const [searchKeyword, setSearchKeyword] = useState('')

  // 选择主分类
  const handleCategoryChange = useCallback(cat => {
    setCurrentCategory(cat)
    setCurrentSubcategory('') // 默认选中"全部"
    setSearchKeyword('') // 切换分类时清空搜索
  }, [])

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

  // 服装过滤辅助函数
  const filterByCategoryAndSubcategory = useCallback(
    item => {
      if (item.category !== currentCategory) {
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
  // 如果有搜索关键词，则全局搜索所有服装
  const getCategoryClothes = () => {
    if (searchKeyword) {
      return clothing.filter(c => matchKeyword(c, searchKeyword))
    }
    if (currentCategory === 'custom_upload') {
      return [] // 自定义分类不显示后端服装
    }
    return clothing.filter(filterByCategoryAndSubcategory)
  }
  const categoryClothes = getCategoryClothes()

  // 自定义服装
  const getCustomClothes = () => {
    const customList = customClothing || []
    if (searchKeyword) {
      return customList.filter(c => matchKeyword(c, searchKeyword))
    }
    if (currentCategory === 'custom_upload') {
      return customList.filter(c => !currentSubcategory || c.category === currentSubcategory)
    }
    return customList.filter(filterByCategoryAndSubcategory)
  }
  const customClothes = getCustomClothes()

  // 衣橱服装
  const getWardrobeClothes = () => {
    const wardrobeList = wardrobeClothing || []
    if (searchKeyword) {
      return wardrobeList.filter(c => matchKeyword(c, searchKeyword))
    }
    if (currentCategory === 'custom_upload') {
      return [] // 自定义分类不显示衣橱服装
    }
    return wardrobeList.filter(filterByCategoryAndSubcategory)
  }
  const wardrobeClothes = getWardrobeClothes()

  const allClothes = [...categoryClothes, ...wardrobeClothes, ...customClothes]

  // 判断是否选中
  const isSelected = useCallback(
    id => selected.some(item => item.id === id || item.uuid === id),
    [selected]
  )

  // 切换选中（同类型只允许一件）
  const handleToggle = useCallback(
    item => {
      const existing = selected.find(s => s.category === item.category)
      if (existing && existing.id !== item.id && existing.uuid !== item.uuid) {
        // 替换
        onRemoveSelected(existing.id || existing.uuid)
      }
      if (isSelected(item.id || item.uuid)) {
        onRemoveSelected(item.id || item.uuid)
      } else {
        onToggleSelect({
          id: item.id || item.uuid,
          uuid: item.uuid,
          color: item.color,
          name: item.name,
          category: item.category,
          image: item.image,
          imageFull: item.imageFull,
          isCustom: item.isCustom,
          isWardrobe: item.isWardrobe,
          subcategory: item.subcategory,
        })
      }
    },
    [selected, onToggleSelect, onRemoveSelected, isSelected]
  )

  // 步骤引导状态
  const hasImage = !!avatarPreview
  const hasClothing = selected.length > 0
  const step1Class = hasImage ? 'completed' : 'active'
  const getStep2Class = () => {
    if (hasClothing) {
      return 'completed'
    }
    if (hasImage) {
      return 'active'
    }
    return 'pending'
  }
  const step2Class = getStep2Class()
  const getStep3Class = () => {
    if (hasResult) {
      return 'completed'
    }
    if (hasImage && hasClothing) {
      return 'active'
    }
    return 'pending'
  }
  const step3Class = getStep3Class()

  // 分类计数（保留用于未来扩展）
  const _totalCount =
    clothing.filter(c => c.category === currentCategory).length +
    (customClothing || []).filter(c => c.category === currentCategory).length +
    (wardrobeClothing || []).filter(c => c.category === currentCategory).length

  // 历史记录筛选
  const filteredHistory =
    historyFilter === 'saved' ? (history || []).filter(r => r.is_saved || r.saved) : history || []
  const savedCount = (history || []).filter(r => r.is_saved || r.saved).length

  // 时间格式化
  const formatTime = date => {
    const now = new Date()
    const diff = now - new Date(date)
    if (diff < 60000) {
      return t('justNow')
    }
    if (diff < 3600000) {
      return t('minutesAgo', { n: Math.floor(diff / 60000) })
    }
    if (diff < 86400000) {
      return t('hoursAgo', { n: Math.floor(diff / 3600000) })
    }
    const d = new Date(date)
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  // 头像上传（点击始终触发文件选择，保留用于未来扩展）
  const _handleAvatarClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleAvatarFileChange = useCallback(
    e => {
      const file = e.target.files?.[0]
      if (file) {
        if (file.size > 10 * 1024 * 1024) {
          showToast?.('图片大小不能超过 10MB', 'warning')
          return
        }
        onAvatarChange(e)
      }
    },
    [onAvatarChange, showToast]
  )

  // 自定义服装上传（打开选择弹窗）
  const handleCustomUpload = useCallback(() => {
    onOpenCustomUploadModal?.(currentCategory, currentSubcategory)
  }, [onOpenCustomUploadModal, currentCategory, currentSubcategory])

  // 衣橱上传（仅商家端可用，保留用于未来扩展）
  const _handleWardrobeUpload = useCallback(() => {
    onOpenWardrobeUpload?.()
  }, [onOpenWardrobeUpload])

  // 保存/分享
  const handleSave = useCallback(() => {
    if (!hasResult || !history || history.length === 0) {
      return
    }
    const latest = history[0]
    if (latest) {
      onToggleHistorySaved(latest.id)
    }
  }, [hasResult, history, onToggleHistorySaved])

  const handleShare = useCallback(() => {
    // TODO: share feature
  }, [])

  // 试穿按钮文字
  const isGenerating = status === 'pending' || status === 'processing'
  const getTryOnBtnText = () => {
    if (isGenerating) {
      return t('regenerating')
    }
    if (hasResult) {
      return t('regenerate')
    }
    return t('startTryOn')
  }
  const tryOnBtnText = getTryOnBtnText()

  const iconPath = categoryIcons[currentCategory] || categoryIcons.tops

  // 渲染服装列表内容
  const renderClothingListContent = () => {
    if (clothingLoading) {
      return (
        <div className='col-span-2 py-8 text-center text-grayMuted'>
          <svg
            className='mx-auto mb-2 h-8 w-8 animate-spin text-champagne'
            fill='none'
            viewBox='0 0 24 24'
          >
            <circle
              className='opacity-25'
              cx='12'
              cy='12'
              r='10'
              stroke='currentColor'
              strokeWidth='4'
            />
            <path
              className='opacity-75'
              fill='currentColor'
              d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z'
            />
          </svg>
          <span className='text-sm'>加载中...</span>
        </div>
      )
    }
    if (allClothes.length === 0) {
      return (
        <div className='col-span-2 py-8 text-center'>
          <svg
            className='mx-auto mb-2 h-12 w-12 text-grayLight'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth='1.5'
              d='M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
            />
          </svg>
          <p className='text-sm text-grayMuted'>暂无服装</p>
          <p className='mt-1 text-xs text-grayMuted'>点击上方按钮上传服装</p>
        </div>
      )
    }
    return allClothes.map(item => {
      const itemSelected = isSelected(item.id || item.uuid)
      const { isCustom } = item
      const { isWardrobe } = item
      const itemHasImage = !!(item.image || item.imageFull)
      return (
        <div
          key={item.id || item.uuid}
          className={`clothing-card touch-target rounded-xl p-2.5 ${itemSelected ? 'selected' : ''} ${isCustom ? 'custom-card' : ''} ${isWardrobe ? 'wardrobe-card' : ''}`}
          data-id={item.id || item.uuid}
          role='option'
          aria-selected={itemSelected}
        >
          <div
            className='relative mb-1.5 flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-gray-50'
            style={{ backgroundColor: item.color }}
            onClick={() => {
              if (itemHasImage) {
                onOpenPreviewModal(item.imageFull || item.image, item.name)
              }
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                if (itemHasImage) {
                  onOpenPreviewModal(item.imageFull || item.image, item.name)
                }
              }
            }}
            role='button'
            tabIndex={0}
            title={t('clickPreview')}
          >
            {hasImage ? (
              <img src={item.image} alt={item.name} className='h-full w-full object-cover' />
            ) : (
              <>
                <div
                  className='absolute inset-0 bg-gradient-to-br from-white/20 to-transparent'
                  aria-hidden='true'
                />
                <svg
                  className='h-12 w-10 text-white/40'
                  fill='currentColor'
                  viewBox='0 0 24 24'
                  aria-hidden='true'
                  dangerouslySetInnerHTML={{ __html: iconPath }}
                />
              </>
            )}
            {/* 勾选框 */}
            <div
              className='check-mark'
              role='checkbox'
              aria-checked={itemSelected}
              aria-label={t('select')}
              tabIndex={0}
              onClick={e => {
                e.stopPropagation()
                handleToggle(item)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  handleToggle(item)
                }
              }}
            >
              <svg className='h-3 w-3' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='3'
                  d='M5 13l4 4L19 7'
                />
              </svg>
            </div>
            {isCustom && (
              <button
                type='button'
                className='absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/40 transition-colors hover:bg-error/80'
                onClick={e => {
                  e.stopPropagation()
                  onRemoveCustomClothing?.(item.id)
                }}
                aria-label={t('removeCustom')}
              >
                <svg
                  className='h-3 w-3 text-white'
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
            )}
          </div>
          <div className='flex flex-col items-center gap-0.5'>
            <p className='w-full truncate text-center text-[11px] font-medium text-charcoal/90'>
              {item.name}
            </p>
            {/* 搜索模式下显示分类标签 */}
            {searchKeyword && item.category && (
              <span className='bg-primary/10 text-primary/80 rounded-full px-1.5 py-0.5 text-[9px] font-medium'>
                {t(`cat_${item.category}`)}
              </span>
            )}
            {/* 非搜索模式下显示原有标签 */}
            {!searchKeyword && isWardrobe && (
              <span className='rounded-full bg-success/10 px-1.5 py-0.5 text-[9px] font-medium text-success/80'>
                {t('wardrobeTag')}
              </span>
            )}
            {!searchKeyword && isCustom && currentCategory !== 'custom_upload' && (
              <span className='rounded-full bg-champagne/15 px-1.5 py-0.5 text-[9px] font-medium text-champagne/90'>
                {t('customTag')}
              </span>
            )}
            {!searchKeyword && isCustom && currentCategory === 'custom_upload' && item.category && (
              <span className='bg-primary/10 text-primary/80 rounded-full px-1.5 py-0.5 text-[9px] font-medium'>
                {t(`cat_${item.category}`)}
              </span>
            )}
          </div>
        </div>
      )
    })
  }

  return (
    <div className='app-layout'>
      {/* ===== 左侧栏 ===== */}
      <aside className='sidebar-left' aria-label='服装选择面板'>
        {/* 形象管理 */}
        <div className='sidebar-section avatar-section'>
          {/* 形象照片卡片 */}
          <div className='avatar-card-v2'>
            {/* 图片区域 */}
            <div
              className={`avatar-image-area ${avatarPreview ? 'has-image' : 'empty'}`}
              role='img'
              aria-label={avatarPreview ? t('aria_avatar_ready') : t('aria_avatar_empty')}
            >
              {avatarPreview ? (
                <>
                  <img src={avatarPreview} alt={t('aria_user_photo')} className='avatar-img' />
                  {/* 底部操作按钮栏 */}
                  <div className='avatar-actions-bar'>
                    <button
                      type='button'
                      className='avatar-action-btn preview'
                      onClick={e => {
                        e.stopPropagation()
                        onOpenPreviewModal(avatarPreview, t('myProfile'))
                      }}
                      aria-label={t('preview') || '预览'}
                      title={t('preview') || '预览'}
                    >
                      <svg
                        className='h-3.5 w-3.5'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth='2'
                          d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7'
                        />
                      </svg>
                    </button>
                    <button
                      type='button'
                      className='avatar-action-btn change'
                      onClick={e => {
                        e.stopPropagation()
                        fileInputRef.current?.click()
                      }}
                      aria-label={t('change') || '更换'}
                      title={t('change') || '更换'}
                    >
                      <svg
                        className='h-3.5 w-3.5'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth='2'
                          d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
                        />
                      </svg>
                    </button>
                    <button
                      type='button'
                      className='avatar-action-btn delete'
                      onClick={e => {
                        e.stopPropagation()
                        onAvatarChange?.({ target: { files: null } })
                      }}
                      aria-label={t('delete') || '删除'}
                      title={t('delete') || '删除'}
                    >
                      <svg
                        className='h-3.5 w-3.5'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth='2'
                          d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
                        />
                      </svg>
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type='button'
                  className='avatar-upload-btn'
                  onClick={() => fileInputRef.current?.click()}
                  aria-label={t('uploadPhoto')}
                >
                  <div className='upload-icon-wrapper'>
                    <svg className='h-8 w-8' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth='1.5'
                        d='M12 4v16m8-8H4'
                      />
                    </svg>
                  </div>
                  <span className='upload-text'>{t('uploadPhoto')}</span>
                </button>
              )}
            </div>

            {/* 右侧信息区 */}
            <div className='avatar-info-area'>
              <div className='avatar-info-title'>
                <svg className='h-4 w-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='1.5'
                    d='M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z'
                  />
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='1.5'
                    d='M15 13a3 3 0 11-6 0 3 3 0 016 0z'
                  />
                </svg>
                <span>{t('myProfile')}</span>
              </div>
              <p className='avatar-info-tip'>{t('avatarTip1') || '正面站立照片'}</p>
              <p className='avatar-info-tip'>{t('avatarTip3') || '纯色背景最佳'}</p>
              {/* 使用模特按钮 */}
              <button
                type='button'
                className='use-model-btn'
                onClick={() => {
                  // 使用预设模特图片
                  const modelImage = '/images/model.png'
                  onSetAvatarPreview?.(modelImage)
                }}
              >
                <svg className='h-3.5 w-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='1.5'
                    d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
                  />
                </svg>
                <span>{t('useModel') || '使用模特'}</span>
              </button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type='file'
            accept='image/*'
            onChange={handleAvatarFileChange}
            className='hidden'
          />
        </div>

        {/* 分类导航 2×3 图标网格 */}
        <div className='sidebar-section'>
          <div className='cat-grid' role='tablist' aria-label='服装分类'>
            {allCategories.map(cat => {
              // 自定义上传分类显示所有自定义服装数量
              const count =
                cat.id === 'custom_upload'
                  ? (customClothing || []).length
                  : clothing.filter(c => c.category === cat.id).length +
                    (customClothing || []).filter(c => c.category === cat.id).length +
                    (wardrobeClothing || []).filter(c => c.category === cat.id).length
              return (
                <button
                  type='button'
                  key={cat.id}
                  className={`cat-grid-item ${currentCategory === cat.id ? 'active' : ''}`}
                  role='tab'
                  aria-selected={currentCategory === cat.id}
                  tabIndex={currentCategory === cat.id ? 0 : -1}
                  onClick={() => handleCategoryChange(cat.id)}
                >
                  <div className='cat-grid-icon'>
                    <svg
                      className='h-5 w-5'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                      dangerouslySetInnerHTML={{
                        __html: categoryIcons[cat.id] || categoryIcons.custom_upload,
                      }}
                    />
                  </div>
                  <span className='cat-grid-label'>{cat.name || t(cat.i18nKey)}</span>
                  <span className='cat-grid-badge'>{count}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 子分类标签 - 搜索时不显示 */}
        {!searchKeyword && (
          <div className='sidebar-section'>
            <div className='flex flex-wrap gap-1.5' role='tablist' aria-label='子分类'>
              {(allCategories.find(c => c.id === currentCategory)?.subcategories || []).map(sub => (
                <button
                  type='button'
                  key={sub.id || 'all'}
                  className={`subcategory-tag rounded-full px-3 py-1 ${currentSubcategory === sub.id ? 'active' : 'text-accessible'}`}
                  role='tab'
                  aria-selected={currentSubcategory === sub.id}
                  onClick={() => setCurrentSubcategory(sub.id)}
                >
                  {sub.name || t(sub.i18nKey || `sub_${sub.id.replace(/-/g, '')}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 服装网格 */}
        <div className='sidebar-section flex-1'>
          <div className='mb-3 flex items-center justify-between'>
            <span className='sidebar-section-title' style={{ padding: 0, margin: 0 }}>
              {searchKeyword ? t('searchResult') : t('clothingList')}
            </span>
            <div className='flex items-center gap-1.5'>
              {/* 搜索按钮 */}
              <button
                type='button'
                className={`upload-chip ${searchKeyword ? 'bg-primary/10 text-primary' : ''}`}
                onClick={() => {
                  if (searchKeyword) {
                    setSearchKeyword('')
                  } else {
                    document.getElementById('clothing-search-input')?.focus()
                  }
                }}
              >
                <svg className='h-3.5 w-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='1.5'
                    d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
                  />
                </svg>
                <span>{searchKeyword ? t('clear') : t('search')}</span>
              </button>
              <button type='button' className='upload-chip' onClick={handleCustomUpload}>
                <svg className='h-3.5 w-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='1.5'
                    d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
                  />
                </svg>
                <span>{t('custom')}</span>
                <span className='ml-1 text-xs text-grayMuted'>
                  ({t('total', { n: (customClothing || []).length })})
                </span>
              </button>
            </div>
          </div>
          {/* 搜索输入框 */}
          <div className='search-input-wrapper'>
            <svg
              className='search-input-icon'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='1.5'
                d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
              />
            </svg>
            <input
              id='clothing-search-input'
              type='text'
              placeholder=''
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              className='search-input'
            />
          </div>
          <div
            className='grid max-h-[calc(100vh-380px)] grid-cols-2 gap-2.5 overflow-y-auto px-0.5 pb-2'
            role='tabpanel'
            aria-label='服装列表'
          >
            {renderClothingListContent()}
          </div>
        </div>
      </aside>

      {/* ===== 中央主舞台 ===== */}
      <main className='main-stage' role='main'>
        {/* 步骤引导 */}
        <div className='mb-3 flex items-center justify-center gap-2'>
          <div className={`step-indicator ${step1Class}`}>
            <div className='step-dot'>
              {hasImage ? (
                <svg className='h-3 w-3' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='3'
                    d='M5 13l4 4L19 7'
                  />
                </svg>
              ) : (
                <svg className='h-3 w-3' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
                  />
                </svg>
              )}
            </div>
            <span>{t('step1')}</span>
          </div>
          <div className='h-px w-6 bg-grayLight' />
          <div className={`step-indicator ${step2Class}`}>
            <div className='step-dot'>
              {hasClothing ? (
                <svg className='h-3 w-3' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='3'
                    d='M5 13l4 4L19 7'
                  />
                </svg>
              ) : (
                <svg className='h-3 w-3' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
                  />
                </svg>
              )}
            </div>
            <span>{t('step2')}</span>
          </div>
          <div className='h-px w-6 bg-grayLight' />
          <div className={`step-indicator ${step3Class}`}>
            <div className='step-dot'>
              {hasResult ? (
                <svg className='h-3 w-3' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='3'
                    d='M5 13l4 4L19 7'
                  />
                </svg>
              ) : (
                <svg className='h-3 w-3' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z'
                  />
                </svg>
              )}
            </div>
            <span>{t('step3')}</span>
          </div>
        </div>

        {/* 预览画布 */}
        <div id='tryon-result-area' className='preview-immersive flex items-center justify-center'>
          <div className='z-10 text-center'>
            {resultUrl ? (
              <div className='animate-scale-in'>
                <div
                  className='relative mx-auto mb-4 h-96 w-72 cursor-pointer overflow-hidden rounded-xl border-2 border-champagne bg-white shadow-lg'
                  onClick={() =>
                    onOpenPreviewModal(resultUrl, selectedClothing.map(c => c.name).join(' + '))
                  }
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onOpenPreviewModal(resultUrl, selectedClothing.map(c => c.name).join(' + '))
                    }
                  }}
                  role='button'
                  tabIndex={0}
                  title={t('clickPreview')}
                >
                  <img
                    src={resultUrl}
                    alt={t('aria_tryon_preview')}
                    className='h-full w-full object-cover'
                  />
                  <div className='absolute inset-0 bg-gradient-to-t from-black/20 to-transparent' />
                  <div className='absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/30'>
                    <svg
                      className='h-3.5 w-3.5 text-white'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth='2'
                        d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7'
                      />
                    </svg>
                  </div>
                </div>
                <p className='text-sm font-medium text-charcoal'>
                  {selectedClothing.map(c => c.name).join(' + ')}
                </p>
                <p className='mt-1 text-xs text-grayMuted'>
                  {t('matched', { n: selectedClothing.length })}
                </p>
              </div>
            ) : (
              <div>
                <div className='mx-auto mb-4 flex h-96 w-72 items-center justify-center rounded-xl border border-grayLight bg-white/80 shadow-lg backdrop-blur'>
                  <div className='p-4 text-center'>
                    <div className='empty-state-illustration mb-3'>
                      <svg
                        className='mx-auto h-14 w-14 text-grayLight'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                        aria-hidden='true'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth='1'
                          d='M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
                        />
                      </svg>
                    </div>
                    <p className='text-accessible text-sm'>{t('previewEmpty')}</p>
                    <p className='mt-1 text-xs text-grayMuted'>{t('previewHint')}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 加载遮罩 */}
          {isGenerating && (
            <div
              className='absolute inset-0 z-20 flex items-center justify-center bg-ivory/95 backdrop-blur-sm'
              role='alert'
              aria-live='assertive'
            >
              <div className='text-center'>
                <div
                  className='loading-ring mx-auto mb-4 h-12 w-12 animate-spin rounded-full'
                  aria-hidden='true'
                />
                <p className='mb-1 font-medium text-charcoal'>{t('regenerating')}</p>
                {remainingTime > 0 ? (
                  <p className='text-accessible text-sm'>
                    {t('estimatedTime') || '预计等待'}: {remainingTime} {t('seconds') || '秒'}
                  </p>
                ) : (
                  <p className='text-accessible text-sm'>{t('previewHint')}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className='action-buttons mt-4 flex items-center gap-3' id='action-bar'>
          <button
            type='button'
            id='try-on-btn'
            className='btn-primary touch-target flex-1 rounded-xl py-3 text-sm'
            onClick={onTryOn}
            disabled={!canTryOn || isGenerating}
          >
            <span className='flex items-center justify-center space-x-2'>
              {isGenerating ? (
                <span className='h-4 w-4 animate-spin rounded-full border-2 border-charcoal/30 border-t-charcoal' />
              ) : (
                <svg
                  className='h-5 w-5'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                  aria-hidden='true'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z'
                  />
                </svg>
              )}
              <span>{tryOnBtnText}</span>
            </span>
          </button>
          <button
            type='button'
            id='save-btn'
            className={`btn-secondary touch-target rounded-xl px-5 py-3 text-sm ${!hasResult ? 'btn-disabled' : ''}`}
            onClick={handleSave}
            aria-label={t('save')}
          >
            <svg
              className='h-5 w-5'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
              aria-hidden='true'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z'
              />
            </svg>
          </button>
          <button
            type='button'
            id='share-btn'
            className={`btn-secondary touch-target rounded-xl px-5 py-3 text-sm ${!hasResult ? 'btn-disabled' : ''}`}
            onClick={handleShare}
            aria-label={t('n_shareSoon')}
            title={t('n_shareSoon')}
          >
            <svg
              className='h-5 w-5'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
              aria-hidden='true'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z'
              />
            </svg>
          </button>
        </div>
      </main>

      {/* ===== 右侧面板 ===== */}
      <aside className='sidebar-right' aria-label='试穿信息面板'>
        {/* 已选服装 */}
        <div className='sidebar-section'>
          <div className='mb-3 flex items-center justify-between'>
            <div className='sidebar-section-title' style={{ padding: 0, margin: 0 }}>
              {t('selectedClothing')}
            </div>
            {selected.length > 0 && (
              <button
                type='button'
                className='text-xs text-grayMuted transition-colors hover:text-error'
                onClick={onClearSelection}
                aria-label={t('clearSelection')}
                title={t('clearSelection')}
              >
                {t('clearSelection')}
              </button>
            )}
          </div>
          {selected.length === 0 ? (
            <div className='py-4 text-center'>
              <svg
                className='mx-auto mb-2 h-8 w-8 text-grayLight'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
                aria-hidden='true'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='1.5'
                  d='M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
                />
              </svg>
              <p className='text-xs text-grayMuted'>{t('selectFromLeft')}</p>
            </div>
          ) : (
            <div className='space-y-1'>
              {selected.map(item => {
                const customItem = [...(customClothing || []), ...(wardrobeClothing || [])].find(
                  c => c.id === item.id
                )
                const itemHasImage = customItem && customItem.image
                return (
                  <div key={item.id} className='selected-item-compact'>
                    <div
                      className='h-9 w-9 flex-shrink-0 cursor-pointer overflow-hidden rounded-lg border border-grayLight'
                      style={{ backgroundColor: item.color }}
                      onClick={() => {
                        if (itemHasImage) {
                          onOpenPreviewModal(customItem.imageFull || customItem.image, item.name)
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          if (itemHasImage) {
                            onOpenPreviewModal(customItem.imageFull || customItem.image, item.name)
                          }
                        }
                      }}
                      role='button'
                      tabIndex={0}
                      title={t('clickPreview')}
                    >
                      {itemHasImage && (
                        <img
                          src={customItem.image}
                          alt={item.name}
                          className='h-full w-full rounded-lg object-cover'
                        />
                      )}
                    </div>
                    <div className='min-w-0 flex-1'>
                      <p className='truncate text-sm font-medium text-charcoal'>{item.name}</p>
                      <p className='text-xs text-grayMuted'>{t(`cat_${item.category}`)}</p>
                    </div>
                    <button
                      type='button'
                      className='remove-selected-btn'
                      onClick={() => onRemoveSelected(item.id)}
                      aria-label={t('clear')}
                      title={t('clear')}
                    >
                      <svg
                        className='h-3.5 w-3.5'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                        aria-hidden='true'
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
                )
              })}
            </div>
          )}
        </div>

        {/* 试穿记录 */}
        <div className='sidebar-section flex-1'>
          <div className='mb-2 flex items-center justify-between'>
            <div className='sidebar-section-title' style={{ padding: 0, margin: 0 }}>
              {t('tryOnHistory')}
              <span className='ml-1 text-champagne'>{(history || []).length}</span>
            </div>
            {(history || []).length > 0 && (
              <button
                type='button'
                className='text-xs text-grayMuted transition-colors hover:text-error'
                onClick={onClearHistory}
                aria-label={t('clear')}
                title={t('clear')}
              >
                {t('clear')}
              </button>
            )}
          </div>
          {/* 筛选标签 */}
          <div className='mb-3 flex gap-1'>
            <button
              type='button'
              className={`history-tab ${historyFilter === 'all' ? 'active' : ''}`}
              onClick={() => setHistoryFilter('all')}
            >
              {t('historyTabAll')}
            </button>
            <button
              type='button'
              className={`history-tab ${historyFilter === 'saved' ? 'active' : ''}`}
              onClick={() => setHistoryFilter('saved')}
            >
              <svg className='h-3 w-3' fill='currentColor' viewBox='0 0 24 24'>
                <path d='M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001a.752.752 0 01-.704 0l-.003-.001z' />
              </svg>
              {t('historyTabSaved')}
              <span className='ml-0.5 text-champagne'>{savedCount}</span>
            </button>
          </div>

          {/* 历史记录列表 */}
          {filteredHistory.length === 0 ? (
            <div className='history-empty rounded-xl p-8 text-center'>
              <svg
                className='mx-auto mb-3 h-12 w-12 text-grayLight'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
                aria-hidden='true'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='1'
                  d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
                />
              </svg>
              <p className='text-accessible text-sm'>
                {historyFilter === 'saved' ? t('noSaved') : t('noHistory')}
              </p>
              <p className='mt-1 text-xs text-grayMuted'>
                {historyFilter === 'saved' ? t('savedHint') : t('historyHint')}
              </p>
            </div>
          ) : (
            <div className='history-scroll'>
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
                  <div key={recordId} className='history-card overflow-hidden rounded-lg bg-white'>
                    <div
                      className='history-preview relative aspect-[3/4] cursor-pointer bg-gray-50'
                      onClick={() => imgSrc && onOpenPreviewModal(imgSrc, names)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          if (imgSrc) {
                            onOpenPreviewModal(imgSrc, names)
                          }
                        }
                      }}
                      role='button'
                      tabIndex={0}
                      title={t('clickPreview')}
                    >
                      {imgSrc && (
                        <img
                          src={imgSrc}
                          alt={names}
                          className='h-full w-full object-cover'
                          loading='lazy'
                        />
                      )}
                      <button
                        type='button'
                        className={`absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full transition-all duration-200 ${isSaved ? 'bg-champagne text-white shadow-md' : 'bg-black/30 text-white/70 hover:bg-champagne/70 hover:text-white'}`}
                        onClick={e => {
                          e.stopPropagation()
                          onToggleHistorySaved(recordId)
                        }}
                        aria-label={isSaved ? t('unsave') : t('save')}
                      >
                        <svg
                          className='h-3.5 w-3.5'
                          fill={isSaved ? 'currentColor' : 'none'}
                          stroke='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth='2'
                            d='M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z'
                          />
                        </svg>
                      </button>
                      <button
                        type='button'
                        className='absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/30 text-white transition-colors hover:bg-error/80'
                        onClick={e => {
                          e.stopPropagation()
                          onDeleteHistory(recordId)
                        }}
                        aria-label={t('clear')}
                      >
                        <svg
                          className='h-3.5 w-3.5'
                          fill='none'
                          stroke='currentColor'
                          viewBox='0 0 24 24'
                          aria-hidden='true'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth='2'
                            d='M6 18L18 6M6 6l12 12'
                          />
                        </svg>
                      </button>
                      {/* 复用头像按钮 */}
                      {onReuseAvatarFromHistory && (
                        <button
                          type='button'
                          className='absolute bottom-2 right-2 rounded bg-champagne/90 px-2 py-1 text-[10px] text-white transition-colors hover:bg-champagne'
                          onClick={e => {
                            e.stopPropagation()
                            onReuseAvatarFromHistory(recordId)
                          }}
                          aria-label={t('reuseAvatar') || '复用头像'}
                        >
                          {t('reuseAvatar') || '复用'}
                        </button>
                      )}
                    </div>
                    <div className='p-2.5'>
                      <div className='mb-1 flex items-center gap-1'>
                        {(record.clothing || []).map(c => (
                          <div
                            key={c.id}
                            className='history-color-dot'
                            style={{ backgroundColor: c.color }}
                            title={c.name}
                          />
                        ))}
                      </div>
                      <p className='truncate text-xs font-medium text-charcoal' title={names}>
                        {names}
                      </p>
                      <p className='mt-0.5 text-[11px] text-grayMuted'>
                        {formatTime(record.created_at)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
