import { useEffect, useState } from 'react'

/** Detects a waiting service worker and offers a one-tap update. */
function useUpdateReady() {
  const [waitingSW, setWaitingSW] = useState(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg?.waiting) setWaitingSW(reg.waiting)
    })

    navigator.serviceWorker.getRegistration().then(reg => {
      if (!reg) return
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing
        newSW?.addEventListener('statechange', (e) => {
          if (e.target.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingSW(e.target)
          }
        })
      })
    })

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload()
    })
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
    <div className="fixed bottom-20 lg:bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-sm">
      <div className="bg-charcoal text-cream rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Update available</p>
          <p className="text-xs text-cream/50 mt-0.5">Tap to get the latest version</p>
        </div>
        <button
          onClick={applyUpdate}
          className="bg-cream text-charcoal font-bold text-xs px-3 py-1.5 rounded-xl shrink-0 hover:bg-cream/90 transition-colors active:scale-95"
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
