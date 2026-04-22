import { useEffect, useState } from 'react'

const ICONS = {
  success: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
}

const STYLES = {
  success: 'bg-green-500 text-white',
  error: 'bg-red-500 text-white',
  warning: 'bg-yellow-500 text-white',
  info: 'bg-blue-500 text-white',
}

export default function Toast({ message, type = 'info' }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 2800)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      className={`fixed top-20 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg transition-all ${
        STYLES[type]
      } ${visible ? 'opacity-100 -translate-y-0' : 'opacity-0 -translate-y-4'}`}
    >
      {ICONS[type]}
      <span className="font-medium">{message}</span>
    </div>
  )
}
