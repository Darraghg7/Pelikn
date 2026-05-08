import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
import { ThemeProvider } from './contexts/ThemeContext'
import ErrorBoundary from './components/ui/ErrorBoundary'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
)

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
    await SplashScreen.hide({ fadeOutDuration: 0 }).catch(() => {})
    window.__peliknStartSplash?.()

    // Android hardware back button: go back in history or exit app
    CapApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back()
      else CapApp.exitApp()
    })
  } else {
    requestAnimationFrame(() => window.__peliknStartSplash?.())
  }
}

initNative()
