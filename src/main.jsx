import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
import { ThemeProvider } from './contexts/ThemeContext'
import ErrorBoundary from './components/ui/ErrorBoundary'

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
  initSentry()
}

// Sentry is the single largest download the app makes: 160 kB over the wire,
// nearly as much as the entire critical path (entry + React + Supabase + CSS
// ≈ 190 kB). It is already deferred off the render path via dynamic import —
// initializing it at module scope used to put it on the render-blocking entry
// chunk, fetched and parsed before the app could paint.
//
// Deferred is not the same as free, though: on mobile data those bytes still
// compete with the data requests the user is waiting on. So skip it entirely on
// a slow or metered connection. Losing error reports from the sessions that are
// already struggling is a real cost, but it is smaller than making those
// sessions struggle harder — and the same devices on WiFi still report.
function initSentry() {
  if (!import.meta.env.VITE_SENTRY_DSN) return

  const conn = navigator.connection
  const constrained = !!conn && (conn.saveData || ['slow-2g', '2g', '3g'].includes(conn.effectiveType))
  if (constrained) return

  const run = () => {
    import('@sentry/react').then((Sentry) => {
      Sentry.init({
        dsn: import.meta.env.VITE_SENTRY_DSN,
        environment: import.meta.env.MODE,
        integrations: [Sentry.browserTracingIntegration()],
        tracesSampleRate: 0.1,
        // Don't send errors in dev — only production
        enabled: import.meta.env.PROD,
      })
    })
  }

  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 2000 })
  else window.setTimeout(run, 500)
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
    // Best-effort native chrome setup — individual calls are no-ops on
    // platforms that don't support them (e.g. background colour is Android
    // only); a failure here must not block app start, so it stays silent.
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
