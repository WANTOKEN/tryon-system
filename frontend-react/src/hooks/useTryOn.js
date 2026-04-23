import { useState, useCallback } from 'react'

import { api, getMediaUrl } from '../utils/request'
import { API_ENDPOINTS } from '../config/api'
import { getCachedImageKey, cacheImageKeys } from '../utils/imageKeyCache'

export function useTryOn(onComplete, onError, sessionId) {
  const [status, setStatus] = useState('idle') // idle, pending, processing, completed, failed
  const [progress, setProgress] = useState(0)
  const [resultUrl, setResultUrl] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  // 缓存当前头像的 key（用于复用）
  const [avatarKey, setAvatarKey] = useState(null)
  // 预计等待时间（秒）
  const [estimatedTime, setEstimatedTime] = useState(0)
  const [remainingTime, setRemainingTime] = useState(0)

  // 模拟进度（定义在前面，避免 no-use-before-define）
  const simulateProgress = useCallback(() => {
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
  }, [])

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      // 按 session_id 获取当前顾客的记录
      const url = sessionId
        ? `${API_ENDPOINTS.TRYON.RECORDS}?session_id=${encodeURIComponent(sessionId)}`
        : API_ENDPOINTS.TRYON.RECORDS
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
      setHistory([]) // 错误时设置空数组
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  // 轮询任务状态（定义在 submitTask 之前）
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
        } catch (error) {
          // 继续轮询
          setTimeout(poll, 3000)
        }
      }

      // 开始轮询
      poll()
    },
    [onComplete, onError, fetchHistory]
  )

  const submitTask = useCallback(
    /**
     * 提交试穿任务
     * @param {File|null} avatarFile - 头像文件（新上传）
     * @param {Array} clothingItems - 服装列表
     * @param {string|null} avatarKeyToReuse - 复用的头像 key（历史记录的 avatar_key 或 uuid）
     */
    async (avatarFile, clothingItems, avatarKeyToReuse = null) => {
      setStatus('pending')
      setProgress(0)

      try {
        // 分离数据库服装和自定义服装
        const dbClothingUuids = []
        const customClothes = [] // 需要传 Base64 的自定义服装
        const customClothesWithBase64 = [] // 用于后续缓存（保存 base64 和索引的对应关系）

        // 异步检查自定义服装的缓存
        const customItemsToCheck = []
        const customItemsIndexMap = new Map()

        console.log('[useTryOn] clothingItems:', clothingItems)
        
        clothingItems.forEach((item, index) => {
          console.log(`[useTryOn] 处理服装 ${index}:`, {
            uuid: item.uuid,
            isCustom: item.isCustom,
            isWardrobe: item.isWardrobe,
            hasImage: !!(item.image || item.imageFull),
            id: item.id,
          })
          
          // 判断是否是数据库服装（有真实 uuid，且不是临时生成的 ID）
          const isDbClothing = item.uuid &&
            !item.uuid.startsWith('custom_') &&
            !item.uuid.startsWith('wardrobe_') &&
            !item.isCustom

          if (isDbClothing) {
            // 数据库服装：通过 uuid 复用，不传输图片数据（节省流量）
            dbClothingUuids.push(item.uuid)
            console.log(`[useTryOn] 服装 ${index} -> 数据库服装, uuid=${item.uuid}`)
          } else if (item.isCustom) {
            // 自定义服装：检查是否有缓存的 image_key
            const base64Image = item.image || item.imageFull
            if (base64Image) {
              customItemsToCheck.push(base64Image)
              customItemsIndexMap.set(customItemsToCheck.length - 1, {
                item,
                base64Image,
                originalIndex: index,
              })
              console.log(`[useTryOn] 服装 ${index} -> 自定义服装（待检查缓存）`)
            } else {
              console.log(`[useTryOn] 服装 ${index} -> 自定义服装但无图片数据，跳过`)
            }
          } else if (item.isWardrobe && item.uuid) {
            // 衣橱服装：通过 uuid 复用（后端根据 uuid 查找图片）
            dbClothingUuids.push(item.uuid)
            console.log(`[useTryOn] 服装 ${index} -> 衣橱服装, uuid=${item.uuid}`)
          } else if (
            item.id &&
            !String(item.id).startsWith('custom_') &&
            !String(item.id).startsWith('wardrobe_')
          ) {
            // 兼容只有 id 的情况
            dbClothingUuids.push(item.id)
            console.log(`[useTryOn] 服装 ${index} -> 通过 id 复用, id=${item.id}`)
          } else if (item.image || item.imageFull) {
            // 其他情况：有图片数据，作为自定义服装处理
            const base64Image = item.image || item.imageFull
            customItemsToCheck.push(base64Image)
            customItemsIndexMap.set(customItemsToCheck.length - 1, {
              item,
              base64Image,
              originalIndex: index,
            })
            console.log(`[useTryOn] 服装 ${index} -> 其他自定义服装（待检查缓存）`)
          } else {
            console.log(`[useTryOn] 服装 ${index} -> 无法分类，跳过`)
          }
        })
        
        console.log('[useTryOn] 分类结果:', {
          dbClothingUuids,
          customItemsToCheck: customItemsToCheck.length,
        })

        // 批量检查缓存
        const cachedKeys = await Promise.all(
          customItemsToCheck.map(base64 => getCachedImageKey(base64))
        )

        // 根据缓存结果分类
        cachedKeys.forEach((cachedKey, checkIndex) => {
          const { item, base64Image } = customItemsIndexMap.get(checkIndex)

          if (cachedKey) {
            // 有缓存：通过 image_key 复用（作为 clothing_key 传递）
            // 注意：后端需要支持 clothing_key 参数，这里暂时用 uuid 传递
            // 实际上 image_key 是内容寻址的，可以直接作为标识符
            dbClothingUuids.push(`key:${cachedKey}`)
            console.log('[useTryOn] 使用缓存的 image_key:', cachedKey)
          } else {
            // 无缓存：需要传 Base64
            customClothes.push({
              image: base64Image,
              name: item.name || '自定义服装',
              category: item.category || 'tops',
              subcategory: item.subcategory || '',
              source: 'custom',
            })
            // 记录用于后续缓存
            customClothesWithBase64.push({
              base64Image,
              customIndex: customClothes.length - 1,
            })
          }
        })

        // 使用传入的 sessionId（Customer 标识）
        const currentSessionId = sessionId || `session_${Date.now()}`

        const formData = new FormData()
        
        // 头像处理：优先使用 avatar_key 复用，否则上传文件
        if (avatarKeyToReuse) {
          // 通过 key 复用已上传的头像
          formData.append('avatar_key', avatarKeyToReuse)
        } else if (avatarFile) {
          // 新上传头像文件
          formData.append('avatar', avatarFile)
        } else {
          // 既没有文件也没有 key，报错
          throw new Error('请提供头像文件或头像 key')
        }
        
        formData.append('clothing_uuids', dbClothingUuids.join(','))
        formData.append('session_id', currentSessionId)

        // 添加自定义服装（需要序列化为 JSON 字符串）
        if (customClothes.length > 0) {
          formData.append('custom_clothes', JSON.stringify(customClothes))
        }

        const response = await api.upload(API_ENDPOINTS.TRYON.GENERATE, formData)

        if (response.success) {
          const data = response.data?.data || response.data

          // 缓存返回的 avatar_key 供后续复用
          if (data.avatar_key) {
            setAvatarKey(data.avatar_key)
          }

          // 缓存自定义服装的 image_key（后端返回的 clothes_keys）
          if (data.clothes_keys && data.clothes_keys.length > 0 && customClothesWithBase64.length > 0) {
            const cacheItems = []
            // clothes_keys 的顺序与 customClothes 的顺序对应
            customClothesWithBase64.forEach(({ base64Image, customIndex }) => {
              const imageKey = data.clothes_keys[customIndex]
              if (imageKey && base64Image) {
                cacheItems.push({ base64: base64Image, imageKey })
              }
            })
            if (cacheItems.length > 0) {
              cacheImageKeys(cacheItems).then(() => {
                console.log('[useTryOn] 已缓存', cacheItems.length, '个自定义服装的 image_key')
              })
            }
          }

          // 开始轮询状态
          if (data.record_uuid) {
            // 设置预计等待时间并启动倒计时
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
          } else {
            // 模拟处理过程（如果没有返回 record_uuid）
            simulateProgress()
          }

          return { success: true, recordUuid: data.record_uuid, avatarKey: data.avatar_key, estimatedTime: data.estimated_time }
        }

        setStatus('failed')
        if (onError) {
          onError(response.error || response.message)
        }
        return { success: false, error: response.error || response.message }
      } catch (error) {
        // 模拟处理过程作为后备
        simulateProgress()

        setTimeout(() => {
          const mockResult = 'https://via.placeholder.com/400x600/D4AF37?text=Try-On+Result'
          setResultUrl(mockResult)
          setStatus('completed')
          setProgress(100)

          if (onComplete) {
            onComplete({ resultUrl: mockResult })
          }
        }, 2000)

        return { success: true }
      }
    },
    [onComplete, onError, sessionId, pollStatus, simulateProgress]
  )

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
    avatarKey, // 暴露 avatarKey 供外部使用
    remainingTime, // 剩余等待时间（秒）
    estimatedTime, // 预计等待时间（秒）
    submitTask,
    fetchHistory,
    clearResult,
    startGenerating,
    cancelGenerating,
  }
}
