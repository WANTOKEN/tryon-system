export default function GlobalLoading() {
  const LOGO = 192
  return (
    <div
      className='fixed inset-0 z-[var(--z-top)] flex items-center justify-center overflow-hidden'
      style={{
        background: 'linear-gradient(135deg, var(--bg-secondary), var(--bg-card))',
        paddingTop: '10vh',
      }}
    >
      <div className='flex flex-col items-center'>
        {/* Logo */}
        <div className='relative mb-8 animate-scale-in' style={{ width: LOGO, height: LOGO }}>
          {/* Outer glow */}
          <div
            className='absolute -inset-10 animate-pulse-gold rounded-full'
            style={{ background: 'radial-gradient(circle, var(--accent-glow), transparent 70%)' }}
          />

          {/* Logo SVG */}
          <svg width={LOGO} height={LOGO} viewBox='0 0 64 64' className='relative'>
            <defs>
              <linearGradient id='ld-gold' x1='0.15' y1='0' x2='0.85' y2='1'>
                <stop offset='0' stopColor='var(--logo-gold-1)' />
                <stop offset='0.45' stopColor='var(--logo-gold-2)' />
                <stop offset='1' stopColor='var(--logo-gold-3)' />
              </linearGradient>
              <linearGradient id='ld-gloss' x1='0' y1='0' x2='0' y2='1'>
                <stop offset='0' stopColor='#ffffff' stopOpacity='0.38' />
                <stop offset='0.4' stopColor='#ffffff' stopOpacity='0.04' />
                <stop offset='0.5' stopColor='#ffffff' stopOpacity='0' />
              </linearGradient>
              <linearGradient id='ld-garment' x1='0' y1='0' x2='0' y2='1'>
                <stop offset='0' stopColor='var(--logo-garment-1)' />
                <stop offset='1' stopColor='var(--logo-garment-2)' />
              </linearGradient>
            </defs>

            <rect width='64' height='64' rx='12' fill='url(#ld-gold)' />
            <rect width='64' height='64' rx='12' fill='url(#ld-gloss)' />

            {/* Filled garment — fade in */}
            <path
              className='logo-garment'
              d='M32 4 L18 7 L8 17 L21 24 L6 42 L6 60 L58 60 L58 42 L43 24 L56 17 L46 7 Z'
              fill='url(#ld-garment)'
              stroke='#ffffff'
              strokeWidth='1.2'
              strokeLinejoin='round'
            />

            {/* Neckline accent — fade in with garment */}
            <circle className='logo-garment' cx='32' cy='9' r='2' fill='var(--logo-accent)' />

            {/* Center gold sparkle — fade in after garment */}
            <path
              className='logo-sparkle'
              d='M32 22 L35 28 L39 32 L35 36 L32 42 L29 36 L25 32 L29 28 Z'
              fill='var(--logo-accent)'
            />
          </svg>

          {/* Shimmer sweep */}
          <div
            className='pointer-events-none absolute inset-0 overflow-hidden'
            style={{ borderRadius: '20%' }}
          >
            <div
              className='logo-shimmer-bar absolute inset-y-0 w-1/3'
              style={{
                background:
                  'linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)',
              }}
            />
          </div>
        </div>

        {/* Wordmark */}
        <div
          className='animate-fade-in text-4xl font-bold tracking-tight'
          style={{
            color: 'var(--text-primary)',
            animationDelay: '0.8s',
            animationFillMode: 'both',
          }}
        >
          <span style={{ color: 'var(--accent)' }}>AI</span>
          <span>TryOn</span>
        </div>

        {/* Tagline */}
        <p
          className='mb-7 mt-2.5 animate-fade-in text-sm'
          style={{ color: 'var(--text-muted)', animationDelay: '1.1s', animationFillMode: 'both' }}
        >
          智能虚拟试衣
        </p>

        {/* Loading bar */}
        <div
          className='logo-bar h-[4px] w-56 overflow-hidden rounded-full'
          style={{ background: 'var(--border-primary)' }}
        >
          <div
            className='logo-bar-fill h-full w-1/2 rounded-full'
            style={{
              background:
                'linear-gradient(90deg, transparent, var(--accent), var(--accent-strong))',
            }}
          />
        </div>
      </div>
    </div>
  )
}
