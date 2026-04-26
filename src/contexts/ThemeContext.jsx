import React, { createContext, useContext, useState, useLayoutEffect } from 'react'

const ThemeContext = createContext({ dark: false, toggle: () => {} })

const STORAGE_KEY = 'pelikn_dark_mode'

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored !== null) return stored === 'true'
      // Default to light mode — never follow system preference automatically
      return false
    } catch { return false }
  })

  // Apply / remove the 'dark' class on <html> and persist user's choice
  useLayoutEffect(() => {
    const root = document.documentElement
    if (dark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    try { localStorage.setItem(STORAGE_KEY, String(dark)) } catch {}
  }, [dark])

  // toggle() lets the user manually switch between light and dark
  const toggle = () => setDark(d => !d)

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
