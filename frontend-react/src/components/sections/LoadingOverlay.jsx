import PropTypes from 'prop-types'

export default function LoadingOverlay({ progress, remainingTime, t }) {
  return (
    <div
      className={`absolute inset-0 z-20 flex items-center justify-center rounded-2xl backdrop-blur-sm transition-colors duration-500 ${
        progress >= 100 ? 'bg-[var(--bg-secondary)]' : 'bg-[var(--bg-secondary)]/95'
      }`}
      role='alert'
      aria-live='assertive'
    >
      <div className='w-72 px-4 text-center md:w-80'>
        {/* 进度条 */}
        <div className='mb-4'>
          <div className='h-4 w-full overflow-hidden rounded-full bg-[var(--bg-card)] shadow-inner'>
            <div
              className='h-full rounded-full shadow-sm transition-all duration-300 ease-out'
              style={{
                width: `${Math.min(100, progress)}%`,
                background: 'linear-gradient(90deg, var(--accent) 0%, var(--accent-dark) 100%)',
                boxShadow: '0 0 10px var(--accent-glow)',
              }}
            />
          </div>
          <p className='mt-3 text-xl font-bold text-[var(--text-secondary)]'>
            {progress < 100 ? `${Math.floor(progress)}%` : '100%'}
          </p>
        </div>

        {/* 加载动画 */}
        <div
          className='loading-ring mx-auto mb-4 h-14 w-14 animate-spin rounded-full md:h-16 md:w-16'
          aria-hidden='true'
        />

        <p className='mb-1 font-medium text-charcoal'>
          {progress < 100 ? t('regenerating') : t('completeAndSaving')}
        </p>

        {progress < 100 && remainingTime > 0 && (
          <p className='text-accessible text-sm'>
            {t('estimatedTime') || '预计等待'}: {remainingTime} {t('seconds') || '秒'}
          </p>
        )}
      </div>
    </div>
  )
}

LoadingOverlay.propTypes = {
  progress: PropTypes.number.isRequired,
  remainingTime: PropTypes.number.isRequired,
  t: PropTypes.func.isRequired,
}
