import { useState, useRef, useEffect, useCallback } from 'react'

import { api } from '../utils/request'
import { API_ENDPOINTS } from '../config/api'
import { STORAGE_KEYS } from '../constants/storageKeys'
import { safeStorage } from '../utils/safeStorage'

/**
 * 服装选择管理 Hook
 * 集中管理 selected（已选服装）、customClothing（自定义上传）、wardrobeClothing（衣橱收藏）
 * 三个状态及其持久化、增删操作。
 *
 * @param {Object} options
 * @param {Function} options.showToast - Toast 提示函数
 * @param {Function} options.t - 国际化翻译函数
 * @returns {Object} 服装选择状态和方法
 */
export function useClothingSelection({ showToast, t }) {
  // === 服装选择状态 ===
  const [selected, setSelected] = useState([]) // 已选中的服装列表
  const [customClothing, setCustomClothing] = useState([]) // 用户自定义上传的服装
  const [wardrobeClothing, setWardrobeClothing] = useState([]) // 从衣橱选择的服装

  // selected 的最新值快照：供回调内读取当前选中项而不必把 selected 加入依赖
  // （避免回调每次变化导致 memo 化的服装卡片全部重渲染）
  const selectedRef = useRef(selected)
  useEffect(() => {
    selectedRef.current = selected
  }, [selected])

  /** 持久化已选服装到缓存（兼容 image / image_url 两种字段名） */
  const persistSelected = useCallback(list => {
    try {
      safeStorage.setItem(
        STORAGE_KEYS.SELECTED_CLOTHING,
        list.map(i => ({
          id: i.id,
          uuid: i.uuid,
          name: i.name,
          category: i.category,
          color: i.color,
          image_url: i.image_url || i.image,
          image_thumb_url: i.image_thumb_url || i.image,
          image_key: i.image_key,
          isCustom: i.isCustom,
          isWardrobe: i.isWardrobe,
        }))
      )
    } catch (e) {
      console.warn('存储失败:', e)
    }
  }, [])

  /**
   * 切换服装选中状态
   * - 已选中则取消选择
   * - 未选中则添加（同一分类至多保留一件，新选择会替换同类旧选择）
   */
  const handleToggle = useCallback(
    item => {
      if (!item || item.id === undefined) {
        console.warn('handleToggle: 无效的服装项', item)
        return
      }

      const prev = selectedRef.current
      const name = item.name || t('clothingUnnamed') || '未命名'

      if (prev.some(s => s.id === item.id)) {
        const newList = prev.filter(s => s.id !== item.id)
        setSelected(newList)
        persistSelected(newList)
        showToast(t('n_clothingRemoved', { name }), 'info')
        return
      }

      // 同一分类至多保留一件：新选择会替换掉同类的旧选择，需显式告知用户
      const replaced = prev.find(s => s.category === item.category)
      const newList = [...prev.filter(s => s.category !== item.category), item]
      setSelected(newList)
      persistSelected(newList)
      showToast(
        replaced ? t('n_clothingReplaced', { name }) : t('n_clothingAdded', { name }),
        replaced ? 'info' : 'success'
      )
    },
    [persistSelected, showToast, t]
  )

  /** 移除已选服装；id 为 null/undefined 时表示「清空已选」 */
  const handleRemoveSelected = useCallback(
    id => {
      const prev = selectedRef.current
      const newList = id === null || id === undefined ? [] : prev.filter(s => s.id !== id)
      if (newList.length === prev.length) {
        return
      }
      setSelected(newList)
      persistSelected(newList)
      showToast(t('clothingDeselected') || '已取消选择', 'info')
    },
    [persistSelected, showToast, t]
  )

  /** 加入「我的衣橱」（服装库弹窗心形收藏触发） */
  const handleAddWardrobeItem = useCallback(item => {
    const id = item?.id ?? item?.image_key ?? item?.key
    if (!id) {
      return
    }
    setWardrobeClothing(prev => {
      if (prev.some(i => (i.id ?? i.image_key ?? i.key) === id)) {
        return prev
      }
      // 兼容两种来源：已归一化的服装库 item（含 image/imageFull），或后端原始 item（含 thumb_url/image_url）
      const normalized = {
        id: item.id,
        uuid: item.uuid ?? item.id,
        name: item.name,
        category: item.category,
        color: item.color,
        price: item.price,
        size: item.size ?? '',
        image: item.image || item.thumb_url || item.image_url,
        imageFull: item.imageFull || item.image_url || item.image,
        image_key: item.image_key,
        source: item.source || 'wardrobe',
        isWardrobe: true,
      }
      const next = [...prev, normalized]
      safeStorage.setItem(STORAGE_KEYS.WARDROBE_CLOTHING, next)
      return next
    })
  }, [])

  /** 从「我的衣橱」移除单件服装（服装库弹窗心形点击触发）—— 同步移出已选 */
  const handleRemoveWardrobeItem = useCallback(
    item => {
      const id = item?.id ?? item?.image_key ?? item?.key
      if (!id) {
        return
      }
      setWardrobeClothing(prev => {
        const next = prev.filter(i => (i.id ?? i.image_key ?? i.key) !== id)
        safeStorage.setItem(STORAGE_KEYS.WARDROBE_CLOTHING, next)
        return next
      })
      // 取消收藏时同步移出「已选」，否则该服装仍会参与试穿
      setSelected(prev => {
        const next = prev.filter(i => (i.id ?? i.image_key ?? i.key) !== id)
        if (next.length !== prev.length) {
          persistSelected(next)
        }
        return next
      })
    },
    [persistSelected]
  )

  /** 移除自定义上传的服装（同步移除已选） */
  const removeCustomClothing = useCallback(id => {
    setSelected(prev => prev.filter(i => i.id !== id))
    setCustomClothing(prev => {
      const newList = prev.filter(i => i.id !== id)
      safeStorage.setItem(STORAGE_KEYS.CUSTOM_CLOTHING, newList)
      return newList
    })
  }, [])

  /** 移除衣橱中的服装（同步移除已选） */
  const removeWardrobeClothing = useCallback(id => {
    setSelected(prev => prev.filter(i => i.id !== id))
    setWardrobeClothing(prev => {
      const newList = prev.filter(i => i.id !== id)
      safeStorage.setItem(STORAGE_KEYS.WARDROBE_CLOTHING, newList)
      return newList
    })
  }, [])

  /** 添加自定义服装（上传成功后调用） */
  const addCustomClothing = useCallback(item => {
    setCustomClothing(prev => {
      const newList = [...prev, item]
      safeStorage.setItem(STORAGE_KEYS.CUSTOM_CLOTHING, newList)
      return newList
    })
  }, [])

  /** 更新自定义服装（上传中替换为最终结果） */
  const updateCustomClothing = useCallback((tempId, newItem) => {
    setCustomClothing(prev => {
      const newList = prev.map(i => (i.id === tempId ? newItem : i))
      safeStorage.setItem(STORAGE_KEYS.CUSTOM_CLOTHING, newList)
      return newList
    })
  }, [])

  /** 从自定义服装列表中移除某项（上传失败时清理占位项） */
  const removeCustomClothingByTempId = useCallback(tempId => {
    setCustomClothing(prev => prev.filter(item => item.id !== tempId))
  }, [])

  /** 设置衣橱服装列表（从后端拉取后批量设置） */
  const setWardrobeClothingWithPersist = useCallback(items => {
    setWardrobeClothing(items)
    safeStorage.setItem(STORAGE_KEYS.WARDROBE_CLOTHING, items)
  }, [])

  /** 更新衣橱服装（上传中替换占位项为最终结果，并持久化） */
  const updateWardrobeClothing = useCallback((tempId, newItem) => {
    setWardrobeClothing(prev => {
      const newList = prev.map(i => (i.id === tempId ? newItem : i))
      safeStorage.setItem(STORAGE_KEYS.WARDROBE_CLOTHING, newList)
      return newList
    })
  }, [])

  /** 从衣橱列表中移除某项（上传失败时清理占位项，不持久化） */
  const removeWardrobeByTempId = useCallback(tempId => {
    setWardrobeClothing(prev => prev.filter(item => item.id !== tempId))
  }, [])

  /**
   * 删除自定义服装（先尝试云端删除，再本地移除）
   * @param {string} id - 服装 ID
   * @returns {Promise<boolean>} 是否成功（云端删除失败时仍会本地移除，返回 false）
   */
  const deleteCustomClothing = useCallback(
    async id => {
      const item = customClothing.find(c => c.id === id)
      let cloudSuccess = true

      if (item?.uuid && !item.uuid.startsWith('custom_')) {
        try {
          await api.delete(API_ENDPOINTS.WARDROBE.CLOTHING_DETAIL(item.uuid))
        } catch (e) {
          console.warn('云端删除自定义服装失败:', e)
          cloudSuccess = false
        }
      }

      removeCustomClothing(id)
      return cloudSuccess
    },
    [customClothing, removeCustomClothing]
  )

  /**
   * 删除衣橱服装（先尝试云端删除，再本地移除）
   * @param {string} id - 服装 ID
   * @returns {Promise<boolean>} 是否成功（云端删除失败时仍会本地移除，返回 false）
   */
  const deleteWardrobeClothing = useCallback(
    async id => {
      const item = wardrobeClothing.find(c => c.id === id)
      let cloudSuccess = true

      if (item?.uuid && !item.uuid.startsWith('wardrobe_')) {
        try {
          await api.delete(API_ENDPOINTS.WARDROBE.CLOTHING_DETAIL(item.uuid))
        } catch (e) {
          console.warn('云端删除衣橱服装失败:', e)
          cloudSuccess = false
        }
      }

      removeWardrobeClothing(id)
      return cloudSuccess
    },
    [wardrobeClothing, removeWardrobeClothing]
  )

  /** 清空所有服装选择状态和缓存 */
  const clearAllClothing = useCallback(() => {
    setSelected([])
    setCustomClothing([])
    setWardrobeClothing([])
    safeStorage.removeItem(STORAGE_KEYS.SELECTED_CLOTHING)
    safeStorage.removeItem(STORAGE_KEYS.CUSTOM_CLOTHING)
    safeStorage.removeItem(STORAGE_KEYS.WARDROBE_CLOTHING)
  }, [])

  /** 从缓存加载服装数据（初始化时调用） */
  const loadFromCache = useCallback(async ({ includeCustomAndWardrobe = true } = {}) => {
    // 加载已选服装缓存
    const cachedSelected = await safeStorage.getItem(STORAGE_KEYS.SELECTED_CLOTHING)
    if (cachedSelected) {
      try {
        const parsed =
          typeof cachedSelected === 'string' ? JSON.parse(cachedSelected) : cachedSelected
        // 检查服装是否有 image_url 和 image_key（后端试穿接口必需 image_key）
        const validItems = parsed.filter(item => item.image_url && item.image_key)
        if (parsed.length > 0 && validItems.length === 0) {
          // 所有服装都缺少关键字段，清除无效缓存
          safeStorage.removeItem(STORAGE_KEYS.SELECTED_CLOTHING)
        } else {
          setSelected(validItems)
        }
      } catch (e) {
        console.error('[Cache] 解析已选服装缓存失败:', e)
      }
    }

    if (includeCustomAndWardrobe) {
      // 加载自定义服装缓存
      const cachedCustomClothing = await safeStorage.getItem(STORAGE_KEYS.CUSTOM_CLOTHING)
      if (cachedCustomClothing) {
        try {
          const parsed =
            typeof cachedCustomClothing === 'string'
              ? JSON.parse(cachedCustomClothing)
              : cachedCustomClothing
          setCustomClothing(parsed)
        } catch (e) {
          // 忽略解析错误
        }
      }

      // 加载衣橱服装缓存
      const cachedWardrobeClothing = await safeStorage.getItem(STORAGE_KEYS.WARDROBE_CLOTHING)
      if (cachedWardrobeClothing) {
        try {
          const parsed =
            typeof cachedWardrobeClothing === 'string'
              ? JSON.parse(cachedWardrobeClothing)
              : cachedWardrobeClothing
          setWardrobeClothing(parsed)
        } catch (e) {
          // 忽略解析错误
        }
      }
    }
  }, [])

  return {
    // 状态
    selected,
    setSelected,
    customClothing,
    setCustomClothing,
    wardrobeClothing,
    setWardrobeClothing,
    // 已选操作
    handleToggle,
    handleRemoveSelected,
    persistSelected,
    // 衣橱操作
    handleAddWardrobeItem,
    handleRemoveWardrobeItem,
    setWardrobeClothingWithPersist,
    updateWardrobeClothing,
    removeWardrobeClothing,
    removeWardrobeByTempId,
    deleteWardrobeClothing,
    // 自定义服装操作
    addCustomClothing,
    updateCustomClothing,
    removeCustomClothing,
    removeCustomClothingByTempId,
    deleteCustomClothing,
    // 批量操作
    clearAllClothing,
    loadFromCache,
  }
}
