import React, { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext({ dark: false, toggle: () => {} })

const STORAGE_KEY = 'safeserv_dark_mode'

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored !== null) return stored === 'true'
      // Respect system preference as default on first visit
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
    } catch { return false }
  })

  // Apply / remove the 'dark' class on <html> and persist preference
  useEffect(() => {
    const root = document.documentElement
    if (dark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    try { localStorage.setItem(STORAGE_KEY, String(dark)) } catch {}
  }, [dark])

  // Listen for OS-level theme changes and follow them (unless the user has
  // manually overridden — in that case the stored pref takes priority and
  // the listener is still attached but checks for a stored value first).
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const handler = (e) => {
      // Only auto-follow system if no manual pref is stored
      try {
        if (localStorage.getItem(STORAGE_KEY) === null) setDark(e.matches)
      } catch {
        setDark(e.matches)
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // toggle() lets the user manually override the system preference
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
