import { useEffect, useState } from 'react'

import { api } from '../utils/request'
import { API_ENDPOINTS } from '../config/api'
import { FALLBACK_COLOR_TAGS } from '../data/clothingData'

/**
 * 颜色标签的唯一数据源：后端 /api/v1/common/colors/。
 * 前端不再内置/臆造 hex，后端不可用时才回落到本地兜底表。
 * @returns {Array<{name: string, hex: string}>}
 */
export default function useColorTags() {
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

  return colorTags
}
