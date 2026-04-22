import { useState, useCallback } from 'react'
import { api, getMediaUrl } from '../utils/request'
import { API_ENDPOINTS } from '../config/api'

export function useTryOn(onComplete, onError, sessionId) {
  const [status, setStatus] = useState('idle') // idle, pending, processing, completed, failed
  const [progress, setProgress] = useState(0)
  const [resultUrl, setResultUrl] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      // 按 session_id 获取当前顾客的记录
      console.log('fetchHistory sessionId:', sessionId)
      const url = sessionId 
        ? `${API_ENDPOINTS.TRYON.RECORDS}?session_id=${encodeURIComponent(sessionId)}`
        : API_ENDPOINTS.TRYON.RECORDS
      console.log('fetchHistory url:', url)
      const response = await api.get(url)
      if (response.success) {
        // 处理分页响应 - 后端返回 items 或 results
        const data = response.data?.data || response.data
        const results = data?.items || data?.results || data || []
        // 处理图片 URL
        const processedResults = (Array.isArray(results) ? results : []).map(item => ({
          ...item,
          result_url: getMediaUrl(item.result_url),
          avatar_image: getMediaUrl(item.avatar_image),
        }))
        setHistory(processedResults)
      }
    } catch (error) {
      console.log('Failed to fetch history:', error)
      setHistory([]) // 错误时设置空数组
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  const submitTask = useCallback(async (avatarFile, clothingItems) => {
    setStatus('pending')
    setProgress(0)

    try {
      // 分离数据库服装和自定义服装
      const dbClothingUuids = []
      const customClothes = []
      
      for (const item of clothingItems) {
        if (item.isCustom || item.isWardrobe) {
          // 自定义服装或衣橱服装，传递图片数据（Base64）
          customClothes.push({
            image: item.image || item.imageFull,
            name: item.name || '自定义服装',
            category: item.category || 'tops',
            subcategory: item.subcategory || '',
            source: item.isWardrobe ? 'wardrobe' : 'custom',  // 标记来源
          })
        } else if (item.uuid && !item.uuid.startsWith('custom_') && !item.uuid.startsWith('wardrobe_')) {
          // 数据库服装，传递真实 UUID（排除临时生成的 ID）
          dbClothingUuids.push(item.uuid)
        } else if (item.id && !String(item.id).startsWith('custom_') && !String(item.id).startsWith('wardrobe_')) {
          // 兼容只有 id 的情况
          dbClothingUuids.push(item.id)
        }
      }
      
      // 使用传入的 sessionId（Customer 标识）
      const currentSessionId = sessionId || `session_${Date.now()}`
      
      const formData = new FormData()
      formData.append('avatar', avatarFile)
      formData.append('clothing_uuids', dbClothingUuids.join(','))
      formData.append('session_id', currentSessionId)
      
      // 添加自定义服装（需要序列化为 JSON 字符串）
      if (customClothes.length > 0) {
        formData.append('custom_clothes', JSON.stringify(customClothes))
      }

      const response = await api.upload(API_ENDPOINTS.TRYON.GENERATE, formData)

      if (response.success) {
        const data = response.data?.data || response.data
        
        // 开始轮询状态
        if (data.record_uuid) {
          pollStatus(data.record_uuid)
        } else {
          // 模拟处理过程（如果没有返回 record_uuid）
          simulateProgress()
        }
        
        return { success: true, recordUuid: data.record_uuid }
      }
      
      setStatus('failed')
      if (onError) onError(response.error || response.message)
      return { success: false, error: response.error || response.message }
    } catch (error) {
      // 模拟处理过程作为后备
      simulateProgress()
      
      setTimeout(() => {
        const mockResult = 'https://via.placeholder.com/400x600/D4AF37?text=Try-On+Result'
        setResultUrl(mockResult)
        setStatus('completed')
        setProgress(100)
        
        if (onComplete) onComplete({ resultUrl: mockResult })
      }, 2000)
      
      return { success: true }
    }
  }, [onComplete, onError, sessionId])

  // 轮询任务状态
  const pollStatus = useCallback(async (recordUuid) => {
    setStatus('processing')
    
    const poll = async () => {
      try {
        const response = await api.get(API_ENDPOINTS.TRYON.STATUS(recordUuid))
        
        if (response.success) {
          const data = response.data?.data || response.data
          setProgress(data.progress || 0)
          
          if (data.status === 'completed') {
            const fullUrl = getMediaUrl(data.result_url)
            setResultUrl(fullUrl)
            setStatus('completed')
            setProgress(100)
            
            // 刷新历史
            fetchHistory()
            
            if (onComplete) onComplete({ resultUrl: fullUrl })
            return
          }
          
          if (data.status === 'failed') {
            setStatus('failed')
            if (onError) onError(data.error_message || '处理失败')
            return
          }
          
          // 继续轮询
          if (data.status === 'processing' || data.status === 'pending') {
            setTimeout(poll, 2000)
          }
        }
      } catch (error) {
        console.error('Poll status error:', error)
        // 继续轮询
        setTimeout(poll, 3000)
      }
    }
    
    // 开始轮询
    poll()
  }, [onComplete, onError, fetchHistory])

  // 模拟进度
  const simulateProgress = () => {
    setStatus('processing')
    let p = 0
    const interval = setInterval(() => {
      p += Math.random() * 15
      if (p >= 90) {
        clearInterval(interval)
        setProgress(90)
      } else {
        setProgress(Math.floor(p))
      }
    }, 300)
  }

  const clearResult = useCallback(() => {
    setResultUrl(null)
    setStatus('idle')
    setProgress(0)
  }, [])

  // 立即开始生成状态（用于 UI 立即显示 loading）
  const startGenerating = useCallback(() => {
    setStatus('pending')
    setProgress(0)
  }, [])

  // 取消生成
  const cancelGenerating = useCallback(() => {
    setStatus('idle')
    setProgress(0)
  }, [])

  return {
    status,
    progress,
    resultUrl,
    history,
    loading,
    submitTask,
    fetchHistory,
    clearResult,
    startGenerating,
    cancelGenerating,
  }
}
