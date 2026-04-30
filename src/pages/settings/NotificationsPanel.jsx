import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import { useVenue } from '../../contexts/VenueContext'

/* ── Notifications panel ────────────────────────────────────────────────────── */
export default function NotificationsPanel({ session, toast, settings }) {
  const { venueId } = useVenue()
  const { supported, permission, subscribed, subscribing, subscribe, unsubscribe } =
    usePushNotifications(session?.staffId, venueId)
  const [sendingReport, setSendingReport] = useState(false)

  const sendWeeklyReport = async () => {
    setSendingReport(true)
    const { error } = await supabase.functions.invoke('send-weekly-report', {
      body: { to: settings.manager_email, venueId, sessionToken: session?.token },
    })
    setSendingReport(false)
    if (error) { toast('Failed to send report: ' + error.message, 'error'); return }
    toast(`Report sent to ${settings.manager_email || 'manager email'}`)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Push notifications */}
      <div>
        <p className="text-sm font-medium text-charcoal mb-1">Push Notifications</p>
        <p className="text-xs text-charcoal/40 mb-3">
          Receive alerts on your phone for late clock-ins and overdue tasks — even when the app is in the background.
        </p>
        {!supported ? (
          <p className="text-xs text-charcoal/35 italic">Push notifications are not supported in this browser. Install the app on your phone to enable them.</p>
        ) : permission === 'denied' ? (
          <p className="text-xs text-danger/70">Notifications blocked. Please enable them in your browser/phone settings.</p>
        ) : subscribed ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-success font-medium">● Notifications enabled</span>
            <button onClick={unsubscribe}
              className="text-xs text-charcoal/40 hover:text-danger transition-colors underline underline-offset-2">
              Disable
            </button>
          </div>
        ) : (
          <button onClick={subscribe} disabled={subscribing}
            className="bg-charcoal text-cream px-4 py-2 rounded-lg text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-40">
            {subscribing ? 'Enabling…' : 'Enable Notifications →'}
          </button>
        )}
      </div>

      {/* Weekly email report */}
      <div className="border-t border-charcoal/8 pt-4">
        <p className="text-sm font-medium text-charcoal mb-1">Weekly Report</p>
        <p className="text-xs text-charcoal/40 mb-3">
          Send a summary report to <span className="font-medium text-charcoal/60">{settings.manager_email || 'your manager email'}</span> covering hours, temp checks, cleaning and waste for the past 7 days.
        </p>
        {!settings.manager_email ? (
          <p className="text-xs text-charcoal/35 italic">Set your manager email in Venue Details to enable reports.</p>
        ) : (
          <button onClick={sendWeeklyReport} disabled={sendingReport}
            className="bg-charcoal text-cream px-4 py-2 rounded-lg text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-40">
            {sendingReport ? 'Sending…' : 'Send Weekly Report →'}
          </button>
        )}
      </div>
    </div>
  )
}
