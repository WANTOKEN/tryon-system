import { useState, useEffect } from 'react'

/**
 * 监听浏览器在线 / 离线状态，并在状态变化时给出轻量提示。
 *
 * @param {object} params
 * @param {(msg: string, type?: string) => void} params.showToast 全局 toast
 * @param {(key: string) => string} params.t 国际化函数
 * @param {{ message?: string } | null} [params.currentToast] 当前 toast，避免网络恢复时重复提示
 * @returns {boolean} 当前是否在线
 */
export function useNetworkStatus({ showToast, t, currentToast }) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      if (currentToast && currentToast.message === '网络已断开，部分功能不可用') {
        showToast(t('networkRecovered'), 'success')
      }
    }
    const handleOffline = () => {
      setIsOnline(false)
      showToast(t('networkOffline'), 'warning')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [showToast, t, currentToast])

  return isOnline
}
