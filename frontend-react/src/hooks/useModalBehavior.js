import { useEffect } from 'react'

/**
 * 弹窗通用交互行为：Esc 关闭 + 打开期间锁定页面滚动。
 *
 * - Esc 监听挂在 document 上，不依赖弹层是否可聚焦（挂在 tabIndex=-1 的 div 上收不到键盘事件）。
 * - 背景滚动锁定使用引用计数，支持嵌套弹窗：只有最后一个弹窗关闭时才恢复滚动，
 *   避免「关掉上层弹窗后下层还在却已被解锁」的滚动穿透。
 *
 * @param {boolean} isOpen 弹窗是否打开
 * @param {Function} onClose 关闭回调（Esc 触发）
 * @param {{ lockScroll?: boolean }} [options]
 */
let scrollLockCount = 0
let previousOverflow = ''
let previousPaddingRight = ''

function lockScroll() {
  if (scrollLockCount === 0) {
    const { body } = document
    previousOverflow = body.style.overflow
    // 补偿滚动条宽度，避免锁定瞬间页面横向跳动
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    previousPaddingRight = body.style.paddingRight
    body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`
    }
  }
  scrollLockCount += 1
}

function unlockScroll() {
  if (scrollLockCount === 0) {
    return
  }
  scrollLockCount -= 1
  if (scrollLockCount === 0) {
    document.body.style.overflow = previousOverflow
    document.body.style.paddingRight = previousPaddingRight
  }
}

export default function useModalBehavior(isOpen, onClose, { lockScroll: shouldLock = true } = {}) {
  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const handleKeyDown = e => {
      if (e.key === 'Escape' && typeof onClose === 'function') {
        // 阻止冒泡，避免同时关闭多层弹窗
        e.stopPropagation()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    if (shouldLock) {
      lockScroll()
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      if (shouldLock) {
        unlockScroll()
      }
    }
  }, [isOpen, onClose, shouldLock])
}
