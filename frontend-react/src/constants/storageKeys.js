/**
 * 本地存储键名常量
 * 统一管理所有 localStorage key，确保复用和一致性
 */
export const STORAGE_KEYS = {
  // 用户相关
  USER_INFO: 'tryon_user_info',
  SESSION_CUSTOMER: 'tryon_session_customer',

  // Token 相关
  ACCESS_TOKEN: 'tryon_access_token',
  REFRESH_TOKEN: 'tryon_refresh_token',

  // 服装相关
  AVATAR_PREVIEW: 'tryon_avatar_preview',
  CUSTOM_CLOTHING: 'tryon_custom_clothing',
  WARDROBE_CLOTHING: 'tryon_wardrobe_clothing',
  SELECTED_CLOTHING: 'tryon_selected_clothing',
  REUSE_AVATAR_KEY: 'tryon_reuse_avatar_key', // 复用的头像 key

  // 设置相关
  LOCALE: 'tryon_locale',

  // 缓存版本号（修改此值会自动清除旧缓存）
  CACHE_VERSION: 'tryon_cache_version',
}

// 当前缓存版本号（修改此值会自动清除旧缓存）
export const CURRENT_CACHE_VERSION = '2'

export default STORAGE_KEYS
