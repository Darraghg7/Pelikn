import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App'
import { ThemeProvider } from './contexts/ThemeContext'
import ErrorBoundary from './components/ui/ErrorBoundary'

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
    // Don't send errors in dev — only production
    enabled: import.meta.env.PROD,
  })
}

function mountApp() {
  const root = document.getElementById('root')
  if (!root) {
    document.addEventListener('DOMContentLoaded', mountApp, { once: true })
    return
  }

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ErrorBoundary>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </ErrorBoundary>
    </React.StrictMode>
  )

  initNative()
}

// Only register service worker in browser/PWA context — not inside Capacitor native shell
// (Capacitor serves assets from the bundle; SW caching would conflict)
async function initNative() {
  const { Capacitor } = await import('@capacitor/core')
  if (Capacitor.isNativePlatform()) {
    const [{ StatusBar, Style }, { App: CapApp }, { SplashScreen }] = await Promise.all([
      import('@capacitor/status-bar'),
      import('@capacitor/app'),
      import('@capacitor/splash-screen'),
    ])
    StatusBar.setStyle({ style: Style.Dark })
    StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {})
    StatusBar.setBackgroundColor({ color: '#1a3c2e' }).catch(() => {}) // Android only
    SplashScreen.hide({ fadeOutDuration: 0 }).catch(() => {})

    // Android hardware back button: go back in history or exit app
    CapApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back()
      else CapApp.exitApp()
    })
  }
}

mountApp()
