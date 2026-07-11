import { useState, useCallback, useRef, useEffect } from 'react'

import { api, getMediaUrl } from '../utils/request'
import { API_ENDPOINTS } from '../config/api'

/**
 * 试穿 Hook
 *
 * 管理虚拟试穿的完整流程：头像上传 → 服装选择 → 提交任务 → 轮询状态 → 获取结果
 * 同时维护历史记录和模特照片列表
 */
export function useTryOn({ sessionId, onComplete, onError } = {}) {
  // 试穿任务状态：idle → pending → processing → completed/failed
  const [status, setStatus] = useState('idle')
  const [progress, setProgress] = useState(0) // 进度百分比（模拟+后端实际进度取最大值）
  const [resultUrl, setResultUrl] = useState(null) // 结果图片 URL
  const [avatarKey, setAvatarKey] = useState(null) // 当前使用的头像 key
  const [estimatedTime, setEstimatedTime] = useState(0) // 预计耗时（秒）
  const [remainingTime, setRemainingTime] = useState(0) // 剩余时间（秒）
  const [history, setHistory] = useState([]) // 历史试穿记录
  const [loading, setLoading] = useState(false) // 历史记录加载中
  const [modelPhotos, setModelPhotos] = useState([]) // 系统模特照片列表
  const [modelPhotosLoading, setModelPhotosLoading] = useState(false)

  // 定时器追踪（用于清理）
  const pollTimerRef = useRef(null)
  const countdownTimerRef = useRef(null)

  // 组件卸载时清理所有定时器
  useEffect(
    () => () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current)
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current)
      }
    },
    []
  )

  /** 获取当前会话的历史试穿记录 */
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

  /** 获取系统模特照片列表 */
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

  /**
   * 轮询任务状态
   * 每2秒查询一次后端状态，直到任务完成或失败
   * 进度显示逻辑：模拟进度与后端实际进度取最大值
   */
  const pollStatus = useCallback(
    async (recordUuid, countdownInterval = null) => {
      // 清理之前的定时器
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current)
      }
      if (countdownInterval) {
        countdownTimerRef.current = countdownInterval
      }

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
              // 清理所有定时器
              if (pollTimerRef.current) {
                clearTimeout(pollTimerRef.current)
              }
              if (countdownTimerRef.current) {
                clearInterval(countdownTimerRef.current)
              }

              // 显示100%完成状态
              setProgress(100)
              setRemainingTime(0)

              // 检查结果 URL 是否为空
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

              // 刷新历史记录
              fetchHistory()

              if (onComplete) {
                onComplete({ resultUrl: fullUrl })
              }
              return
            }

            if (data.status === 'failed') {
              // 清理所有定时器
              if (pollTimerRef.current) {
                clearTimeout(pollTimerRef.current)
              }
              if (countdownTimerRef.current) {
                clearInterval(countdownTimerRef.current)
              }

              setStatus('failed')
              if (onError) {
                onError(data.error_message || '处理失败')
              }
              return
            }

            // 继续轮询
            if (data.status === 'processing' || data.status === 'pending') {
              pollTimerRef.current = setTimeout(poll, 2000)
            }
          }
        } catch {
          // 继续轮询（错误时等待更长）
          pollTimerRef.current = setTimeout(poll, 3000)
        }
      }

      // 开始轮询
      poll()
    },
    [onComplete, onError, fetchHistory]
  )

  /**
   * 上传图片（头像或服装）
   * @param {File} file - 图片文件
   * @param {string} type - 类型：'avatar' 或 'clothing'
   * @returns {Object} { imageKey, imageUrl, isDuplicate }
   */
  const uploadImage = useCallback(async (file, type = 'avatar') => {
    const formData = new FormData()
    formData.append('file', file)

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

  /**
   * 提交试穿任务
   * 完整流程：头像处理 → 服装列表构建 → 提交 → 启动轮询
   * @param {File|null} avatarFile - 头像文件（新上传时使用）
   * @param {Array} clothingItems - 服装列表（每个item必须有uuid）
   * @param {string|null} keyToReuse - 复用的头像 key（avatar_key 或 model_key）
   * @param {string} avatarSource - 头像来源：system/user/history
   */
  const submitTask = useCallback(
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

        // 2. 处理服装列表 - 只传服装ID（uuid）
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

        // 3. 提交试穿任务
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

          console.warn('[useTryOn] 响应数据:', data)
          console.warn('[useTryOn] estimated_time:', data.estimated_time)

          // 缓存返回的 avatar_key
          if (data.avatar_key) {
            setAvatarKey(data.avatar_key)
          }

          // 开始轮询状态
          if (data.record_uuid) {
            const estimated = data.estimated_time || 30
            console.warn('[useTryOn] 设置预计时间:', estimated)
            setEstimatedTime(estimated)
            setRemainingTime(estimated)

            // 清理之前的倒计时定时器
            if (countdownTimerRef.current) {
              clearInterval(countdownTimerRef.current)
            }

            // 启动倒计时和进度模拟
            const startTime = Date.now()
            countdownTimerRef.current = setInterval(() => {
              const elapsed = (Date.now() - startTime) / 1000
              const remaining = Math.max(0, estimated - elapsed)
              const remainingCeil = Math.ceil(remaining)
              console.warn('[useTryOn] 倒计时:', remainingCeil)
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

            pollStatus(data.record_uuid, countdownTimerRef.current)
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

  /** 清除当前结果，回到空闲状态 */
  const clearResult = useCallback(() => {
    // 清理所有定时器
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
    }
    setResultUrl(null)
    setStatus('idle')
    setProgress(0)
  }, [])

  /** 重置所有状态（含 avatarKey） */
  const reset = useCallback(() => {
    // 清理所有定时器
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
    }
    setStatus('idle')
    setProgress(0)
    setResultUrl(null)
    setAvatarKey(null)
    setEstimatedTime(0)
    setRemainingTime(0)
  }, [])

  /** 开始生成（仅设置状态，不提交任务） */
  const startGenerating = useCallback(() => {
    setStatus('pending')
    setProgress(0)
  }, [])

  /** 取消生成中状态 */
  const cancelGenerating = useCallback(() => {
    // 清理所有定时器
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
    }
    setStatus('idle')
    setProgress(0)
    setRemainingTime(0)
  }, [])

  /** 更新历史记录中的单条记录（如收藏状态变更） */
  const updateHistoryRecord = useCallback((uuid, updates) => {
    setHistory(prev =>
      prev.map(record => (record.uuid === uuid ? { ...record, ...updates } : record))
    )
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
