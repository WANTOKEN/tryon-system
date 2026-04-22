export default function ClothingGrid({ clothing, selected, onToggleSelect }) {
  if (clothing.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="w-16 h-16 mx-auto text-grayLight dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-grayMedium dark:text-gray-400">衣橱为空</p>
        <p className="text-sm text-grayMuted dark:text-gray-500 mt-1">点击上方"添加服装"上传</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {clothing.map((item) => {
        const isSelected = selected.includes(item.uuid)
        return (
          <button
            key={item.uuid}
            onClick={() => onToggleSelect(item.uuid)}
            className={`clothing-card ${isSelected ? 'selected' : ''}`}
          >
            {/* Image */}
            <div className="aspect-square bg-grayLight/50 dark:bg-gray-700/50">
              {(item.image || item.image_url) ? (
                <img
                  src={item.image || item.image_url}
                  alt={item.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-grayMuted">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Check Mark */}
            <div className="check-mark">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            {/* Name Badge */}
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/40 to-transparent">
              <p className="text-xs text-white font-medium truncate">{item.name}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}