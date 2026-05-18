import { useEffect, useRef, useCallback } from 'react'

/**
 * 手势支持 Hook
 * 为平板设备添加滑动手势支持
 *
 * @param {Object} options - 配置选项
 * @param {Function} options.onSwipeLeft - 向左滑动回调
 * @param {Function} options.onSwipeRight - 向右滑动回调
 * @param {Function} options.onSwipeUp - 向上滑动回调
 * @param {Function} options.onSwipeDown - 向下滑动回调
 * @param {Function} options.onTap - 点击回调
 * @param {Function} options.onLongPress - 长按回调
 * @param {number} options.threshold - 滑动阈值（像素），默认 50
 * @param {number} options.longPressDelay - 长按延迟（毫秒），默认 500
 * @param {boolean} options.preventDefault - 是否阻止默认行为，默认 true
 */
export function useGestures({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  onTap,
  onLongPress,
  threshold = 50,
  longPressDelay = 500,
  preventDefault = true,
} = {}) {
  const elementRef = useRef(null)
  const touchStartRef = useRef(null)
  const touchStartTimeRef = useRef(0)
  const longPressTimerRef = useRef(null)
  const isLongPressRef = useRef(false)

  const handleTouchStart = useCallback(
    e => {
      const touch = e.touches[0]
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
      }
      touchStartTimeRef.current = Date.now()
      isLongPressRef.current = false

      // 设置长按定时器
      if (onLongPress) {
        longPressTimerRef.current = setTimeout(() => {
          isLongPressRef.current = true
          onLongPress(e)
        }, longPressDelay)
      }

      if (preventDefault) {
        // 不阻止默认行为，以免影响滚动
        // e.preventDefault()
      }
    },
    [onLongPress, longPressDelay, preventDefault]
  )

  const handleTouchMove = useCallback(
    e => {
      // 移动时取消长按
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }

      if (preventDefault && touchStartRef.current) {
        // 根据滑动方向决定是否阻止默认行为
        const touch = e.touches[0]
        const deltaX = touch.clientX - touchStartRef.current.x
        const deltaY = touch.clientY - touchStartRef.current.y

        // 水平滑动时阻止默认行为（防止页面滚动）
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
          // e.preventDefault()
        }
      }
    },
    [preventDefault]
  )

  const handleTouchEnd = useCallback(
    e => {
      // 清除长按定时器
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }

      // 如果是长按，不处理其他手势
      if (isLongPressRef.current) {
        return
      }

      const touch = e.changedTouches[0]
      const touchEnd = {
        x: touch.clientX,
        y: touch.clientY,
      }

      const touchDuration = Date.now() - touchStartTimeRef.current

      // 计算滑动距离
      const deltaX = touchEnd.x - touchStartRef.current.x
      const deltaY = touchEnd.y - touchStartRef.current.y
      const absDeltaX = Math.abs(deltaX)
      const absDeltaY = Math.abs(deltaY)

      // 判断是否为点击（时间短且移动距离小）
      if (touchDuration < 200 && absDeltaX < 10 && absDeltaY < 10) {
        onTap?.(e)
        return
      }

      // 判断滑动方向
      if (absDeltaX > absDeltaY && absDeltaX > threshold) {
        // 水平滑动
        if (deltaX > 0) {
          onSwipeRight?.(e)
        } else {
          onSwipeLeft?.(e)
        }
      } else if (absDeltaY > threshold) {
        // 垂直滑动
        if (deltaY > 0) {
          onSwipeDown?.(e)
        } else {
          onSwipeUp?.(e)
        }
      }

      touchStartRef.current = null
    },
    [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onTap, threshold]
  )

  const handleTouchCancel = useCallback(() => {
    // 清除长按定时器
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    touchStartRef.current = null
    isLongPressRef.current = false
  }, [])

  useEffect(() => {
    const element = elementRef.current
    if (!element) {
      return undefined
    }

    element.addEventListener('touchstart', handleTouchStart, { passive: true })
    element.addEventListener('touchmove', handleTouchMove, { passive: true })
    element.addEventListener('touchend', handleTouchEnd, { passive: true })
    element.addEventListener('touchcancel', handleTouchCancel, { passive: true })

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
      element.removeEventListener('touchend', handleTouchEnd)
      element.removeEventListener('touchcancel', handleTouchCancel)

      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
      }
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel])

  return elementRef
}

/**
 * 滑动切换 Hook
 * 用于在列表或轮播中滑动切换
 *
 * @param {Object} options - 配置选项
 * @param {number} options.currentIndex - 当前索引
 * @param {number} options.totalCount - 总数量
 * @param {Function} options.onChange - 切换回调
 * @param {boolean} options.loop - 是否循环，默认 false
 */
export function useSwipeable({ currentIndex, totalCount, onChange, loop = false } = {}) {
  const handleSwipeLeft = useCallback(() => {
    if (currentIndex < totalCount - 1) {
      onChange?.(currentIndex + 1)
    } else if (loop) {
      onChange?.(0)
    }
  }, [currentIndex, totalCount, onChange, loop])

  const handleSwipeRight = useCallback(() => {
    if (currentIndex > 0) {
      onChange?.(currentIndex - 1)
    } else if (loop) {
      onChange?.(totalCount - 1)
    }
  }, [currentIndex, onChange, loop, totalCount])

  const gestureRef = useGestures({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
  })

  return gestureRef
}

export default useGestures
