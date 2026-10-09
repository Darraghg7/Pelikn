import React, { useEffect, useState } from 'react'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import Button, { CloseButton } from '../../components/ui/Button'

function pushDismissKey(staffId) { return `pelikn_push_dismissed_${staffId ?? 'anon'}` }

export default function PushBanner({ staffId, venueId }) {
  const { permission, subscribe, supported, subscribed } = usePushNotifications(staffId, venueId)
  const [dismissed, setDismissed] = useState(false)

  // Re-read when staffId resolves (it may be null on first render)
  useEffect(() => {
    if (!staffId) return
    setDismissed(localStorage.getItem(pushDismissKey(staffId)) === '1')
  }, [staffId])

  if (!supported || permission === 'denied' || subscribed || dismissed) return null

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-warning/25 bg-warning/8 px-4 py-3.5">
      <span className="shrink-0 w-8 h-8 rounded-full bg-warning/15 flex items-center justify-center">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </span>
      <p className="text-sm text-charcoal/70 dark:text-white/60 flex-1 leading-snug">
        Enable notifications to get alerts for overdue checks
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          onClick={subscribe}
        >
          Enable
        </Button>
        <CloseButton label="Dismiss" onClick={() => { localStorage.setItem(pushDismissKey(staffId), '1'); setDismissed(true) }} />
      </div>
    </div>
  )
}
