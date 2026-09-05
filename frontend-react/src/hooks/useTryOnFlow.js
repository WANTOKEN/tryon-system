import { useCallback } from 'react'

import { api } from '../utils/request'
import { API_ENDPOINTS } from '../config/api'
import { STORAGE_KEYS } from '../constants/storageKeys'
import { safeStorage } from '../utils/safeStorage'

/**
 * 试穿提交流程 Hook
 * 封装完整的试穿提交流程：登录检查 → 头像/服装/配额校验 → 服务端配额二次确认
 * → 头像文件准备 → 提交任务 → 移动端自动滚动
 *
 * @param {Object} options
 * @param {boolean} options.isLoggedIn - 是否已登录
 * @param {Function} options.showToast - Toast 提示函数
 * @param {Function} options.t - 国际化翻译函数
 * @param {Function} options.onRequireLogin - 需要登录时的回调
 * @param {Function} options.onShowAdminContact - 显示管理员联系弹窗回调
 * @param {string|null} options.avatarPreview - 头像预览 URL
 * @param {File|null} options.avatarFile - 头像文件
 * @param {string} options.avatarSource - 头像来源
 * @param {Function} options.setAvatarFile - 设置头像文件
 * @param {Array} options.selected - 已选服装列表
 * @param {Object} options.quota - 配额信息 { total, used, remaining }
 * @param {Function} options.setQuota - 设置配额信息
 * @param {Function} options.startGenerating - 开始生成状态
 * @param {Function} options.cancelGenerating - 取消生成状态
 * @param {Function} options.submitTask - 提交试穿任务（来自 useTryOn）
 * @returns {Object} { handleTryOn }
 */
export function useTryOnFlow({
  isLoggedIn,
  showToast,
  t,
  onRequireLogin,
  onShowAdminContact,
  avatarPreview,
  avatarFile,
  avatarSource,
  setAvatarFile,
  selected,
  quota,
  setQuota,
  startGenerating,
  cancelGenerating,
  submitTask,
}) {
  /**
   * 提交试穿任务
   * 流程：登录检查 → 头像检查 → 服装检查 → 配额检查(本地+服务端) → 头像处理 → 提交
   * 移动端提交后自动滚动到结果区域
   */
  const handleTryOn = useCallback(async () => {
    if (!isLoggedIn) {
      showToast(t('n_needLogin'), 'warning')
      onRequireLogin?.()
      return
    }

    if (!avatarPreview) {
      showToast(t('n_needAvatar'), 'warning')
      return
    }
    if (selected.length === 0) {
      showToast(t('n_needClothing'), 'warning')
      return
    }
    if (quota.remaining <= 0) {
      showToast(t('n_quotaEmpty'), 'error')
      onShowAdminContact?.()
      return
    }

    startGenerating()

    // 再次检查服务器配额（防止多设备同时使用）
    try {
      const meResponse = await api.get(API_ENDPOINTS.AUTH.ME)
      if (meResponse.success) {
        const serverQuota = meResponse.data?.data || meResponse.data
        // 更新本地配额
        if (serverQuota?.quota_remaining !== undefined) {
          setQuota({
            total: serverQuota.quota_total || quota.total,
            used: serverQuota.quota_used || quota.used,
            remaining: serverQuota.quota_remaining,
          })
        }
        if (serverQuota.quota_remaining <= 0) {
          cancelGenerating()
          showToast(t('n_quotaEmpty'), 'error')
          onShowAdminContact?.()
          return
        }
      }
    } catch (e) {
      // 忽略解析错误，继续执行
    }

    let fileToSubmit = null
    let keyToReuse = null
    let submitAvatarSource = avatarSource || 'user'

    // 已存的可复用 key：模特形象（system）或扫码上传的形象（user）都会写入
    const storedKey = await safeStorage.getItem(STORAGE_KEYS.REUSE_AVATAR_KEY)
    const storedSource = await safeStorage.getItem(STORAGE_KEYS.REUSE_AVATAR_SOURCE)

    const canReuseStoredKey = !!storedKey && (avatarSource === 'system' || storedSource === 'user')

    if (canReuseStoredKey) {
      // 直接复用服务端已有的图片 key，避免重复上传同一张图
      keyToReuse = storedKey
      submitAvatarSource = storedSource || avatarSource || 'user'
    } else if (avatarFile) {
      fileToSubmit = avatarFile
      submitAvatarSource = 'user'
    } else if (avatarPreview) {
      try {
        const response = await fetch(avatarPreview)
        if (!response.ok) {
          throw new Error(`Failed to fetch avatar: ${response.status}`)
        }
        const blob = await response.blob()
        if (blob.size === 0) {
          throw new Error('Avatar blob is empty')
        }
        fileToSubmit = new File([blob], 'avatar.jpg', { type: blob.type || 'image/jpeg' })
        if (!avatarPreview.startsWith('/images/')) {
          setAvatarFile?.(fileToSubmit)
        }
        submitAvatarSource = 'user'
      } catch (e) {
        cancelGenerating()
        showToast(t('n_imgReadFail'), 'error')
        return
      }
    }

    await submitTask(fileToSubmit, selected, keyToReuse, submitAvatarSource)

    // 移动端提交后自动滚动到结果区域
    if (window.innerWidth < 1024) {
      setTimeout(() => {
        const resultArea = document.getElementById('tryon-result-area')
        if (resultArea) {
          resultArea.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
    }
  }, [
    isLoggedIn,
    avatarPreview,
    avatarFile,
    avatarSource,
    setAvatarFile,
    selected,
    quota,
    setQuota,
    submitTask,
    showToast,
    startGenerating,
    cancelGenerating,
    onRequireLogin,
    onShowAdminContact,
    t,
  ])

  return {
    handleTryOn,
  }
}
