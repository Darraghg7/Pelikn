import { useEffect, useState } from 'react'

/** Detects a waiting service worker and offers a one-tap update. */
function useUpdateReady() {
  const [waitingSW, setWaitingSW] = useState(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let interval = null

    navigator.serviceWorker.getRegistration().then(reg => {
      if (!reg) return

      // Already waiting — show banner immediately
      if (reg.waiting) setWaitingSW(reg.waiting)

      // Watch for new service workers
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing
        newSW?.addEventListener('statechange', (e) => {
          if (e.target.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingSW(e.target)
          }
        })
      })

      // Proactively check for updates on page load and every 30 minutes
      reg.update().catch(() => {})
      interval = setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000)
    })

    // Also check for updates when the app comes back to the foreground
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        navigator.serviceWorker.getRegistration().then(reg => {
          reg?.update().catch(() => {})
        })
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    const onControllerChange = () => window.location.reload()
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  const applyUpdate = () => {
    if (!waitingSW) return
    waitingSW.postMessage({ type: 'SKIP_WAITING' })
  }

  return { updateReady: !!waitingSW, applyUpdate }
}

/**
 * Non-blocking update banner — sits at the bottom of the screen.
 * Does not prevent app usage.
 */
export default function UpdateBanner() {
  const { updateReady, applyUpdate } = useUpdateReady()
  const [dismissed, setDismissed] = useState(false)

  if (!updateReady || dismissed) return null

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-sm animate-slide-up">
      <div className="bg-charcoal text-cream rounded-2xl shadow-2xl px-5 py-4 flex items-center gap-3">
        <div className="shrink-0 text-cream/60">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">New version available</p>
          <p className="text-xs text-cream/50 mt-0.5">Tap Update to get the latest features</p>
        </div>
        <button
          onClick={applyUpdate}
          className="bg-surface text-charcoal font-bold text-xs px-3 py-1.5 rounded-xl shrink-0 hover:bg-cream/90 transition-colors active:scale-95"
        >
          Update
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-cream/40 hover:text-cream/70 transition-colors text-lg leading-none shrink-0"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  )
}
