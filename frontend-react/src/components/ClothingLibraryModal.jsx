import { useState, useMemo, useRef, useEffect } from 'react'

import PropTypes from 'prop-types'

import { api } from '../utils/request'
import { API_ENDPOINTS } from '../config/api'
import { CATEGORY_OPTIONS, FALLBACK_COLOR_TAGS } from '../data/clothingData'

import ClothingGrid from './ClothingGrid'
import { Icon } from './ui'

function ClothingLibraryModal({
  isOpen,
  onClose,
  clothing = [],
  customClothing = [],
  wardrobeClothing = [],
  selected = [],
  onToggleSelect,
  onRemoveSelected,
  onRemoveWardrobeItem,
  onAddWardrobeItem,
  t,
  sessionId,
  defaultCustomCategory = 'tops',
  onCustomUploadFile,
}) {
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedColor, setSelectedColor] = useState('all')

  // 颜色标签：严格由后端返回（/api/v1/colors/），前端不臆造
  const [colorTags, setColorTags] = useState(FALLBACK_COLOR_TAGS)

  useEffect(() => {
    let alive = true
    api
      .get(API_ENDPOINTS.COMMON.COLORS)
      .then(res => {
        const items = res?.items || res?.data?.items || res
        if (alive && Array.isArray(items) && items.length) {
          setColorTags(items)
        }
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const [showScan, setShowScan] = useState(false)
  const [qrSvg, setQrSvg] = useState('')
  const [scanError, setScanError] = useState('')
  const scanTimer = useRef(null)

  // 拍照上传：直接选图后按当前分类上传
  const handlePhotoPick = e => {
    const file = e.target.files && e.target.files[0]
    if (file && onCustomUploadFile) {
      onCustomUploadFile(file, defaultCustomCategory)
    }
    e.target.value = ''
  }

  // 轮询扫码状态：检查手机端是否已上传图片
  const pollScan = ticketId => {
    if (scanTimer.current) {
      clearInterval(scanTimer.current)
    }
    scanTimer.current = setInterval(async () => {
      try {
        const res = await api.getNoRetry(API_ENDPOINTS.SCAN.STATUS(ticketId))
        if (res.success && res.data?.uploaded && res.data.image_url) {
          clearInterval(scanTimer.current)
          scanTimer.current = null
          setShowScan(false)
          try {
            const resp = await fetch(res.data.image_url)
            const blob = await resp.blob()
            const file = new File([blob], 'scan-upload.png', { type: blob.type || 'image/png' })
            if (onCustomUploadFile) {
              onCustomUploadFile(file, defaultCustomCategory)
            }
          } catch (e) {
            setScanError(t('scanUploadImageFailed'))
          }
        } else if (res.status === 404 || res.status === 410) {
          clearInterval(scanTimer.current)
          scanTimer.current = null
          setScanError(t('scanTicketExpired') || '二维码已过期，请刷新二维码')
        }
      } catch (e) {
        /* 轮询中忽略错误 */
      }
    }, 1500)
  }

  // 扫码上传：申请 ticket + 二维码，轮询直到手机端上传完成
  const startScan = async () => {
    setScanError('')
    setQrSvg('')
    if (!sessionId) {
      setScanError(t('sessionNotReady'))
      return
    }
    try {
      const res = await api.post(API_ENDPOINTS.SCAN.CREATE, {
        session_id: sessionId,
        type: 'clothing',
      })
      const data = res?.data
      if (!data || !data.qr_svg) {
        setScanError(data?.error || t('qrCodeFailed'))
        return
      }
      setQrSvg(data.qr_svg)
      setShowScan(true)
      pollScan(data.ticket_id)
    } catch (err) {
      setScanError('创建扫码会话失败')
    }
  }

  useEffect(
    () => () => {
      if (scanTimer.current) {
        clearInterval(scanTimer.current)
      }
    },
    []
  )

  const allItems = useMemo(() => {
    if (activeTab === 'wardrobe') {
      return wardrobeClothing
    }
    if (activeTab === 'custom') {
      return customClothing
    }
    return clothing
  }, [activeTab, clothing, customClothing, wardrobeClothing])

  // 颜色选项：严格使用后端返回的颜色标签（name 为入库值，hex 用于色块展示）
  const colorOptions = useMemo(
    () => colorTags.map(c => ({ value: c.name, label: c.name, swatch: c.hex })),
    [colorTags]
  )

  // 分类选项：固定顺序（上装 -> 下装 -> 连衣裙 -> 外套 -> 鞋 -> 配饰），已含中文翻译
  const categoryOptions = useMemo(() => CATEGORY_OPTIONS, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allItems.filter(i => {
      if (q) {
        const matched =
          (i.name || '').toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q)
        if (!matched) {
          return false
        }
      }
      if (selectedCategory !== 'all') {
        if ((i.category || '').trim() !== selectedCategory) {
          return false
        }
      }
      if (selectedColor !== 'all') {
        let list = []
        if (Array.isArray(i.colors)) {
          list = i.colors
        } else if (i.color) {
          list = [i.color]
        }
        const values = list.map(c => (typeof c === 'string' ? c : c?.color || c?.value))
        if (!values.includes(selectedColor)) {
          return false
        }
      }
      return true
    })
  }, [allItems, search, selectedCategory, selectedColor])

  // 切换 Tab 时重置筛选，避免跨 Tab 状态串扰
  const handleTabChange = key => {
    setActiveTab(key)
    setSelectedCategory('all')
    setSelectedColor('all')
  }

  const tabs = [
    { key: 'all', label: t('allClothing') || '全部', count: clothing.length },
    { key: 'wardrobe', label: t('myWardrobe') || '我的衣橱', count: wardrobeClothing.length },
    { key: 'custom', label: t('customUploads') || '自定义上传', count: customClothing.length },
  ]

  // 心形 = 收藏（即加入/移出「我的衣橱」），所有 Tab 行为一致
  const handleToggleFavorite = (item, next) => {
    if (next) {
      onAddWardrobeItem?.(item)
    } else {
      onRemoveWardrobeItem?.(item)
    }
  }

  if (!isOpen) {
    return null
  }

  const handleClose = () => {
    setSearch('')
    onClose?.()
  }

  const selectedCount = selected.length

  // 内容区：根据筛选结果和当前 Tab 决定渲染内容
  let modalContent
  if (filtered.length > 0) {
    modalContent = (
      <ClothingGrid
        items={filtered}
        variant='modal'
        selected={selected}
        favorites={wardrobeClothing}
        onToggleSelect={onToggleSelect}
        onToggleFavorite={handleToggleFavorite}
        t={t}
      />
    )
  } else if (activeTab === 'custom') {
    modalContent = (
      <div className='clothing-empty'>
        <Icon name='image' className='h-10 w-10' />
        <p>{t('libCustomUploadHint') || '上传你的自定义服装，支持拍照上传或扫码上传'}</p>
        <div className='custom-upload-actions'>
          <label className='btn-simple btn-simple-primary'>
            <Icon name='camera' className='h-4 w-4' />
            {t('libPhotoUpload') || '拍照上传'}
            <input
              type='file'
              accept='image/*'
              capture='environment'
              className='hidden-file-input'
              onChange={handlePhotoPick}
            />
          </label>
          <button type='button' className='btn-simple btn-simple-primary' onClick={startScan}>
            <Icon name='qr' className='h-4 w-4' />
            {t('libScanUpload') || '扫码上传'}
          </button>
        </div>
        {showScan && (
          <div
            className='scan-qr-overlay'
            onClick={() => setShowScan(false)}
            onKeyDown={e => {
              if (e.key === 'Escape') {
                setShowScan(false)
              }
            }}
            role='button'
            tabIndex={-1}
          >
            <div
              className='scan-qr-box'
              onClick={e => e.stopPropagation()}
              onKeyDown={e => e.stopPropagation()}
              role='presentation'
              tabIndex={-1}
            >
              <p className='scan-qr-title'>{t('libScanQrHint') || '请使用手机扫码上传服装'}</p>
              {qrSvg ? (
                <img src={qrSvg} alt='scan qr' className='scan-qr-svg' />
              ) : (
                <p className='scan-qr-loading'>{t('libGeneratingQr') || '二维码生成中…'}</p>
              )}
              {scanError && (
                <>
                  <p className='scan-qr-error'>{scanError}</p>
                  <button type='button' className='btn-simple' onClick={startScan}>
                    {t('refreshQr') || '刷新二维码'}
                  </button>
                </>
              )}
              <button type='button' className='btn-simple' onClick={() => setShowScan(false)}>
                {t('libCancel') || '取消'}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  } else {
    modalContent = (
      <div className='clothing-empty'>
        <Icon name='wardrobe' className='h-10 w-10' />
        <p>
          {search ? t('noSearchResult') || '没有匹配的服装' : t('noClothing') || '这里还没有服装'}
        </p>
      </div>
    )
  }

  return (
    <div
      className='clothing-modal-overlay'
      onMouseDown={e => {
        if (e.target === e.currentTarget) {
          handleClose()
        }
      }}
      role='presentation'
      tabIndex={-1}
    >
      <div
        className='clothing-modal gc-scope'
        role='dialog'
        aria-modal='true'
        aria-label={t('clothingLibrary') || '服装库'}
      >
        {/* 头部 */}
        <header className='clothing-modal-header'>
          <div>
            <h2 className='clothing-modal-title'>{t('clothingLibrary') || '服装库'}</h2>
            <p className='clothing-modal-sub'>
              {selectedCount > 0
                ? t('clothingModalSubtitleActive', { n: selectedCount }) ||
                  `${selectedCount} 件已选 · 点击卡片调整搭配`
                : t('clothingModalSubtitle') || '挑选心仪单品，开始你的虚拟试衣'}
            </p>
          </div>
          <button
            type='button'
            className='clothing-modal-close'
            onClick={handleClose}
            aria-label={t('close')}
          >
            <Icon name='close' className='h-5 w-5' />
          </button>
        </header>

        {/* 搜索 + 分类筛选 */}
        <div className='clothing-modal-toolbar'>
          <label className='clothing-search'>
            <input
              type='text'
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('searchClothing') || '搜索服装名称 / 分类'}
            />
            {search && (
              <button type='button' className='clothing-search-clear' onClick={() => setSearch('')}>
                <Icon name='close' className='h-3.5 w-3.5' />
              </button>
            )}
          </label>

          <div className='clothing-tabs' role='tablist'>
            {tabs.map(tab => (
              <button
                key={tab.key}
                type='button'
                role='tab'
                aria-selected={activeTab === tab.key}
                className={`clothing-tab${activeTab === tab.key ? ' is-active' : ''}`}
                onClick={() => handleTabChange(tab.key)}
              >
                {tab.label}
                <span className='clothing-tab-count'>{tab.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 分类筛选按钮组 */}
        <div className='clothing-filter-row'>
          <span className='clothing-filter-label'>{t('category') || '分类'}</span>
          <div className='clothing-category-chips'>
            <button
              type='button'
              className={`clothing-chip${selectedCategory === 'all' ? ' is-active' : ''}`}
              onClick={() => setSelectedCategory('all')}
            >
              {t('all') || '全部'}
            </button>
            {categoryOptions.map(cat => (
              <button
                key={cat.value}
                type='button'
                className={`clothing-chip${selectedCategory === cat.value ? ' is-active' : ''}`}
                onClick={() => setSelectedCategory(cat.value)}
              >
                <span>{t(cat.i18nKey)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 颜色筛选 */}
        {colorOptions.length > 0 && (
          <div className='clothing-filter-row'>
            <span className='clothing-filter-label'>{t('color') || '颜色'}</span>
            <div className='clothing-color-swatches'>
              <button
                type='button'
                className={`clothing-color-swatch clothing-color-all${selectedColor === 'all' ? ' is-active' : ''}`}
                onClick={() => setSelectedColor('all')}
                title={t('all') || '全部'}
              >
                {t('all') || '全部'}
              </button>
              {colorOptions.map(opt => (
                <button
                  key={opt.value}
                  type='button'
                  className={`clothing-color-swatch${selectedColor === opt.value ? ' is-active' : ''}`}
                  style={{ '--swatch': opt.swatch }}
                  onClick={() => setSelectedColor(opt.value)}
                  title={opt.label}
                  aria-label={opt.label}
                >
                  <span className='clothing-color-dot' style={{ background: opt.swatch }} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 内容区 */}
        <div className='clothing-modal-content'>{modalContent}</div>

        {/* 底部交互层 */}
        <footer className='clothing-modal-footer'>
          <span className={`clothing-modal-footinfo${selectedCount > 0 ? ' is-selected' : ''}`}>
            {selectedCount > 0 ? (
              <>
                <Icon name='check' className='h-4 w-4' />
                {t('n_clothingSelected', { n: selectedCount }) || `${selectedCount} 件已选`}
              </>
            ) : (
              t('selectClothingHint') || '尚未选择服装'
            )}
          </span>
          <div className='clothing-modal-actions'>
            {selectedCount > 0 && (
              <button type='button' className='btn-simple' onClick={onRemoveSelected}>
                {t('clearSelection') || '清空选择'}
              </button>
            )}
            <button type='button' className='btn-simple btn-simple-primary' onClick={handleClose}>
              {t('done') || '完成'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

ClothingLibraryModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  clothing: PropTypes.arrayOf(PropTypes.object),
  customClothing: PropTypes.arrayOf(PropTypes.object),
  wardrobeClothing: PropTypes.arrayOf(PropTypes.object),
  selected: PropTypes.arrayOf(PropTypes.object).isRequired,
  onToggleSelect: PropTypes.func.isRequired,
  onRemoveSelected: PropTypes.func.isRequired,
  onRemoveWardrobeItem: PropTypes.func,
  t: PropTypes.func.isRequired,
  sessionId: PropTypes.string,
  defaultCustomCategory: PropTypes.string,
  onCustomUploadFile: PropTypes.func,
}

export default ClothingLibraryModal
