export default function GlobalLoading() {
  return (
    <div className='fixed inset-0 z-[var(--z-top)] flex items-center justify-center bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-card)]'>
      <div className='flex flex-col items-center'>
        {/* Logo 动画 */}
        <div className='relative mb-6 h-16 w-16'>
          <div className='absolute inset-0 animate-pulse rounded-xl bg-gradient-to-br from-champagne to-[var(--accent-strong)]' />
          <div className='absolute inset-0 flex items-center justify-center'>
            <svg
              className='h-10 w-10 animate-spin text-charcoal'
              style={{ animationDuration: '2s' }}
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01'
              />
            </svg>
          </div>
        </div>

        {/* 加载文字 */}
        <p className='mb-4 text-base font-medium text-charcoal'>Loading...</p>

        {/* 加载条 */}
        <div className='h-1 w-32 overflow-hidden rounded-full bg-[var(--border-primary)]'>
          <div className='animate-loading-bar h-full rounded-full bg-gradient-to-r from-champagne to-[var(--accent-strong)]' />
        </div>
      </div>
    </div>
  )
}
