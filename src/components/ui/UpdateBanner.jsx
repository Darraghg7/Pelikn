import { useEffect, useState } from 'react'

/** Detects a waiting service worker and offers a one-tap update. */
function useUpdateReady() {
  const [waitingSW, setWaitingSW] = useState(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // Check immediately — SW may already be waiting when page loads
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg?.waiting) setWaitingSW(reg.waiting)
    })

    // Listen for a new SW finishing installation
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

    // When the new SW takes control, reload to use the fresh assets
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
 * Renders a slim banner at the top of the viewport when a new app version
 * is waiting. Works on every page — including the PIN picker login screen —
 * because it is mounted at the app root, not inside AppShell.
 */
export default function UpdateBanner() {
  const { updateReady, applyUpdate } = useUpdateReady()

  if (!updateReady) return null

  return (
    <div className="fixed top-0 inset-x-0 z-[200] flex items-center justify-between gap-3 bg-warning text-white px-4 py-2.5">
      <div className="flex items-center gap-2">
        <span className="text-sm">⬆️</span>
        <span className="text-xs font-medium">Update available — tap to get the latest version</span>
      </div>
      <button
        onClick={applyUpdate}
        className="shrink-0 text-xs font-bold bg-white/25 hover:bg-white/35 transition-colors px-3 py-1.5 rounded-lg whitespace-nowrap"
      >
        Update
      </button>
    </div>
  )
}
