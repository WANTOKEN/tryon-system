import { useEffect, useState } from 'react'

const ICONS = {
  success: (
    <svg className='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
    </svg>
  ),
  error: (
    <svg className='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
    </svg>
  ),
  warning: (
    <svg className='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth={2}
        d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
      />
    </svg>
  ),
  info: (
    <svg className='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth={2}
        d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
      />
    </svg>
  ),
}

// 语义色由 index.css 的 .toast-* 类提供（跟随主题 --success/--error/--warning/--info）
const STYLES = {
  success: 'toast-surface toast-surface--success',
  error: 'toast-surface toast-surface--error',
  warning: 'toast-surface toast-surface--warning',
  info: 'toast-surface toast-surface--info',
}

export default function Toast({ message, type = 'info', duration = 2000, onClose }) {
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    // 入场动画
    const enterTimer = setTimeout(() => setVisible(true), 10)

    // 进度条动画
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev <= 0) {
          clearInterval(progressInterval)
          return 0
        }
        return prev - 100 / (duration / 100)
      })
    }, 100)

    // 自动关闭
    const closeTimer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onClose?.(), 300)
    }, duration)

    return () => {
      clearTimeout(enterTimer)
      clearTimeout(closeTimer)
      clearInterval(progressInterval)
    }
  }, [duration, onClose])

  const handleClose = () => {
    setVisible(false)
    setTimeout(() => onClose?.(), 300)
  }

  return (
    <div
      className={`fixed left-1/2 top-24 z-[calc(var(--z-top)+100)] flex min-w-[320px] max-w-[480px] -translate-x-1/2 flex-col overflow-hidden rounded-xl border shadow-xl backdrop-blur-sm transition-all duration-300 ${STYLES[type]} ${
        visible
          ? 'translate-y-0 scale-100 opacity-100'
          : // 隐藏态必须禁用指针事件，否则透明的 Toast 会继续拦截下方按钮的点击
            'pointer-events-none -translate-y-4 scale-95 opacity-0'
      }`}
      role='alert'
      aria-live='polite'
    >
      <div className='flex items-center gap-3 px-4 py-3'>
        <div className='toast-icon flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full'>
          {ICONS[type]}
        </div>
        <span className='flex-1 text-sm font-medium leading-relaxed'>{message}</span>
        <button
          type='button'
          onClick={handleClose}
          className='toast-close flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--bg-hover)]'
          aria-label='关闭'
        >
          <svg className='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M6 18L18 6M6 6l12 12'
            />
          </svg>
        </button>
      </div>
      {/* 进度条 */}
      <div className='toast-progress-track h-0.5 w-full'>
        <div
          className='toast-progress-bar h-full transition-all duration-100 ease-linear'
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
