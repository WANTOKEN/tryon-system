import { useState, useCallback, useRef, useEffect } from 'react'

/**
 * 全局 Toast 通知 Hook
 * 提供 showToast 方法，自动 3 秒后消失
 * 连续调用时会重置计时器，避免前一条提前清除后一条
 */
export function useToast() {
  const [toast, setToast] = useState(null)
  const toastTimerRef = useRef(null)

  const showToast = useCallback((message, type = 'info') => {
    // 连续提示时先取消上一条的倒计时
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current)
    }
    // key 用于强制 Toast 重挂载（相同内容连续弹出时也能重新计时）
    setToast({ message, type, key: Date.now() })
    toastTimerRef.current = setTimeout(() => {
      toastTimerRef.current = null
      setToast(null)
    }, 3000)
  }, [])

  const hideToast = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current)
      toastTimerRef.current = null
    }
    setToast(null)
  }, [])

  // 组件卸载时清理定时器
  useEffect(
    () => () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current)
      }
    },
    []
  )

  return { toast, showToast, hideToast }
}
