import { useCallback } from 'react'

import { api } from '../utils/request'
import { API_ENDPOINTS } from '../config/api'
import { compressImage, truncateFileName } from '../utils/imageUtils'

/**
 * 服装上传 Hook
 * 统一处理自定义上传和衣橱上传的文件校验、压缩、上传逻辑。
 * 通过回调函数与外部状态（customClothing / wardrobeClothing）交互。
 *
 * @param {Object} options
 * @param {Function} options.showToast - Toast 提示函数
 * @param {Function} options.t - 国际化翻译函数
 * @param {boolean} options.isLoggedIn - 是否已登录
 * @param {Function} options.onRequireLogin - 需要登录时的回调
 * @param {Function} options.onAddPlaceholder - 添加占位项回调 (placeholderItem) => void
 * @param {Function} options.onUpdateItem - 更新项回调 (tempId, newItem) => void
 * @param {Function} options.onRemoveByTempId - 按临时 ID 移除项回调 (tempId) => void
 * @param {string} options.type - 上传类型：'custom' | 'wardrobe'
 * @returns {Object} 上传方法
 */
export function useClothingUpload({
  showToast,
  t,
  isLoggedIn,
  onRequireLogin,
  onAddPlaceholder,
  onUpdateItem,
  onRemoveByTempId,
  type = 'custom',
}) {
  /**
   * 通用服装上传方法
   * @param {File} file - 上传的文件
   * @param {string} category - 分类
   * @param {string} name - 服装名称
   * @param {string} color - 颜色
   */
  const uploadClothing = useCallback(
    async (file, category = 'tops', name = '', color = '黑色') => {
      if (!isLoggedIn) {
        showToast(t('n_needLogin'), 'warning')
        onRequireLogin?.()
        return
      }

      if (!file) {
        return
      }

      const MAX_SIZE = 5 * 1024 * 1024
      if (file.size > MAX_SIZE) {
        showToast(t('n_imgSizeLimit'), 'warning')
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
        return
      }

      const fileName = truncateFileName(name || file.name.replace(/\.[^.]+$/, ''))
      let processedFile = file
      if (file.name.length > 30) {
        processedFile = new File([file], truncateFileName(file.name), {
          type: file.type,
          lastModified: Date.now(),
        })
      }

      if (processedFile.size > 500 * 1024) {
        try {
          showToast(t('n_imgOptimizing'), 'info')
          processedFile = await compressImage(processedFile, 1, 1280, 1280)
        } catch (error) {
          console.warn('图片压缩失败，使用原始文件:', error)
        }
      }

      const tempId = `${type}_uploading_${Date.now()}`
      const localPreview = URL.createObjectURL(processedFile)

      const isCustom = type === 'custom'
      const isWardrobe = type === 'wardrobe'

      const placeholderItem = {
        id: tempId,
        uuid: tempId,
        name: fileName,
        category,
        color,
        image: localPreview,
        imageFull: null,
        isUploading: true,
        isCustom,
        isWardrobe,
      }

      onAddPlaceholder?.(placeholderItem)

      try {
        const formData = new FormData()
        formData.append('file', processedFile)
        formData.append('name', fileName)
        formData.append('category', category)
        formData.append('color', color)

        const response = await api.upload(`${API_ENDPOINTS.WARDROBE.CLOTHING}upload/`, formData)

        if (response.success) {
          // 后端返回 {id, name, category, color, price, size, image_url, thumb_url, image_key}
          const item = response.data?.data || response.data
          const itemId = item.id ?? tempId
          const newItem = {
            id: itemId,
            uuid: itemId,
            name: item.name || fileName,
            category: item.category || category,
            color: item.color || color,
            price: item.price ?? 0,
            size: item.size || '',
            image: item.thumb_url || item.image_url || localPreview,
            imageFull: item.image_url || localPreview,
            image_key: item.image_key || '',
            source: item.source || type,
            isCustom,
            isWardrobe,
            isUploading: false,
          }

          URL.revokeObjectURL(localPreview)

          onUpdateItem?.(tempId, newItem)
          showToast(isCustom ? t('n_customAdded', { count: 1 }) : t('n_wardrobeAdded'), 'success')
        } else {
          URL.revokeObjectURL(localPreview)
          onRemoveByTempId?.(tempId)
          showToast(response.error || t('n_uploadFail'), 'error')
        }
      } catch (error) {
        console.error(`[${type}Upload] 上传失败:`, error)
        URL.revokeObjectURL(localPreview)
        onRemoveByTempId?.(tempId)
        showToast(t('n_imgUploadFail'), 'error')
      }
    },
    [
      isLoggedIn,
      showToast,
      t,
      type,
      onRequireLogin,
      onAddPlaceholder,
      onUpdateItem,
      onRemoveByTempId,
    ]
  )

  return {
    uploadClothing,
  }
}
