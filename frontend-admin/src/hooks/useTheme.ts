import { useState, useEffect, useCallback } from 'react'

/**
 * 管理端主题：固定使用「品牌金」单一色系，仅保留明暗模式切换。
 *
 * 变更说明（2026-09-06）：此前管理端提供 4 套色系（香槟金/冰川蓝/樱花粉/森林绿）切换，
 * 但顶部与登录页的品牌 logo 是固定金棕实色图（不跟随主题变色），
 * 切换到蓝/粉/绿时 logo 金色与界面主色冲突，整体观感不协调。
 * 故收敛为单一品牌金，与 logo 保持统一。
 *
 * 注意：不再读写 'aitryon-theme'（该 key 由用户端 react 使用），
 * 避免管理端与用户端互相覆盖主题。
 */

/** 品牌主色（亮色模式） */
export const BRAND_PRIMARY = '#c8a45c'
/** 品牌主色（暗色模式） */
export const BRAND_PRIMARY_DARK = '#d4af37'

const MODE_STORAGE_KEY = 'aitryon-mode'

function readStored(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) || fallback
  } catch {
    return fallback
  }
}

function applyMode(mode: string) {
  const root = document.documentElement
  root.classList.toggle('dark', mode === 'dark')
  root.style.colorScheme = mode === 'dark' ? 'dark' : 'light'
}

/**
 * 明暗模式管理（管理端固定品牌金单色系，antd 的 colorPrimary 在 App.tsx 中接管）
 */
export function useTheme() {
  const [mode, setModeState] = useState<string>(() => readStored(MODE_STORAGE_KEY, 'light'))

  useEffect(() => {
    applyMode(mode)
  }, [mode])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === MODE_STORAGE_KEY && e.newValue) {
        setModeState(e.newValue)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setMode = useCallback((modeValue: string) => {
    setModeState(modeValue)
    try {
      localStorage.setItem(MODE_STORAGE_KEY, modeValue)
    } catch {
      /* ignore */
    }
  }, [])

  const toggleMode = useCallback(() => {
    setModeState(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(MODE_STORAGE_KEY, next)
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  return {
    mode,
    setMode,
    toggleMode,
  }
}
