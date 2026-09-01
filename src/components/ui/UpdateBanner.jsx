import { useEffect, useState } from 'react'

/** Detects a waiting service worker and offers a one-tap update. */
// After this long still waiting on activation, say so — a slow/dropped
// connection can genuinely hold this up for many seconds (see applyUpdate
// below), and silence past this point reads as broken rather than working.
const SLOW_APPLY_MS = 5000

function useUpdateReady() {
  const [waitingSW, setWaitingSW] = useState(null)
  const [applying, setApplying] = useState(false)
  const [applySlow, setApplySlow] = useState(false)

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
    if (!waitingSW || applying) return
    setApplying(true)
    window.setTimeout(() => setApplySlow(true), SLOW_APPLY_MS)
    waitingSW.postMessage({ type: 'SKIP_WAITING' })

    // controllerchange (above) is what actually reloads the page, and it can
    // legitimately take a while: Chrome won't finish activating the new
    // worker while this tab has in-flight requests, and src/lib/supabase.js
    // gives every Supabase call up to a 20 s AbortController timeout that
    // isn't cancelled just because the app's own (shorter) internal races
    // gave up waiting on it. A slow or dropped connection is exactly the
    // case that leaves a request hanging that long.
    //
    // Reloading early doesn't help — it lands back on the still-old worker
    // (the new one hasn't actually activated yet) and shows this same
    // banner again, which is worse than doing nothing. So this only makes
    // the wait honest instead of looking dead; the real reload above still
    // does the work whenever the browser is actually ready for it.
  }

  return { updateReady: !!waitingSW, applying, applySlow, applyUpdate }
}

/**
 * Non-blocking update banner — sits at the bottom of the screen.
 * Does not prevent app usage.
 */
// How long to hide the banner after the user taps × before nudging again.
// Dismiss only snoozes — an un-applied update must never be forgotten, since a
// stale build silently breaks data-loading (e.g. blank timesheet hours).
const SNOOZE_MS = 3 * 60 * 1000

export default function UpdateBanner() {
  const { updateReady, applying, applySlow, applyUpdate } = useUpdateReady()
  const [dismissed, setDismissed] = useState(false)

  // Bring the banner back after the snooze window so it keeps reminding the
  // user until they actually apply the update.
  useEffect(() => {
    if (!dismissed) return
    const t = setTimeout(() => setDismissed(false), SNOOZE_MS)
    return () => clearTimeout(t)
  }, [dismissed])

  if (!updateReady || dismissed) return null

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-sm animate-slide-up">
      {/* charcoal is nearly the same value as the dark-mode page background
          (paperDark #1e1e1e), so a plain bg-charcoal card would vanish into
          the page in dark mode — the ring gives it a visible edge there. */}
      <div className="bg-charcoal text-cream dark:ring-1 dark:ring-white/12 rounded-2xl shadow-2xl px-5 py-4 flex items-center gap-3">
        <div className="shrink-0 text-cream/60">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">New version available</p>
          <p className="text-xs text-cream/50 mt-0.5">
            {applySlow
              ? "Still working — this can take a moment on a slow connection"
              : applying
                ? 'Updating…'
                : 'Tap Update to get the latest features'}
          </p>
        </div>
        <button
          onClick={applyUpdate}
          disabled={applying}
          className="bg-surface text-charcoal dark:text-white font-bold text-xs px-3 py-1.5 rounded-xl shrink-0 hover:bg-cream/90 transition-colors active:scale-95 disabled:opacity-60"
        >
          {applying ? 'Updating…' : 'Update'}
        </button>
        <button
          onClick={() => setDismissed(true)}
          disabled={applying}
          className="text-cream/40 hover:text-cream/70 transition-colors text-lg leading-none shrink-0 disabled:opacity-40"
          aria-label="Remind me later"
        >
          ×
        </button>
      </div>
    </div>
  )
}
