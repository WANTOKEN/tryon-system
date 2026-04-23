import { useState, useCallback } from 'react'

import { api } from '../utils/request'
import { API_ENDPOINTS } from '../config/api'

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
      if (response.success && response.data?.results) {
        // 转换数据格式供前端使用
        const items = response.data.results.map(item => ({
          id: item.uuid,
          uuid: item.uuid,
          name: item.name,
          category: item.category,
          subcategory: item.subcategory,
          color: item.color || '#F5F4F0',
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
  const uploadClothing = useCallback(async (file, name, category, subcategory, color) => {
    setLoading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('image', file)
      formData.append('name', name || file.name.replace(/\.[^.]+$/, ''))
      formData.append('category', category)
      formData.append('subcategory', subcategory || '')
      if (color) {
        formData.append('color', color)
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
          image: item.image_thumb_url || item.image_url,
          imageFull: item.image_url,
          source: item.source,
        }
        setClothing(prev => [...prev, newItem])
        return { success: true, item: newItem }
      }
      return { success: false, error: response.error || '上传失败' }
    } catch (err) {
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [])

  // 删除服装
  const deleteClothing = useCallback(async uuid => {
    try {
      const response = await api.delete(API_ENDPOINTS.WARDROBE.CLOTHING_DETAIL(uuid))
      if (response.success) {
        setClothing(prev => prev.filter(item => item.uuid !== uuid))
        return { success: true }
      }
      return { success: false, error: response.error || '删除失败' }
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
