import { useState } from 'react'

export default function AdminContactItem({ icon, label, value, maskedValue }) {
  const [revealed, setRevealed] = useState(false)

  return (
    <div className='flex items-center gap-3 rounded-xl border border-grayLight p-3'>
      <div className='flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-champagne/20'>
        {icon}
      </div>
      <div className='min-w-0 flex-1'>
        <p className='text-xs text-grayMuted'>{label}</p>
        <p className='text-sm font-medium text-charcoal'>{revealed ? value : maskedValue}</p>
      </div>
      <button
        type='button'
        onClick={() => setRevealed(!revealed)}
        className='flex-shrink-0 text-xs text-champagne hover:underline'
      >
        {revealed ? '隐藏' : '查看'}
      </button>
    </div>
  )
}
