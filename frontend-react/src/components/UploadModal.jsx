import { useState, useRef } from 'react'

export default function UploadModal({ categories, onClose, onUpload }) {
  const [formData, setFormData] = useState({
    name: '',
    category: categories[0]?.id || 'tops',
    subcategory: '',
    color: '',
    price: '',
    sizes: '',
    image: null,
  })
  const [preview, setPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const handleChange = e => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleFileChange = e => {
    const file = e.target.files?.[0]
    if (file) {
      setFormData(prev => ({ ...prev, image: file }))
      const reader = new FileReader()
      reader.onload = ev => setPreview(ev.target.result)
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async e => {
    e.preventDefault()
    if (!formData.name || !formData.image) {
      return
    }

    setUploading(true)
    try {
      await onUpload(formData)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className='fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/50 p-4 backdrop-blur-sm'>
      <div className='glass-card w-full max-w-md animate-scale-in overflow-hidden rounded-2xl'>
        {/* Header */}
        <div className='flex items-center justify-between border-b border-grayLight px-6 py-4 dark:border-gray-700'>
          <h3 className='text-lg font-semibold text-charcoal dark:text-white'>添加服装</h3>
          <button
            type='button'
            onClick={onClose}
            className='rounded-lg p-1.5 transition-colors hover:bg-grayLight/50 dark:hover:bg-gray-700'
            aria-label='关闭'
          >
            <svg
              className='h-5 w-5 text-grayMedium'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M6 18L18 6M6 6l12 12'
              />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className='space-y-5 p-6'>
          {/* Image Upload */}
          <div>
            <span className='mb-2 block text-sm font-medium text-grayMedium dark:text-grayLight'>
              服装图片
            </span>
            <div
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  fileInputRef.current?.click()
                }
              }}
              role='button'
              tabIndex={0}
              className='upload-zone relative aspect-video cursor-pointer overflow-hidden rounded-xl'
            >
              {preview ? (
                <img src={preview} alt='Preview' className='h-full w-full object-cover' />
              ) : (
                <div className='absolute inset-0 flex flex-col items-center justify-center text-grayMuted'>
                  <svg
                    className='mb-2 h-10 w-10'
                    fill='none'
                    viewBox='0 0 24 24'
                    stroke='currentColor'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={1.5}
                      d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
                    />
                  </svg>
                  <span className='text-sm'>点击上传图片</span>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type='file'
              accept='image/*'
              onChange={handleFileChange}
              className='hidden'
              aria-hidden='true'
            />
          </div>

          {/* Name */}
          <div>
            <label
              htmlFor='clothing-name'
              className='mb-1.5 block text-sm font-medium text-grayMedium dark:text-grayLight'
            >
              服装名称
            </label>
            <input
              id='clothing-name'
              type='text'
              name='name'
              value={formData.name}
              onChange={handleChange}
              placeholder='例如：蓝色休闲衬衫'
              className='w-full rounded-xl border border-grayLight bg-white px-4 py-2.5 text-charcoal placeholder-grayMuted transition-all focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/50 dark:border-gray-600 dark:bg-[#252525] dark:text-white'
              required
            />
          </div>

          {/* Category */}
          <div>
            <label
              htmlFor='clothing-category'
              className='mb-1.5 block text-sm font-medium text-grayMedium dark:text-grayLight'
            >
              分类
            </label>
            <select
              id='clothing-category'
              name='category'
              value={formData.category}
              onChange={handleChange}
              className='w-full rounded-xl border border-grayLight bg-white px-4 py-2.5 text-charcoal transition-all focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/50 dark:border-gray-600 dark:bg-[#252525] dark:text-white'
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Color */}
          <div>
            <label
              htmlFor='clothing-color'
              className='mb-1.5 block text-sm font-medium text-grayMedium dark:text-grayLight'
            >
              颜色
            </label>
            <input
              id='clothing-color'
              type='text'
              name='color'
              value={formData.color}
              onChange={handleChange}
              placeholder='例如：深蓝色'
              className='w-full rounded-xl border border-grayLight bg-white px-4 py-2.5 text-charcoal placeholder-grayMuted transition-all focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/50 dark:border-gray-600 dark:bg-[#252525] dark:text-white'
            />
          </div>

          {/* Price & Sizes */}
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label
                htmlFor='clothing-price'
                className='mb-1.5 block text-sm font-medium text-grayMedium dark:text-grayLight'
              >
                价格 (¥)
              </label>
              <input
                id='clothing-price'
                type='number'
                name='price'
                value={formData.price}
                onChange={handleChange}
                placeholder='0.00'
                min='0'
                step='0.01'
                className='w-full rounded-xl border border-grayLight bg-white px-4 py-2.5 text-charcoal placeholder-grayMuted transition-all focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/50 dark:border-gray-600 dark:bg-[#252525] dark:text-white'
              />
            </div>
            <div>
              <label
                htmlFor='clothing-sizes'
                className='mb-1.5 block text-sm font-medium text-grayMedium dark:text-grayLight'
              >
                尺码
              </label>
              <input
                id='clothing-sizes'
                type='text'
                name='sizes'
                value={formData.sizes}
                onChange={handleChange}
                placeholder='如: S,M,L,XL'
                className='w-full rounded-xl border border-grayLight bg-white px-4 py-2.5 text-charcoal placeholder-grayMuted transition-all focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/50 dark:border-gray-600 dark:bg-[#252525] dark:text-white'
              />
            </div>
          </div>

          {/* Actions */}
          <div className='flex gap-3 pt-2'>
            <button
              type='button'
              onClick={onClose}
              className='flex-1 rounded-xl border border-grayLight py-2.5 text-charcoal transition-colors hover:bg-grayLight/50 dark:border-gray-600 dark:text-grayLight dark:hover:bg-gray-700'
            >
              取消
            </button>
            <button
              type='submit'
              disabled={uploading || !formData.name || !formData.image}
              className='btn-primary flex-1 rounded-xl py-2.5 disabled:cursor-not-allowed disabled:opacity-50'
            >
              {uploading ? '上传中...' : '上传'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
