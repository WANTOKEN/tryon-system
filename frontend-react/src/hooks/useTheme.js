import { useState, useEffect, useCallback } from 'react'

export const THEMES = [
  {
    key: 'luxury-gold',
    name: '香槟金',
    primary: '#c8a45c',
    primaryDark: '#d4af37',
  },
  {
    key: 'frost-blue',
    name: '冰川蓝',
    primary: '#4a90d9',
    primaryDark: '#5b9be0',
  },
  {
    key: 'sakura-pink',
    name: '樱花粉',
    primary: '#e89ab0',
    primaryDark: '#f0a7bd',
  },
  {
    key: 'forest-green',
    name: '森林绿',
    primary: '#5a9e7a',
    primaryDark: '#6cb090',
  },
]

export const THEME_STORAGE_KEY = 'aitryon-theme'
export const MODE_STORAGE_KEY = 'aitryon-mode'

function readStored(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback
  } catch {
    return fallback
  }
}

function applyTheme(theme, mode) {
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.classList.toggle('dark', mode === 'dark')
  root.style.colorScheme = mode === 'dark' ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setThemeState] = useState(() => readStored(THEME_STORAGE_KEY, 'luxury-gold'))
  const [mode, setModeState] = useState(() => readStored(MODE_STORAGE_KEY, 'light'))

  useEffect(() => {
    applyTheme(theme, mode)
  }, [theme, mode])

  useEffect(() => {
    const onStorage = e => {
      if (e.key === THEME_STORAGE_KEY && e.newValue) {
        setThemeState(e.newValue)
      } else if (e.key === MODE_STORAGE_KEY && e.newValue) {
        setModeState(e.newValue)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setTheme = useCallback(themeKey => {
    setThemeState(themeKey)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeKey)
    } catch {
      /* ignore */
    }
  }, [])

  const setMode = useCallback(modeValue => {
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

  const currentThemeMeta = THEMES.find(t => t.key === theme) || THEMES[0]

  return {
    theme,
    mode,
    setTheme,
    setMode,
    toggleMode,
    themes: THEMES,
    currentThemeMeta,
  }
}
