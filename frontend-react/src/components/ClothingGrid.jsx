import CachedImage from './CachedImage'

export default function ClothingGrid({ clothing, selected, onToggleSelect }) {
  if (clothing.length === 0) {
    return (
      <div className='py-12 text-center'>
        <svg
          className='mx-auto mb-4 h-16 w-16 text-grayLight dark:text-gray-600'
          fill='none'
          viewBox='0 0 24 24'
          stroke='currentColor'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={1}
            d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
          />
        </svg>
        <p className='text-grayMedium dark:text-gray-400'>衣橱为空</p>
        <p className='mt-1 text-sm text-grayMuted dark:text-gray-500'>点击上方"添加服装"上传</p>
      </div>
    )
  }

  return (
    <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4'>
      {clothing.map(item => {
        const isSelected = selected.includes(item.uuid)
        return (
          <button
            type='button'
            key={item.uuid}
            onClick={() => onToggleSelect(item.uuid)}
            className={`clothing-card ${isSelected ? 'selected' : ''}`}
          >
            {/* Image */}
            <div className='aspect-square overflow-hidden rounded-lg bg-grayLight/50 dark:bg-gray-700/50'>
              {item.image || item.image_url ? (
                <CachedImage
                  src={item.image || item.image_url}
                  alt={item.name}
                  className='h-full w-full object-cover'
                  lazy
                />
              ) : (
                <div className='flex h-full w-full items-center justify-center text-grayMuted'>
                  <svg className='h-8 w-8' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={1.5}
                      d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
                    />
                  </svg>
                </div>
              )}
            </div>

            {/* Check Mark */}
            <div className='check-mark'>
              <svg fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={3}
                  d='M5 13l4 4L19 7'
                />
              </svg>
            </div>

            {/* Name Badge */}
            <div className='absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent p-2'>
              <p className='truncate text-xs font-medium text-white'>{item.name}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
