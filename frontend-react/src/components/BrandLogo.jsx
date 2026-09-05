export default function BrandLogo({ size = 28, showText = false, className = '', style = {} }) {
  if (!showText) {
    return (
      <img
        src='/logo.png'
        alt='AI TryOn'
        width={size}
        height={size}
        className={className}
        style={{ display: 'block', objectFit: 'contain', flexShrink: 0, ...style }}
      />
    )
  }

  return (
    <div className={`flex items-center gap-2 ${className}`} style={style}>
      <img
        src='/logo.png'
        alt='AI TryOn'
        width={size}
        height={size}
        style={{ display: 'block', objectFit: 'contain', flexShrink: 0 }}
      />
      <span
        className='text-[1.05em] font-bold tracking-tight'
        style={{ color: 'var(--text-primary)' }}
      >
        <span style={{ color: 'var(--accent)' }}>AI</span>
        <span>TryOn</span>
      </span>
    </div>
  )
}
