/**
 * 图片处理工具函数
 */

/**
 * 将图片文件转换为 Base64
 * @param {File} file - 图片文件
 * @returns {Promise<string>} Base64 编码（不含 data URI scheme）
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      // 移除 data URI scheme 前缀
      const base64 = reader.result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = error => reject(error)
    reader.readAsDataURL(file)
  })
}

/**
 * 将图片对象转换为 Base64
 * @param {Image} image - 图片对象
 * @returns {Promise<string>} Base64 编码
 */
export function imageToBase64(image) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(image, 0, 0)

    canvas.toBlob(blob => {
      if (blob) {
        const reader = new FileReader()
        reader.onload = () => {
          resolve(reader.result.split(',')[1])
        }
        reader.readAsDataURL(blob)
      } else {
        reject(new Error('Canvas to Blob 失败'))
      }
    }, 'image/png')
  })
}

/**
 * 生成 Base64 data URI
 * @param {string} base64 - Base64 编码
 * @param {string} mimeType - MIME 类型
 * @returns {string} 完整的 data URI
 */
export function generateDataUri(base64, mimeType = 'image/png') {
  return `data:${mimeType};base64,${base64}`
}

/**
 * 验证 Base64 格式
 * @param {string} base64Str - Base64 字符串
 * @returns {boolean} 是否有效
 */
export function isValidBase64(base64Str) {
  if (!base64Str || typeof base64Str !== 'string') {
    return false
  }

  try {
    // 支持 data URI scheme
    if (base64Str.includes(',')) {
      const parts = base64Str.split(',')
      if (parts.length !== 2) {
        return false
      }
      return /^[a-zA-Z0-9+/]+={0,2}$/.test(parts[1])
    }

    // 直接 base64
    return /^[a-zA-Z0-9+/]+={0,2}$/.test(base64Str)
  } catch {
    return false
  }
}

/**
 * 获取文件大小（格式化）
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的大小（KB/MB）
 */
export function formatFileSize(bytes) {
  if (bytes === 0) {
    return '0 B'
  }

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}

/**
 * 验证图片文件
 * @param {File} file - 图片文件
 * @returns {Object} 验证结果 {valid: boolean, error?: string}
 */
export function validateImageFile(file) {
  // 检查文件类型
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: '不支持的图片格式，仅支持 JPG、PNG、WebP',
    }
  }

  // 检查文件大小（最大 10MB）
  const maxSize = 10 * 1024 * 1024
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `图片大小不能超过 ${formatFileSize(maxSize)}`,
    }
  }

  return { valid: true }
}

export const compressImage = (file, maxSizeMB = 5, maxWidth = 1920, maxHeight = 1920) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width } = img
        let { height } = img

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = (height * maxWidth) / width
            width = maxWidth
          } else {
            width = (width * maxHeight) / height
            height = maxHeight
          }
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        const targetSize = maxSizeMB * 1024 * 1024
        const fileSize = file.size

        let initialQuality = 0.9
        if (fileSize > targetSize * 2) {
          initialQuality = 0.7
        } else if (fileSize > targetSize * 1.5) {
          initialQuality = 0.8
        }

        const compressWithQuality = quality =>
          new Promise(res => {
            canvas.toBlob(
              blob => {
                if (blob) {
                  if (blob.size <= targetSize || quality <= 0.1) {
                    if (blob.size > file.size) {
                      res(file)
                    } else {
                      const compressedFile = new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now(),
                      })
                      res(compressedFile)
                    }
                  } else {
                    const newQuality = Math.max(0.1, quality - 0.15)
                    compressWithQuality(newQuality).then(res)
                  }
                } else {
                  res(file)
                }
              },
              'image/jpeg',
              quality
            )
          })

        compressWithQuality(initialQuality).then(resolve)
      }
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = e.target.result
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })

export const truncateFileName = (fileName, maxLength = 30) => {
  if (!fileName || fileName.length <= maxLength) {
    return fileName
  }
  const extIndex = fileName.lastIndexOf('.')
  if (extIndex === -1 || extIndex === 0) {
    return `${fileName.substring(0, maxLength - 3)}...`
  }
  const extension = fileName.substring(extIndex)
  const nameWithoutExt = fileName.substring(0, extIndex)
  const truncatedName = `${nameWithoutExt.substring(0, maxLength - extension.length - 3)}...`
  return truncatedName + extension
}

export const extractDominantColor = (file, timeout = 500) =>
  new Promise(resolve => {
    const timer = setTimeout(() => resolve('#F5F4F0'), timeout)

    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          const size = 20
          canvas.width = size
          canvas.height = size
          ctx.drawImage(img, 0, 0, size, size)

          const { data } = ctx.getImageData(0, 0, size, size)
          const colorCounts = {}
          let maxCount = 0
          let dominantColor = '#F5F4F0'

          /* eslint-disable no-continue, no-bitwise */
          for (let i = 0; i < data.length; i += 16) {
            const r = data[i]
            const g = data[i + 1]
            const b = data[i + 2]
            const a = data[i + 3]

            if (a < 200) {
              continue
            }

            const brightness = (r + g + b) / 3
            if (brightness > 245 || brightness < 10) {
              continue
            }

            const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5)
            colorCounts[key] = (colorCounts[key] || 0) + 1

            if (colorCounts[key] > maxCount) {
              maxCount = colorCounts[key]
              const rHex = Math.min(255, r).toString(16).padStart(2, '0')
              const gHex = Math.min(255, g).toString(16).padStart(2, '0')
              const bHex = Math.min(255, b).toString(16).padStart(2, '0')
              dominantColor = `#${rHex}${gHex}${bHex}`
            }
          }
          /* eslint-enable no-continue, no-bitwise */

          clearTimeout(timer)
          resolve(dominantColor)
        } catch {
          clearTimeout(timer)
          resolve('#F5F4F0')
        }
      }
      img.onerror = () => {
        clearTimeout(timer)
        resolve('#F5F4F0')
      }
      img.src = e.target.result
    }
    reader.onerror = () => {
      clearTimeout(timer)
      resolve('#F5F4F0')
    }
    reader.readAsDataURL(file)
  })
