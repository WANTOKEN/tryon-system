import { useState, useRef } from 'react'

export default function UploadModal({ categories, onClose, onUpload }) {
  const [formData, setFormData] = useState({
    name: '',
    category: categories[0]?.id || 'tops',
    subcategory: '',
    color: '',
    image: null,
  })
  const [preview, setPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setFormData((prev) => ({ ...prev, image: file }))
      const reader = new FileReader()
      reader.onload = (ev) => setPreview(ev.target.result)
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name || !formData.image) return

    setUploading(true)
    try {
      await onUpload(formData)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md glass-card rounded-2xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-grayLight dark:border-gray-700">
          <h3 className="text-lg font-semibold text-charcoal dark:text-white">添加服装</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-grayLight/50 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5 text-grayMedium" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-grayMedium dark:text-grayLight mb-2">
              服装图片
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="upload-zone relative aspect-video rounded-xl cursor-pointer overflow-hidden"
            >
              {preview ? (
                <img src={preview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-grayMuted">
                  <svg className="w-10 h-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm">点击上传图片</span>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-grayMedium dark:text-grayLight mb-1.5">
              服装名称
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="例如：蓝色休闲衬衫"
              className="w-full px-4 py-2.5 rounded-xl border border-grayLight dark:border-gray-600 bg-white dark:bg-[#252525] text-charcoal dark:text-white placeholder-grayMuted focus:outline-none focus:ring-2 focus:ring-champagne/50 focus:border-champagne transition-all"
              required
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-grayMedium dark:text-grayLight mb-1.5">
              分类
            </label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded-xl border border-grayLight dark:border-gray-600 bg-white dark:bg-[#252525] text-charcoal dark:text-white focus:outline-none focus:ring-2 focus:ring-champagne/50 focus:border-champagne transition-all"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-grayMedium dark:text-grayLight mb-1.5">
              颜色
            </label>
            <input
              type="text"
              name="color"
              value={formData.color}
              onChange={handleChange}
              placeholder="例如：深蓝色"
              className="w-full px-4 py-2.5 rounded-xl border border-grayLight dark:border-gray-600 bg-white dark:bg-[#252525] text-charcoal dark:text-white placeholder-grayMuted focus:outline-none focus:ring-2 focus:ring-champagne/50 focus:border-champagne transition-all"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-grayLight dark:border-gray-600 text-charcoal dark:text-grayLight hover:bg-grayLight/50 dark:hover:bg-gray-700 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={uploading || !formData.name || !formData.image}
              className="flex-1 py-2.5 rounded-xl btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? '上传中...' : '上传'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}