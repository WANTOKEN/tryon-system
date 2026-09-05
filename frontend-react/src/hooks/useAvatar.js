import { useState, useCallback } from 'react'

import { STORAGE_KEYS } from '../constants/storageKeys'
import { safeStorage } from '../utils/safeStorage'
import { compressImage } from '../utils/imageUtils'

/**
 * 头像/形象管理 Hook
 * 管理头像文件、预览图、来源，以及上传、删除、选择模特等操作。
 *
 * @param {Object} options
 * @param {Function} options.showToast - Toast 提示函数
 * @param {Function} options.t - 国际化翻译函数
 * @returns {Object} 头像状态和方法
 */
export function useAvatar({ showToast, t }) {
  const [avatarFile, setAvatarFile] = useState(null) // 用户上传的头像文件
  const [avatarPreview, setAvatarPreview] = useState(null) // 头像预览 URL（base64 或 blob URL）
  const [avatarSource, setAvatarSource] = useState('user') // 头像来源：user/system/history

  /**
   * 处理头像文件选择
   * 校验大小(≤30MB)和格式 → 设置预览 → 缓存到 localStorage
   */
  const handleAvatarChange = useCallback(
    async e => {
      const input = e.target
      const file = input.files?.[0]
      if (file) {
        const MAX_SIZE = 30 * 1024 * 1024
        if (file.size > MAX_SIZE) {
          showToast(t('n_imgTooLarge30MB'), 'warning')
          input.value = ''
          return
        }

        const allowedTypes = [
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/bmp',
          'image/heic',
          'image/heif',
        ]
        if (!allowedTypes.includes(file.type)) {
          showToast(t('n_imgFormatError'), 'error')
          input.value = ''
          return
        }

        setAvatarSource('user')

        const objectUrl = URL.createObjectURL(file)
        setAvatarPreview(objectUrl)

        let processedFile = file
        if (file.size > 500 * 1024) {
          try {
            processedFile = await compressImage(file, 1, 1280, 1280)
          } catch (error) {
            console.warn('图片压缩失败，使用原始文件:', error)
          }
        }

        setAvatarFile(processedFile)

        // 立即清空 input，避免用户再次选择同一文件时不触发 onChange
        e.target.value = ''

        const reader = new FileReader()
        reader.onload = ev => {
          const base64 = ev.target.result
          setAvatarPreview(base64)
          safeStorage.setItem(STORAGE_KEYS.AVATAR_PREVIEW, base64)
          URL.revokeObjectURL(objectUrl)
        }
        reader.onerror = () => {
          URL.revokeObjectURL(objectUrl)
          showToast(t('n_imgReadFail'), 'error')
        }
        reader.readAsDataURL(processedFile)

        // 清空 input，否则再次选择同一张图片不会触发 change（删除形象后无法重选）
        input.value = ''
      } else if (input.files === null) {
        setAvatarFile(null)
        setAvatarPreview(null)
        setAvatarSource('user')
        safeStorage.removeItem(STORAGE_KEYS.AVATAR_PREVIEW)
      }
    },
    [showToast, t]
  )

  /** 删除当前形象 */
  const deleteAvatar = useCallback(() => {
    setAvatarFile(null)
    setAvatarPreview(null)
    setAvatarSource('user')
    safeStorage.removeItem(STORAGE_KEYS.AVATAR_PREVIEW)
    safeStorage.removeItem(STORAGE_KEYS.REUSE_AVATAR_KEY)
    safeStorage.removeItem(STORAGE_KEYS.REUSE_AVATAR_SOURCE)
    safeStorage.removeItem(STORAGE_KEYS.AVATAR_FILE)
  }, [])

  /** 设置头像预览并持久化（扫码上传等场景） */
  const setAvatarPreviewWithPersist = useCallback((preview, imageKey, source = 'user') => {
    setAvatarPreview(preview)
    safeStorage.setItem(STORAGE_KEYS.AVATAR_PREVIEW, preview)
    setAvatarSource(source)
    // 扫码上传成功后回传 image_key：记录为可复用 key 与来源
    if (imageKey) {
      safeStorage.setItem(STORAGE_KEYS.REUSE_AVATAR_KEY, imageKey)
      safeStorage.setItem(STORAGE_KEYS.REUSE_AVATAR_SOURCE, source)
    }
    // 系统模特/内置图不需要保留 avatarFile
    if (preview && preview.startsWith('/images/')) {
      setAvatarFile(null)
      safeStorage.removeItem(STORAGE_KEYS.AVATAR_FILE)
    }
  }, [])

  /** 从模特库选择形象 */
  const selectModelAvatar = useCallback((imageUrl, imageKey, source = 'system') => {
    setAvatarPreview(imageUrl)
    safeStorage.setItem(STORAGE_KEYS.AVATAR_PREVIEW, imageUrl)
    setAvatarSource(source)
    if (imageKey) {
      safeStorage.setItem(STORAGE_KEYS.REUSE_AVATAR_KEY, imageKey)
      safeStorage.setItem(STORAGE_KEYS.REUSE_AVATAR_SOURCE, source)
    }
    setAvatarFile(null)
    safeStorage.removeItem(STORAGE_KEYS.AVATAR_FILE)
  }, [])

  /** 从缓存加载头像预览 */
  const loadAvatarFromCache = useCallback(async () => {
    const cachedAvatar = await safeStorage.getItem(STORAGE_KEYS.AVATAR_PREVIEW)
    if (cachedAvatar) {
      setAvatarPreview(cachedAvatar)
      return true
    }
    return false
  }, [])

  /** 清除头像相关缓存（不清 state，用于登出/结束会话等） */
  const clearAvatarCache = useCallback(() => {
    safeStorage.removeItem(STORAGE_KEYS.AVATAR_PREVIEW)
    safeStorage.removeItem(STORAGE_KEYS.REUSE_AVATAR_KEY)
    safeStorage.removeItem(STORAGE_KEYS.REUSE_AVATAR_SOURCE)
    safeStorage.removeItem(STORAGE_KEYS.AVATAR_FILE)
  }, [])

  /** 重置头像状态 + 清缓存 */
  const resetAvatar = useCallback(() => {
    setAvatarFile(null)
    setAvatarPreview(null)
    setAvatarSource('user')
    clearAvatarCache()
  }, [clearAvatarCache])

  return {
    // 状态
    avatarFile,
    setAvatarFile,
    avatarPreview,
    setAvatarPreview,
    avatarSource,
    setAvatarSource,
    // 方法
    handleAvatarChange,
    deleteAvatar,
    setAvatarPreviewWithPersist,
    selectModelAvatar,
    loadAvatarFromCache,
    clearAvatarCache,
    resetAvatar,
  }
}
