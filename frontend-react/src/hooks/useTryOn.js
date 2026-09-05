import { useState, useCallback, useRef, useEffect } from 'react'

import { api, getMediaUrl } from '../utils/request'
import { API_ENDPOINTS } from '../config/api'

/**
 * 试穿 Hook
 *
 * 管理虚拟试穿的完整流程：头像上传 → 服装选择 → 提交任务 → 轮询状态 → 获取结果
 * 同时维护历史记录和模特照片列表
 */
// 轮询总时长上限：超过后一律判定失败，避免后端返回未知状态时界面永久卡在「生成中」
const MAX_POLL_DURATION_MS = 5 * 60 * 1000

// 未注入 t 时的兜底：直接返回 key，与 useI18n 的行为保持一致
const defaultT = key => key

export function useTryOn({ sessionId, onComplete, onError, t = defaultT } = {}) {
  // 试穿任务状态：idle → pending → processing → completed/failed
  const [status, setStatus] = useState('idle')
  const [progress, setProgress] = useState(0) // 进度百分比（模拟+后端实际进度取最大值）
  const [resultUrl, setResultUrl] = useState(null) // 结果图片 URL
  const [recordId, setRecordId] = useState(null) // 当前结果对应的试穿记录 id（收藏用）
  const [errorMessage, setErrorMessage] = useState(null) // 失败文案（clearResult 不清，供结果页持久展示）
  const [avatarKey, setAvatarKey] = useState(null) // 当前使用的头像 key
  const [estimatedTime, setEstimatedTime] = useState(0) // 预计耗时（秒）
  const [remainingTime, setRemainingTime] = useState(0) // 剩余时间（秒）
  const [history, setHistory] = useState([]) // 历史试穿记录
  const [loading, setLoading] = useState(false) // 历史记录加载中
  const [historyError, setHistoryError] = useState(null) // 历史记录加载失败信息（可重试）
  const [modelPhotos, setModelPhotos] = useState([]) // 系统模特照片列表
  const [modelPhotosLoading, setModelPhotosLoading] = useState(false)

  // 定时器追踪（用于清理）
  const pollTimerRef = useRef(null)
  const countdownTimerRef = useRef(null)

  // 组件是否仍挂载：异步请求返回后据此判断是否还能安全地 setState
  const mountedRef = useRef(true)

  // 作废旧轮询的钩子：重新提交 / 取消 / 重置时调用，防止上一轮定时器「复活」
  const activePollRef = useRef(null)

  // 组件卸载时清理所有定时器
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current)
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current)
      }
    }
  }, [])

  /** 获取当前会话的历史试穿记录 */
  const fetchHistory = useCallback(async () => {
    if (!sessionId) {
      return
    }

    setLoading(true)
    setHistoryError(null)
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
      } else {
        setHistoryError(response.error || '历史记录加载失败，请重试')
      }
    } catch (err) {
      setHistory([])
      setHistoryError(err?.message || '历史记录加载失败，请重试')
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  /** 获取系统模特照片列表 */
  const fetchModelPhotos = useCallback(async () => {
    setModelPhotosLoading(true)
    try {
      const response = await api.get(API_ENDPOINTS.COMMON.MODEL_PHOTOS)
      const payload = response?.data ?? response
      const items = payload?.items ?? payload?.data ?? payload?.data?.data ?? []
      setModelPhotos(Array.isArray(items) ? items : [])
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
    async (taskId, countdownInterval = null) => {
      // 清理之前的定时器
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current)
      }
      if (countdownInterval) {
        countdownTimerRef.current = countdownInterval
      }

      setStatus('processing')
      setRecordId(taskId)
      setErrorMessage(null)

      // 本次轮询的截止时间与存活标记
      const deadline = Date.now() + MAX_POLL_DURATION_MS
      let active = true
      activePollRef.current?.()
      activePollRef.current = () => {
        active = false
      }

      const stopAllTimers = () => {
        if (pollTimerRef.current) {
          clearTimeout(pollTimerRef.current)
          pollTimerRef.current = null
        }
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current)
          countdownTimerRef.current = null
        }
      }

      const fail = message => {
        stopAllTimers()
        setStatus('failed')
        setErrorMessage(message || t('n_tryOnFail') || '处理失败')
        if (onError) {
          onError(message)
        }
      }

      const poll = async () => {
        if (!active || !mountedRef.current) {
          return
        }
        try {
          const response = await api.get(API_ENDPOINTS.TRYON.STATUS(taskId))

          if (!active || !mountedRef.current) {
            return
          }

          if (response.success) {
            const data = response.data?.data || response.data
            // 使用后端返回的进度（如果比模拟进度高）
            const backendProgress = data.progress || 0
            setProgress(prev => Math.max(prev, backendProgress))

            if (data.status === 'completed') {
              stopAllTimers()

              // 显示100%完成状态
              setProgress(100)
              setRemainingTime(0)

              // 检查结果 URL 是否为空
              if (!data.result_url) {
                fail(t('n_tryOnFail') || '生成失败，请重试')
                return
              }

              const fullUrl = getMediaUrl(data.result_url)
              setResultUrl(fullUrl)
              setStatus('completed')
              setErrorMessage(null)

              // 刷新历史记录
              fetchHistory()

              if (onComplete) {
                onComplete({ resultUrl: fullUrl })
              }
              return
            }

            if (data.status === 'failed') {
              fail(data.error_message || t('n_tryOnFail') || '处理失败')
              return
            }

            // 超出总时长上限：无论当前是什么状态都判定失败，避免界面卡在「生成中」
            if (Date.now() > deadline) {
              fail(t('tryOnTimeout') || '生成超时，请重试')
              return
            }

            // 其余状态（pending / processing / 未知）一律继续轮询
            pollTimerRef.current = setTimeout(poll, 2000)
          } else {
            // 请求本身失败（非网络异常）：此前这里没有任何分支，
            // 会导致轮询静默停止、界面永久卡在「生成中」且不给任何提示。
            // 404 表示任务记录不存在（如后端重启导致任务丢失），立即失败提示。
            if (response.status === 404) {
              api.markHandled(response)
              fail(response.error || t('n_tryOnFail') || '生成任务不存在，请重新生成')
              return
            }
            if (Date.now() > deadline) {
              api.markHandled(response)
              fail(response.error || t('tryOnTimeout') || '生成超时，请重试')
              return
            }
            // 其余错误按较长间隔继续轮询，给后端恢复的机会
            pollTimerRef.current = setTimeout(poll, 3000)
          }
        } catch {
          if (!active || !mountedRef.current) {
            return
          }
          if (Date.now() > deadline) {
            fail(t('tryOnTimeout') || '生成超时，请重试')
            return
          }
          // 继续轮询（错误时等待更长）
          pollTimerRef.current = setTimeout(poll, 3000)
        }
      }

      // 开始轮询
      poll()
    },
    [onComplete, onError, fetchHistory, t]
  )

  /**
   * 上传图片（头像或服装）
   * @param {File} file - 图片文件
   * @param {string} type - 类型：'avatar' 或 'clothing'
   * @returns {Object} { imageKey, imageUrl }
   */
  const uploadImage = useCallback(
    async (file, type = 'avatar') => {
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
        }
      }

      throw new Error(response.error || t('uploadFailed') || '上传失败')
    },
    [t]
  )

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
      // 作废旧轮询，避免上一轮任务的状态回写覆盖本次结果
      activePollRef.current?.()
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current)
      }
      setStatus('pending')
      setProgress(0)
      setErrorMessage(null)

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
        } else {
          // 用户上传或历史记录：使用传入的 key
          finalAvatarKey = keyToReuse || ''
        }

        // 验证参数
        if (finalAvatarSource === 'system' && !finalModelKey) {
          throw new Error(t('n_needAvatar') || '请先选择形象')
        }
        if (finalAvatarSource !== 'system' && !finalAvatarKey) {
          throw new Error(t('n_needAvatar') || '请先选择形象')
        }

        // 2. 处理服装列表
        // 过滤掉正在上传的服装和没有 uuid 的服装
        const validClothingItems = clothingItems.filter(
          item => !item.isUploading && item.uuid && !item.uuid.startsWith('custom_')
        )

        if (validClothingItems.length === 0) {
          throw new Error(t('n_needClothing') || '请至少选择一件服装')
        }

        // 后端 tryon_service._read_clothing_items 按 FileRecord.uuid 读取服装图字节流，
        // 因此这里必须传 image_key（即 FileRecord.uuid），而不是服装记录 id。
        const clothingIds = validClothingItems.map(item => item.image_key).filter(Boolean)

        if (clothingIds.length === 0) {
          throw new Error('所选服装缺少图片信息，请重新选择或重新上传服装')
        }

        // 构建服装详细信息列表（用于后端存储）
        const clothingInfoList = validClothingItems.map(item => ({
          uuid: item.uuid,
          name: item.name || '未知服装',
          category: item.category || 'custom',
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

          // 缓存返回的 avatar_key
          if (data.avatar_key) {
            setAvatarKey(data.avatar_key)
          }

          // 开始轮询状态（兼容后端返回 id / record_uuid 两种字段名）
          const newRecordId = data.id || data.record_uuid
          if (newRecordId) {
            const estimated = data.estimated_time || 30
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

            pollStatus(newRecordId, countdownTimerRef.current)
          }

          return {
            success: true,
            recordId: data.id || data.record_uuid,
            avatarKey: data.avatar_key,
            estimatedTime: data.estimated_time,
          }
        }

        const submitError = response.error || response.message
        setStatus('failed')
        setErrorMessage(submitError)
        if (onError) {
          // 已自行提示，标记消费避免全局兜底再弹一次
          api.markHandled(response)
          onError(submitError)
        }
        return { success: false, error: submitError }
      } catch (error) {
        setStatus('failed')
        setErrorMessage(error.message || t('n_tryOnFail') || '提交失败')
        if (onError) {
          onError(error.message || t('n_tryOnFail') || '提交失败')
        }
        return { success: false, error: error.message }
      }
    },
    [sessionId, pollStatus, uploadImage, onError, t]
  )

  /** 清空本地历史记录（结束会话/登出时使用，避免残留已被删除的记录） */
  const clearHistory = useCallback(() => {
    setHistory([])
  }, [])

  /**
   * 清除当前结果，回到空闲状态。
   * 注意：这里刻意不清 errorMessage —— 「重新生成」会先调用它，
   * 失败文案需要继续留在结果页上供用户查看/重试。
   */
  const clearResult = useCallback(() => {
    activePollRef.current?.()
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

  /** 显式清除失败文案（「清空重来」等需要回到完全初始态的场景使用） */
  const clearError = useCallback(() => {
    setErrorMessage(null)
  }, [])

  /** 重置所有状态（含 avatarKey） */
  const reset = useCallback(() => {
    activePollRef.current?.()
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
    setRecordId(null)
    setErrorMessage(null)
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
    activePollRef.current?.()
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
      prev.map(record =>
        record.id === uuid || record.uuid === uuid ? { ...record, ...updates } : record
      )
    )
  }, [])

  /**
   * 收藏/取消收藏单条历史记录
   * @param {string} uuid - 记录 ID
   * @param {boolean} saved - 新的收藏状态
   * @returns {Promise<boolean>} 是否成功
   */
  const saveHistoryRecord = useCallback(
    async (uuid, saved) => {
      try {
        const response = await api.post(API_ENDPOINTS.TRYON.SAVE(uuid), { save: saved })
        if (response.success) {
          updateHistoryRecord(uuid, { is_saved: saved })
          return true
        }
        return false
      } catch (error) {
        console.error(`[收藏] 异常:`, error)
        return false
      }
    },
    [updateHistoryRecord]
  )

  /**
   * 删除单条历史记录
   * @param {string} uuid - 记录 ID
   * @returns {Promise<boolean>} 是否成功
   */
  const deleteHistoryRecord = useCallback(
    async uuid => {
      try {
        const response = await api.delete(API_ENDPOINTS.TRYON.DELETE(uuid))
        if (response.success) {
          // 删除后刷新历史记录
          fetchHistory()
          return true
        }
        return false
      } catch (error) {
        console.error('[删除记录] 异常:', error)
        return false
      }
    },
    [fetchHistory]
  )

  /**
   * 清空当前会话的所有历史记录
   * @param {string} sessionId - 会话 ID
   * @returns {Promise<boolean>} 是否成功
   */
  const clearHistoryRecords = useCallback(
    async targetSessionId => {
      try {
        const response = await api.delete(
          `${API_ENDPOINTS.TRYON.CLEAR}?session_id=${encodeURIComponent(targetSessionId)}`
        )
        if (response.success) {
          // 清空后刷新历史记录
          await new Promise(resolve => {
            setTimeout(resolve, 100)
          })
          fetchHistory()
          return true
        }
        return false
      } catch (error) {
        console.error('[清空历史] 异常:', error)
        return false
      }
    },
    [fetchHistory]
  )

  return {
    status,
    progress,
    resultUrl,
    recordId,
    errorMessage,
    avatarKey,
    estimatedTime,
    remainingTime,
    history,
    loading,
    historyError,
    modelPhotos,
    modelPhotosLoading,
    submitTask,
    clearResult,
    clearError,
    clearHistory,
    reset,
    fetchHistory,
    fetchModelPhotos,
    uploadImage,
    startGenerating,
    updateHistoryRecord,
    cancelGenerating,
    saveHistoryRecord,
    deleteHistoryRecord,
    clearHistoryRecords,
  }
}
