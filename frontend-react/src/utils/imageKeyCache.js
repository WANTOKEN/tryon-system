/**
 * 图片 Key 缓存工具
 * 
 * 用于缓存自定义服装的 image_key，避免重复传输相同图片
 * 
 * 工作原理：
 * 1. 用户上传自定义服装 → 计算图片内容哈希（SHA-256）
 * 2. 检查本地缓存是否有对应的 image_key
 * 3. 有缓存 → 用 key 复用，不传图片数据
 * 4. 无缓存 → 传图片数据，后端返回 image_key，缓存起来
 * 
 * 本地重复校验：
 * 1. 用户上传图片 → 计算哈希
 * 2. 检查是否与已选服装重复
 * 3. 重复 → 提示用户，阻止添加
 */

const CACHE_KEY_PREFIX = 'img_key_'
const HASH_REGISTRY_PREFIX = 'img_hash_' // 图片哈希注册表（用于本地去重）
const CACHE_EXPIRY_DAYS = 7 // 缓存有效期（天）

/**
 * 计算图片的 SHA-256 哈希
 * @param {string} base64Data - Base64 图片数据（带或不带 data: 前缀）
 * @returns {Promise<string>} - SHA-256 哈希值（前 16 位作为简短 key）
 */
export async function computeImageHash(base64Data) {
  // 提取纯 Base64 数据
  let pureBase64 = base64Data
  if (base64Data.startsWith('data:')) {
    pureBase64 = base64Data.split(',')[1]
  }
  
  // 将 Base64 转为二进制
  const binaryString = atob(pureBase64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  
  // 使用 Web Crypto API 计算 SHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  
  // 返回前 16 位作为简短 key（足够唯一）
  return hashHex.substring(0, 16)
}

/**
 * 获取缓存的 image_key
 * @param {string} base64Data - Base64 图片数据
 * @returns {Promise<string|null>} - 缓存的 image_key 或 null
 */
export async function getCachedImageKey(base64Data) {
  try {
    const hash = await computeImageHash(base64Data)
    const cacheKey = CACHE_KEY_PREFIX + hash
    
    const cached = localStorage.getItem(cacheKey)
    if (!cached) return null
    
    // 解析缓存数据
    const { imageKey, timestamp } = JSON.parse(cached)
    
    // 检查是否过期
    const now = Date.now()
    const expiryMs = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    if (now - timestamp > expiryMs) {
      localStorage.removeItem(cacheKey)
      return null
    }
    
    return imageKey
  } catch (error) {
    console.warn('[ImageKeyCache] 获取缓存失败:', error)
    return null
  }
}

/**
 * 缓存 image_key
 * @param {string} base64Data - Base64 图片数据
 * @param {string} imageKey - 后端返回的 image_key
 */
export async function cacheImageKey(base64Data, imageKey) {
  if (!imageKey) return
  
  try {
    const hash = await computeImageHash(base64Data)
    const cacheKey = CACHE_KEY_PREFIX + hash
    
    localStorage.setItem(cacheKey, JSON.stringify({
      imageKey,
      timestamp: Date.now(),
    }))
  } catch (error) {
    console.warn('[ImageKeyCache] 缓存失败:', error)
  }
}

/**
 * 批量获取缓存的 image_key
 * @param {string[]} base64DataArray - Base64 图片数据数组
 * @returns {Promise<(string|null)[]>} - 缓存的 image_key 数组
 */
export async function getCachedImageKeys(base64DataArray) {
  return Promise.all(base64DataArray.map(data => getCachedImageKey(data)))
}

/**
 * 批量缓存 image_key
 * @param {Array<{base64: string, imageKey: string}>} items - 缓存项数组
 */
export async function cacheImageKeys(items) {
  await Promise.all(items.map(item => cacheImageKey(item.base64, item.imageKey)))
}

/**
 * 清理过期的缓存
 */
export function cleanExpiredCache() {
  const now = Date.now()
  const expiryMs = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  
  let cleaned = 0
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(CACHE_KEY_PREFIX)) {
      try {
        const cached = JSON.parse(localStorage.getItem(key))
        if (now - cached.timestamp > expiryMs) {
          localStorage.removeItem(key)
          cleaned++
        }
      } catch {
        localStorage.removeItem(key)
        cleaned++
      }
    }
  }
  
  if (cleaned > 0) {
    console.log(`[ImageKeyCache] 清理了 ${cleaned} 个过期缓存`)
  }
}

// 页面加载时清理过期缓存
if (typeof window !== 'undefined') {
  cleanExpiredCache()
}

// ==================== 本地重复校验 ====================

/**
 * 检查图片是否与已选服装重复
 * @param {string} base64Data - 新上传图片的 Base64 数据
 * @param {Array} existingItems - 已选服装列表（每个 item 需要有 image 或 imageFull 字段）
 * @returns {Promise<{isDuplicate: boolean, duplicateIndex: number, hash: string}>}
 */
export async function checkImageDuplicate(base64Data, existingItems = []) {
  if (!base64Data || existingItems.length === 0) {
    return { isDuplicate: false, duplicateIndex: -1, hash: '' }
  }

  try {
    const newHash = await computeImageHash(base64Data)
    
    // 计算所有已选服装的哈希
    for (let i = 0; i < existingItems.length; i++) {
      const item = existingItems[i]
      const existingBase64 = item.image || item.imageFull
      if (existingBase64) {
        const existingHash = await computeImageHash(existingBase64)
        if (existingHash === newHash) {
          console.log(`[ImageDuplicate] 检测到重复图片: index=${i}, hash=${newHash}`)
          return { isDuplicate: true, duplicateIndex: i, hash: newHash }
        }
      }
    }
    
    return { isDuplicate: false, duplicateIndex: -1, hash: newHash }
  } catch (error) {
    console.warn('[ImageDuplicate] 检查失败:', error)
    return { isDuplicate: false, duplicateIndex: -1, hash: '' }
  }
}

/**
 * 批量检查图片是否重复
 * @param {string[]} base64DataArray - 新上传图片的 Base64 数据数组
 * @param {Array} existingItems - 已选服装列表
 * @returns {Promise<Array<{isDuplicate: boolean, duplicateIndex: number}>>}
 */
export async function checkImagesDuplicate(base64DataArray, existingItems = []) {
  const results = []
  
  // 先计算已选服装的哈希（只算一次）
  const existingHashes = []
  for (const item of existingItems) {
    const base64 = item.image || item.imageFull
    if (base64) {
      try {
        const hash = await computeImageHash(base64)
        existingHashes.push(hash)
      } catch {
        existingHashes.push('')
      }
    } else {
      existingHashes.push('')
    }
  }
  
  // 检查每个新图片
  for (let i = 0; i < base64DataArray.length; i++) {
    const base64 = base64DataArray[i]
    if (!base64) {
      results.push({ isDuplicate: false, duplicateIndex: -1 })
      continue
    }
    
    try {
      const newHash = await computeImageHash(base64)
      const duplicateIdx = existingHashes.indexOf(newHash)
      
      if (duplicateIdx >= 0) {
        console.log(`[ImageDuplicate] 图片 ${i} 与已选服装 ${duplicateIdx} 重复`)
        results.push({ isDuplicate: true, duplicateIndex: duplicateIdx })
      } else {
        results.push({ isDuplicate: false, duplicateIndex: -1 })
      }
    } catch {
      results.push({ isDuplicate: false, duplicateIndex: -1 })
    }
  }
  
  return results
}

/**
 * 从 File 对象计算哈希
 * @param {File} file - 文件对象
 * @returns {Promise<string>} - SHA-256 哈希值
 */
export async function computeFileHash(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const base64 = e.target.result
        const hash = await computeImageHash(base64)
        resolve(hash)
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * 检查文件是否与已选服装重复
 * @param {File} file - 文件对象
 * @param {Array} existingItems - 已选服装列表
 * @returns {Promise<{isDuplicate: boolean, duplicateIndex: number, hash: string}>}
 */
export async function checkFileDuplicate(file, existingItems = []) {
  try {
    const base64 = await fileToBase64(file)
    return checkImageDuplicate(base64, existingItems)
  } catch (error) {
    console.warn('[ImageDuplicate] 文件检查失败:', error)
    return { isDuplicate: false, duplicateIndex: -1, hash: '' }
  }
}

/**
 * File 对象转 Base64
 * @param {File} file - 文件对象
 * @returns {Promise<string>} - Base64 数据（带 data: 前缀）
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * 获取图片哈希（支持 Base64 或 File）
 * @param {string|File} image - 图片数据
 * @returns {Promise<string>} - 哈希值
 */
export async function getImageHash(image) {
  if (typeof image === 'string') {
    return computeImageHash(image)
  }
  if (image instanceof File) {
    return computeFileHash(image)
  }
  throw new Error('不支持的图片类型')
}
