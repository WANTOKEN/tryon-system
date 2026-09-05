/**
 * 安全存储工具
 *
 * iPad Safari 对 localStorage 有严格限制（约 5MB），且可能在空间不足时清空数据。
 * 此工具使用 IndexedDB 作为主要存储方式，localStorage 作为轻量数据的备用。
 */

const DB_NAME = 'TryOnStorage'
const DB_VERSION = 1
const STORE_NAME = 'keyValue'

let db = null
let dbInitPromise = null

// 初始化 IndexedDB
function initDB() {
  if (dbInitPromise) {
    return dbInitPromise
  }

  dbInitPromise = new Promise(resolve => {
    // 检查 IndexedDB 是否可用
    if (!window.indexedDB) {
      console.warn('IndexedDB 不可用，将使用 localStorage')
      resolve(null)
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.warn('IndexedDB 打开失败:', request.error)
      resolve(null)
    }

    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = event => {
      const database = event.target.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }
  })

  return dbInitPromise
}

// IndexedDB 操作
async function setIDB(key, value) {
  if (key === undefined || key === null) {
    return false
  }
  await initDB()
  if (!db) {
    return false
  }

  return new Promise(resolve => {
    try {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put({ key, value })

      request.onsuccess = () => resolve(true)
      request.onerror = () => {
        console.warn('IndexedDB 写入失败:', request.error)
        resolve(false)
      }
    } catch (e) {
      console.warn('IndexedDB 写入异常:', e)
      resolve(false)
    }
  })
}

async function getIDB(key) {
  if (key === undefined || key === null) {
    return null
  }
  await initDB()
  if (!db) {
    return null
  }

  return new Promise(resolve => {
    try {
      const transaction = db.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(key)

      request.onsuccess = () => {
        resolve(request.result?.value ?? null)
      }
      request.onerror = () => {
        console.warn('IndexedDB 读取失败:', request.error)
        resolve(null)
      }
    } catch (e) {
      console.warn('IndexedDB 读取异常:', e)
      resolve(null)
    }
  })
}

async function removeIDB(key) {
  if (key === undefined || key === null) {
    return false
  }
  await initDB()
  if (!db) {
    return false
  }

  return new Promise(resolve => {
    try {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(key)

      request.onsuccess = () => resolve(true)
      request.onerror = () => resolve(false)
    } catch (e) {
      resolve(false)
    }
  })
}

// localStorage 操作（带错误处理）
function setLS(key, value) {
  try {
    localStorage.setItem(key, value)
    return true
  } catch (e) {
    console.warn('localStorage 写入失败:', e)
    return false
  }
}

function getLS(key) {
  try {
    return localStorage.getItem(key)
  } catch (e) {
    return null
  }
}

function removeLS(key) {
  try {
    localStorage.removeItem(key)
  } catch (e) {
    // ignore
  }
}

// 判断数据是否为大型数据（base64 图片等）
function isLargeData(value) {
  if (typeof value === 'string') {
    // 超过 100KB 视为大型数据
    return value.length > 100 * 1024
  }
  if (typeof value === 'object' && value !== null) {
    const str = JSON.stringify(value)
    return str.length > 100 * 1024
  }
  return false
}

// 导出的安全存储 API
export const safeStorage = {
  /**
   * 存储数据
   * - 大型数据（如 base64 图片）使用 IndexedDB
   * - 小型数据使用 localStorage（更快）
   */
  async setItem(key, value) {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value)

    if (isLargeData(stringValue)) {
      // 大型数据优先使用 IndexedDB
      const idbSuccess = await setIDB(key, value)
      if (idbSuccess) {
        // 同时清除 localStorage 中的旧数据
        removeLS(key)
        return true
      }
      // IndexedDB 失败，尝试 localStorage
      return setLS(key, stringValue)
    }
    // 小型数据使用 localStorage
    const lsSuccess = setLS(key, stringValue)
    if (lsSuccess) {
      // 同时清除 IndexedDB 中的旧数据
      await removeIDB(key)
      return true
    }
    // localStorage 失败，尝试 IndexedDB
    return setIDB(key, value)
  },

  /**
   * 读取数据
   * - 先尝试 localStorage
   * - 再尝试 IndexedDB
   */
  async getItem(key) {
    // 先尝试 localStorage
    const lsValue = getLS(key)
    if (lsValue !== null) {
      return lsValue
    }

    // 再尝试 IndexedDB
    const idbValue = await getIDB(key)
    return idbValue
  },

  /**
   * 删除数据
   */
  async removeItem(key) {
    removeLS(key)
    await removeIDB(key)
  },

  /**
   * 同步存储（用于需要同步的场景，如 React state 更新）
   * 注意：大型数据可能失败
   */
  setItemSync(key, value) {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value)

    if (isLargeData(stringValue)) {
      // 大型数据异步存储到 IndexedDB
      setIDB(key, value).catch(() => {})
      // 同时清除 localStorage
      removeLS(key)
      return true
    }

    return setLS(key, stringValue)
  },

  /**
   * 同步读取（只从 localStorage 读取）
   */
  getItemSync(key) {
    return getLS(key)
  },
}

// 初始化 IndexedDB
initDB()

export default safeStorage
