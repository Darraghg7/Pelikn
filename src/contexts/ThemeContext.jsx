import React, { createContext, useContext, useState, useLayoutEffect, useEffect, useCallback } from 'react'

const ThemeContext = createContext({ dark: false, mode: 'light', setMode: () => {} })

const STORAGE_KEY = 'pelikn_theme_mode'

function resolvesDark(mode) {
  if (mode === 'dark') return true
  if (mode === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function ThemeProvider({ children }) {
  const [mode, setModeRaw] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'dark' || stored === 'light' || stored === 'system') return stored
      const legacy = localStorage.getItem('pelikn_dark_mode')
      if (legacy === 'true') return 'dark'
      return 'light'
    } catch { return 'light' }
  })

  const [dark, setDark] = useState(() => resolvesDark(mode))

  const setMode = useCallback((m) => {
    setModeRaw(m)
    try { localStorage.setItem(STORAGE_KEY, m) } catch {}
  }, [])

  const toggle = useCallback(() => {
    setMode(dark ? 'light' : 'dark')
  }, [dark, setMode])

  useLayoutEffect(() => {
    const root = document.documentElement
    const isDark = resolvesDark(mode)
    setDark(isDark)
    root.classList.toggle('dark', isDark)
  }, [mode])

  useEffect(() => {
    if (mode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      setDark(mq.matches)
      document.documentElement.classList.toggle('dark', mq.matches)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [mode])

  return (
    <ThemeContext.Provider value={{ dark, mode, setMode, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
