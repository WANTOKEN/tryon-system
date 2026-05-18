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
        const results =
          response.data?.items ||
          response.data?.data?.items ||
          response.data?.results ||
          response.data?.data?.results ||
          []
        const processedResults = results.map(item => ({
          ...item,
          result_url: item.result_url,
          result_thumb_url: item.result_thumb_url,
          avatar_url: item.avatar_url,
          avatar_key: item.avatar_key,
          avatar_source: item.avatar_source,
          result_image: getMediaUrl(item.result_url),
          avatar_image: getMediaUrl(item.avatar_url),
          clothing: item.clothing || [],
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
    async (recordUuid, countdownInterval = null) => {
      setStatus('processing')

      const poll = async () => {
        try {
          const response = await api.get(API_ENDPOINTS.TRYON.STATUS(recordUuid))

          if (response.success) {
            const data = response.data?.data || response.data
            // 使用后端返回的进度（如果比模拟进度高）
            const backendProgress = data.progress || 0
            setProgress(prev => Math.max(prev, backendProgress))

            if (data.status === 'completed') {
              // 清理倒计时
              if (countdownInterval) {
                clearInterval(countdownInterval)
              }

              // 先显示100%进度，让用户看到完成状态
              setProgress(100)
              setRemainingTime(0)

              // 延迟500ms后再显示结果，让用户看到100%
              setTimeout(() => {
                // 检查 result_url 是否为空
                if (!data.result_url) {
                  setStatus('failed')
                  if (onError) {
                    onError('生成失败，未获取到结果图片')
                  }
                  return
                }

                const fullUrl = getMediaUrl(data.result_url)
                setResultUrl(fullUrl)
                setStatus('completed')

                // 刷新历史
                fetchHistory()

                if (onComplete) {
                  onComplete({ resultUrl: fullUrl })
                }
              }, 500)
              return
            }

            if (data.status === 'failed') {
              // 清理倒计时
              if (countdownInterval) {
                clearInterval(countdownInterval)
              }
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
     * 提交试穿任务（新逻辑）
     * @param {File|null} avatarFile - 头像文件（新上传）
     * @param {Array} clothingItems - 服装列表（每个item必须有uuid，即服装ID）
     * @param {string|null} keyToReuse - 复用的 key（avatar_key 或 model_key）
     * @param {string} avatarSource - 头像来源：system/user/history
     */
    async (avatarFile, clothingItems, keyToReuse = null, avatarSource = 'user') => {
      setStatus('pending')
      setProgress(0)

      try {
        // 1. 处理头像参数
        let finalAvatarKey = ''
        let finalModelKey = ''
        let finalAvatarSource = avatarSource

        // 根据来源设置对应的 key
        if (avatarSource === 'system') {
          // 系统模特：使用 model_key
          finalModelKey = keyToReuse || ''
        } else if (!keyToReuse && avatarFile) {
          // 用户上传：新上传头像
          const uploadResult = await uploadImage(avatarFile, 'avatar')
          finalAvatarKey = uploadResult.imageKey
          finalAvatarSource = 'user'
          // eslint-disable-next-line no-console
          console.log('Avatar uploaded, key:', finalAvatarKey)
        } else {
          // 用户上传或历史记录：使用传入的 key
          finalAvatarKey = keyToReuse || ''
        }

        // 验证参数
        if (finalAvatarSource === 'system' && !finalModelKey) {
          throw new Error('请提供模特key')
        }
        if (finalAvatarSource !== 'system' && !finalAvatarKey) {
          throw new Error('请提供头像文件或头像key')
        }

        // eslint-disable-next-line no-console
        console.log(
          'Using avatarSource:',
          finalAvatarSource,
          'avatarKey:',
          finalAvatarKey,
          'modelKey:',
          finalModelKey
        )

        // 等待一小段时间确保 OSS 文件可用
        // eslint-disable-next-line no-promise-executor-return
        await new Promise(resolve => setTimeout(resolve, 500))

        // 2. 处理服装列表 - 新逻辑：只传服装ID（uuid）
        // 过滤掉正在上传的服装和没有uuid的服装
        const validClothingItems = clothingItems.filter(
          item => !item.isUploading && item.uuid && !item.uuid.startsWith('custom_')
        )

        // 提取服装ID列表
        const clothingIds = validClothingItems.map(item => item.uuid)

        if (clothingIds.length === 0) {
          throw new Error('请至少选择一件服装')
        }

        // 构建服装详细信息列表（用于后端存储）
        const clothingInfoList = validClothingItems.map(item => ({
          uuid: item.uuid,
          name: item.name || '未知服装',
          category: item.category || 'custom',
          subcategory: item.subcategory || 'custom',
          color: item.color || '#000000',
          is_custom: false, // 从数据库选择的服装都不是自定义的
        }))

        // 3. 提交试穿任务 - 新参数格式
        const formData = new FormData()
        formData.append('avatar_source', finalAvatarSource)
        if (finalAvatarKey) {
          formData.append('avatar_key', finalAvatarKey)
        }
        if (finalModelKey) {
          formData.append('model_key', finalModelKey)
        }
        formData.append('clothing_ids', clothingIds.join(','))
        formData.append('clothing_info', JSON.stringify(clothingInfoList))
        formData.append('session_id', sessionId || `session_${Date.now()}`)

        const response = await api.upload(API_ENDPOINTS.TRYON.GENERATE, formData)

        if (response.success) {
          const data = response.data?.data || response.data
          
          console.log('[useTryOn] 响应数据:', data)
          console.log('[useTryOn] estimated_time:', data.estimated_time)

          // 缓存返回的 avatar_key
          if (data.avatar_key) {
            setAvatarKey(data.avatar_key)
          }

          // 开始轮询状态
          if (data.record_uuid) {
            const estimated = data.estimated_time || 30
            console.log('[useTryOn] 设置预计时间:', estimated)
            setEstimatedTime(estimated)
            setRemainingTime(estimated)

            // 启动倒计时和进度模拟
            const startTime = Date.now()
            const countdownInterval = setInterval(() => {
              const elapsed = (Date.now() - startTime) / 1000
              const remaining = Math.max(0, estimated - elapsed)
              const remainingCeil = Math.ceil(remaining)
              console.log('[useTryOn] 倒计时:', remainingCeil)
              setRemainingTime(remainingCeil)

              // 根据时间计算进度
              let timeProgress
              if (elapsed <= estimated) {
                // 前90%按时间比例
                timeProgress = (elapsed / estimated) * 90
              } else {
                // 超过预计时间后，从90%缓慢增加到99%
                const overtime = elapsed - estimated
                timeProgress = Math.min(99, 90 + (overtime / 10) * 9) // 10秒内从90%到99%
              }

              setProgress(prev =>
                // 如果后端返回的进度更高，使用后端进度
                Math.max(prev, Math.floor(timeProgress))
              )
            }, 500)

            pollStatus(data.record_uuid, countdownInterval)
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

  const updateHistoryRecord = useCallback((uuid, updates) => {
    setHistory(prev => prev.map(record =>
      record.uuid === uuid ? { ...record, ...updates } : record
    ))
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
    updateHistoryRecord,
    cancelGenerating,
  }
}
