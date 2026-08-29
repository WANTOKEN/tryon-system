import { useState, useCallback } from 'react'

import { api } from '../utils/request'
import { API_ENDPOINTS } from '../config/api'

const MAX_NAME_LENGTH = 30

function truncateFileName(fileName, maxLength = MAX_NAME_LENGTH) {
  if (!fileName || fileName.length <= maxLength) {
    return fileName
  }
  const extIndex = fileName.lastIndexOf('.')
  if (extIndex === -1 || extIndex === 0) {
    return `${fileName.substring(0, maxLength - 3)}...`
  }
  const extension = fileName.substring(extIndex)
  const nameWithoutExt = fileName.substring(0, extIndex)
  const truncatedName = `${nameWithoutExt.substring(0, maxLength - extension.length - 3)}...`
  return truncatedName + extension
}

export function useClothing() {
  const [clothing, setClothing] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // 获取服装列表
  const fetchClothing = useCallback(async (filters = {}) => {
    setLoading(true)
    setError(null)
    try {
      const params = {}
      if (filters.category) {
        params.category = filters.category
      }
      if (filters.subcategory) {
        params.subcategory = filters.subcategory
      }
      if (filters.source) {
        params.source = filters.source
      }

      const response = await api.get(API_ENDPOINTS.WARDROBE.CLOTHING, params)
      // 支持多种响应格式:
      // 1. { results: [...] } - DRF 标准格式
      // 2. { items: [...] } - 自定义格式
      // 3. { data: { items: [...] } } - 嵌套格式（后端返回 { success, data: { items } }）
      const results =
        response.data?.results || response.data?.items || response.data?.data?.items || []
      if (response.success) {
        // 转换数据格式供前端使用
        const items = results.map(item => ({
          id: item.uuid,
          uuid: item.uuid,
          name: item.name,
          category: item.category,
          subcategory: item.subcategory,
          color: item.color || '#F5F4F0',
          price: item.price,
          sizes: item.sizes,
          image: item.image_thumb_url || item.image_url,
          imageFull: item.image_url,
          image_key: item.image_key, // 存储 key，用于复用（节省流量）
          source: item.source,
        }))
        setClothing(items)
        return items
      }
      return []
    } catch (err) {
      setError(err.message)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  // 获取分类配置
  const fetchCategories = useCallback(async () => {
    try {
      const response = await api.get(API_ENDPOINTS.WARDROBE.CATEGORIES)
      if (response.success && response.data) {
        const cats = response.data?.data || response.data
        setCategories(cats)
        return cats
      }
      return []
    } catch (err) {
      return []
    }
  }, [])

  // 上传服装
  const uploadClothing = useCallback(
    async (file, name, category, subcategory, color, price, sizes) => {
      setLoading(true)
      setError(null)
      try {
        const formData = new FormData()
        formData.append('file', file)
        const finalName = truncateFileName(name || file.name.replace(/\.[^.]+$/, ''))
        formData.append('name', finalName)
        formData.append('category', category)
        formData.append('subcategory', subcategory || '')
        if (color) {
          formData.append('color', color)
        }
        if (price !== undefined && price !== null && price !== '') {
          formData.append('price', price)
        }
        if (sizes) {
          formData.append('size', sizes)
        }

        const response = await api.upload(`${API_ENDPOINTS.WARDROBE.CLOTHING}upload/`, formData)
        if (response.success) {
          const item = response.data?.data || response.data
          const newItem = {
            id: item.uuid,
            uuid: item.uuid,
            name: item.name,
            category: item.category,
            subcategory: item.subcategory,
            color: item.color || '#F5F4F0',
            price: item.price,
            sizes: item.sizes,
            image: item.image_thumb_url || item.image_url,
            imageFull: item.image_url,
            source: item.source,
          }
          setClothing(prev => [...prev, newItem])
          return { success: true, item: newItem }
        }
        return { success: false, error: response.error || null }
      } catch (err) {
        setError(err.message)
        return { success: false, error: err.message }
      } finally {
        setLoading(false)
      }
    },
    []
  )

  // 删除服装
  const deleteClothing = useCallback(async uuid => {
    try {
      const response = await api.delete(
        `${API_ENDPOINTS.WARDROBE.CLOTHING_DETAIL(uuid)}?source=merchant_upload`
      )
      if (response.success) {
        setClothing(prev => prev.filter(item => item.uuid !== uuid))
        return { success: true }
      }
      return { success: false, error: response.error || null }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }, [])

  // 分类服装
  const getClothingByCategory = useCallback(
    categoryId => clothing.filter(item => item.category === categoryId),
    [clothing]
  )

  return {
    clothing,
    categories,
    loading,
    error,
    fetchClothing,
    fetchCategories,
    uploadClothing,
    deleteClothing,
    getClothingByCategory,
  }
}
