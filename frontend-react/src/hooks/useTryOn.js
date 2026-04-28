import { useState, useCallback } from 'react'

import { api, getMediaUrl } from '../utils/request'
import { API_ENDPOINTS } from '../config/api'

/**
 * 试穿 Hook
 */
export function useTryOn({ sessionId, onComplete, onError } = {}) {
  const [status, setStatus] = useState('idle') // idle, pending, processing, completed, failed
  const [progress, setProgress] = useState(0)
  const [resultUrl, setResultUrl] = useState(null)
  const [avatarKey, setAvatarKey] = useState(null)
  const [estimatedTime, setEstimatedTime] = useState(0)
  const [remainingTime, setRemainingTime] = useState(0)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [modelPhotos, setModelPhotos] = useState([])
  const [modelPhotosLoading, setModelPhotosLoading] = useState(false)

  // 获取历史记录
  const fetchHistory = useCallback(async () => {
    if (!sessionId) {
      return
    }

    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('session_id', sessionId)
      params.append('page_size', '20')

      const response = await api.get(`${API_ENDPOINTS.TRYON.RECORDS}?${params}`)

      if (response.success) {
        const results = response.data?.results || response.data?.data?.results || []
        const processedResults = results.map(item => ({
          ...item,
          result_image: getMediaUrl(item.result_url),
          avatar_image: getMediaUrl(item.avatar_image),
        }))
        setHistory(processedResults)
      }
    } catch {
      setHistory([])
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  // 获取模特照片
  const fetchModelPhotos = useCallback(async () => {
    setModelPhotosLoading(true)
    try {
      const response = await api.get(API_ENDPOINTS.COMMON.MODEL_PHOTOS)
      if (response.success) {
        const data = response.data?.data || response.data
        setModelPhotos(data)
      }
    } catch (error) {
      console.error('Failed to fetch model photos:', error)
      setModelPhotos([])
    } finally {
      setModelPhotosLoading(false)
    }
  }, [])

  // 轮询任务状态
  const pollStatus = useCallback(
    async recordUuid => {
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

              if (onComplete) {
                onComplete({ resultUrl: fullUrl })
              }
              return
            }

            if (data.status === 'failed') {
              setStatus('failed')
              if (onError) {
                onError(data.error_message || '处理失败')
              }
              return
            }

            // 继续轮询
            if (data.status === 'processing' || data.status === 'pending') {
              setTimeout(poll, 2000)
            }
          }
        } catch {
          // 继续轮询
          setTimeout(poll, 3000)
        }
      }

      // 开始轮询
      poll()
    },
    [onComplete, onError, fetchHistory]
  )

  // 上传图片
  const uploadImage = useCallback(async (file, type = 'avatar') => {
    const formData = new FormData()
    formData.append('image', file)

    const endpoint =
      type === 'avatar' ? API_ENDPOINTS.TRYON.UPLOAD_AVATAR : API_ENDPOINTS.TRYON.UPLOAD_CLOTHING

    const response = await api.upload(endpoint, formData)

    if (response.success) {
      const data = response.data?.data || response.data
      return {
        imageKey: data.image_key,
        imageUrl: data.image_url,
        isDuplicate: data.is_duplicate,
      }
    }

    throw new Error(response.error || '上传失败')
  }, [])

  // 提交试穿任务
  const submitTask = useCallback(
    /**
     * 提交试穿任务（全部使用 key/uuid 方式）
     * @param {File|null} avatarFile - 头像文件（新上传）
     * @param {Array} clothingItems - 服装列表
     * @param {string|null} avatarKeyToReuse - 复用的头像 key
     */
    async (avatarFile, clothingItems, avatarKeyToReuse = null) => {
      setStatus('pending')
      setProgress(0)

      try {
        // 1. 上传头像（如果没有复用的 key）
        let finalAvatarKey = avatarKeyToReuse

        if (!finalAvatarKey && avatarFile) {
          const uploadResult = await uploadImage(avatarFile, 'avatar')
          finalAvatarKey = uploadResult.imageKey
        }

        if (!finalAvatarKey) {
          throw new Error('请提供头像文件或头像 key')
        }

        // 2. 处理服装列表
        // 过滤掉正在上传的服装
        const validClothingItems = clothingItems.filter(item => !item.isUploading)

        // 分离已有 key 的服装和需要上传的服装
        const itemsWithKey = validClothingItems.filter(item => item.image_key)
        const itemsNeedUpload = validClothingItems.filter(
          item =>
            !item.image_key &&
            !(
              item.uuid &&
              !item.uuid.startsWith('custom_') &&
              !item.uuid.startsWith('wardrobe_') &&
              !item.isCustom
            ) &&
            item.imageFile
        )

        // 上传需要上传的服装
        const uploadResults = await Promise.all(
          itemsNeedUpload.map(item => uploadImage(item.imageFile, 'clothing'))
        )

        // 合并所有服装 UUID
        const clothingUuids = [
          // 已有 key 的服装
          ...itemsWithKey.map(item => `key:${item.image_key}`),
          // 数据库服装
          ...validClothingItems
            .filter(
              item =>
                !item.image_key &&
                item.uuid &&
                !item.uuid.startsWith('custom_') &&
                !item.uuid.startsWith('wardrobe_') &&
                !item.isCustom
            )
            .map(item => item.uuid),
          // 新上传的服装
          ...uploadResults.map(result => `key:${result.imageKey}`),
        ]

        if (clothingUuids.length === 0) {
          throw new Error('请至少选择一件服装')
        }

        // 3. 提交试穿任务
        const formData = new FormData()
        formData.append('avatar_key', finalAvatarKey)
        formData.append('clothing_uuids', clothingUuids.join(','))
        formData.append('session_id', sessionId || `session_${Date.now()}`)

        const response = await api.upload(API_ENDPOINTS.TRYON.GENERATE, formData)

        if (response.success) {
          const data = response.data?.data || response.data

          // 缓存返回的 avatar_key
          if (data.avatar_key) {
            setAvatarKey(data.avatar_key)
          }

          // 开始轮询状态
          if (data.record_uuid) {
            const estimated = data.estimated_time || 30
            setEstimatedTime(estimated)
            setRemainingTime(estimated)

            // 启动倒计时
            const countdownInterval = setInterval(() => {
              setRemainingTime(prev => {
                if (prev <= 1) {
                  clearInterval(countdownInterval)
                  return 0
                }
                return prev - 1
              })
            }, 1000)

            pollStatus(data.record_uuid)
          }

          return {
            success: true,
            recordUuid: data.record_uuid,
            avatarKey: data.avatar_key,
            clothesKeys: data.clothes_keys,
            estimatedTime: data.estimated_time,
          }
        }

        setStatus('failed')
        if (onError) {
          onError(response.error || response.message)
        }
        return { success: false, error: response.error || response.message }
      } catch (error) {
        setStatus('failed')
        if (onError) {
          onError(error.message || '提交失败')
        }
        return { success: false, error: error.message }
      }
    },
    [sessionId, pollStatus, uploadImage, onError]
  )

  const clearResult = useCallback(() => {
    setResultUrl(null)
    setStatus('idle')
    setProgress(0)
  }, [])

  const reset = useCallback(() => {
    setStatus('idle')
    setProgress(0)
    setResultUrl(null)
    setAvatarKey(null)
    setEstimatedTime(0)
    setRemainingTime(0)
  }, [])

  const startGenerating = useCallback(() => {
    setStatus('pending')
    setProgress(0)
  }, [])

  const cancelGenerating = useCallback(() => {
    setStatus('idle')
    setProgress(0)
    setRemainingTime(0)
  }, [])

  return {
    status,
    progress,
    resultUrl,
    avatarKey,
    estimatedTime,
    remainingTime,
    history,
    loading,
    modelPhotos,
    modelPhotosLoading,
    submitTask,
    clearResult,
    reset,
    fetchHistory,
    fetchModelPhotos,
    uploadImage,
    startGenerating,
    cancelGenerating,
  }
}
