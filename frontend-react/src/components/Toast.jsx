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

const STYLES = {
  success: 'bg-[#f0fdf4] text-[#166534] border-[#bbf7d0]',
  error: 'bg-[#fef2f2] text-[#991b1b] border-[#fecaca]',
  warning: 'bg-[#fffbeb] text-[#92400e] border-[#fde68a]',
  info: 'bg-[#eff6ff] text-[#1e40af] border-[#bfdbfe]',
}

const SHADOWS = {
  success: 'shadow-[#166534]/10',
  error: 'shadow-[#991b1b]/10',
  warning: 'shadow-[#92400e]/10',
  info: 'shadow-[#1e40af]/10',
}

const ICON_BG_STYLES = {
  success: 'bg-[#dcfce7] text-[#166534]',
  error: 'bg-[#fee2e2] text-[#991b1b]',
  warning: 'bg-[#fef3c7] text-[#92400e]',
  info: 'bg-[#dbeafe] text-[#1e40af]',
}

const CLOSE_BTN_STYLES = {
  success: 'text-[#166534]/60 hover:text-[#166534]',
  error: 'text-[#991b1b]/60 hover:text-[#991b1b]',
  warning: 'text-[#92400e]/60 hover:text-[#92400e]',
  info: 'text-[#1e40af]/60 hover:text-[#1e40af]',
}

const PROGRESS_STYLES = {
  success: 'bg-[#166534]/30',
  error: 'bg-[#991b1b]/30',
  warning: 'bg-[#92400e]/30',
  info: 'bg-[#1e40af]/30',
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
      className={`fixed left-1/2 top-24 z-[calc(var(--z-top)+100)] flex min-w-[320px] max-w-[480px] -translate-x-1/2 flex-col overflow-hidden rounded-xl border shadow-xl backdrop-blur-sm transition-all duration-300 ${STYLES[type]} ${SHADOWS[type]} ${
        visible ? 'translate-y-0 scale-100 opacity-100' : '-translate-y-4 scale-95 opacity-0'
      }`}
      role='alert'
      aria-live='polite'
    >
      <div className='flex items-center gap-3 px-4 py-3'>
        <div
          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${ICON_BG_STYLES[type]}`}
        >
          {ICONS[type]}
        </div>
        <span className='flex-1 text-sm font-medium leading-relaxed'>{message}</span>
        <button
          type='button'
          onClick={handleClose}
          className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/5 ${CLOSE_BTN_STYLES[type]}`}
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
      <div className='h-0.5 w-full bg-black/5'>
        <div
          className={`h-full transition-all duration-100 ease-linear ${PROGRESS_STYLES[type]}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
