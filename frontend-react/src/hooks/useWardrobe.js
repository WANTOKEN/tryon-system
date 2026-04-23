import { useState, useCallback } from 'react'

import { api } from '../utils/request'
import { API_ENDPOINTS } from '../config/api'

// 模拟数据
const MOCK_CATEGORIES = [
  { id: 'all', name: '全部', count: 14 },
  { id: 'tops', name: '上装', count: 4 },
  { id: 'bottoms', name: '下装', count: 3 },
  { id: 'dresses', name: '连衣裙', count: 1 },
  { id: 'outerwear', name: '外套', count: 2 },
  { id: 'shoes', name: '鞋', count: 2 },
  { id: 'accessories', name: '配饰', count: 2 },
]

const MOCK_CLOTHING = [
  {
    uuid: '1',
    name: '白色T恤',
    category: 'tops',
    subcategory: 't-shirt',
    color: '#FFFFFF',
    image_url: 'https://via.placeholder.com/200x200/FFFFFF?text=T-shirt',
  },
  {
    uuid: '2',
    name: '蓝色衬衫',
    category: 'tops',
    subcategory: 'shirt',
    color: '#4169E1',
    image_url: 'https://via.placeholder.com/200x200/4169E1?text=Shirt',
  },
  {
    uuid: '3',
    name: '黑色牛仔裤',
    category: 'bottoms',
    subcategory: 'jeans',
    color: '#000000',
    image_url: 'https://via.placeholder.com/200x200/000000?text=Jeans',
  },
  {
    uuid: '4',
    name: '红色连衣裙',
    category: 'dresses',
    subcategory: 'casual',
    color: '#DC143C',
    image_url: 'https://via.placeholder.com/200x200/DC143C?text=Dress',
  },
  {
    uuid: '5',
    name: '灰色夹克',
    category: 'outerwear',
    subcategory: 'jacket',
    color: '#808080',
    image_url: 'https://via.placeholder.com/200x200/808080?text=Jacket',
  },
  {
    uuid: '6',
    name: '白色运动鞋',
    category: 'shoes',
    subcategory: 'sneakers',
    color: '#FFFFFF',
    image_url: 'https://via.placeholder.com/200x200/FFFFFF?text=Sneakers',
  },
]

export function useWardrobe() {
  const [categories] = useState(MOCK_CATEGORIES)
  const [clothing, setClothing] = useState(MOCK_CLOTHING)
  const [selected, setSelected] = useState([])
  const [currentCategory, setCurrentCategory] = useState('all')
  const [loading, setLoading] = useState(false)

  const fetchClothing = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api.get(API_ENDPOINTS.WARDROBE.CLOTHING)
      if (response.success && response.data.results) {
        setClothing(response.data.results)
      } else {
        setClothing(MOCK_CLOTHING)
      }
    } catch (error) {
      // 使用模拟数据
    } finally {
      setLoading(false)
    }
  }, [])

  const uploadClothing = useCallback(async formData => {
    try {
      const response = await api.upload(API_ENDPOINTS.WARDROBE.CLOTHING, formData)
      if (response.success) {
        setClothing(prev => [response.data, ...prev])
        return { success: true }
      }
      return { success: false, error: response.error }
    } catch (error) {
      // 模拟上传成功
      const newItem = {
        uuid: Date.now().toString(),
        name: '新服装',
        category: formData.get('category'),
        image_url: 'https://via.placeholder.com/200x200/D4AF37?text=New',
      }
      setClothing(prev => [newItem, ...prev])
      return { success: true }
    }
  }, [])

  const toggleSelected = useCallback(uuid => {
    setSelected(prev => (prev.includes(uuid) ? prev.filter(id => id !== uuid) : [...prev, uuid]))
  }, [])

  const selectedClothing = clothing.filter(c => selected.includes(c.uuid))

  return {
    categories,
    clothing,
    selected,
    selectedClothing,
    currentCategory,
    loading,
    fetchClothing,
    uploadClothing,
    toggleSelected,
    setCurrentCategory,
  }
}
