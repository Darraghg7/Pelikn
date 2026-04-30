import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import { useVenue } from '../../contexts/VenueContext'
import { NOTIFICATION_TYPES } from '../../lib/notificationTypes'

function PreferenceToggle({ type, enabled, saving, onToggle }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(type.id, !enabled)}
      disabled={saving}
      className="w-full flex items-center justify-between gap-4 py-3 text-left disabled:opacity-50"
      aria-pressed={enabled}
    >
      <span>
        <span className="block text-sm font-medium text-charcoal">{type.label}</span>
        <span className="block text-xs text-charcoal/40 mt-0.5">{type.description}</span>
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${enabled ? 'bg-accent' : 'bg-charcoal/20'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </span>
    </button>
  )
}

/* ── Notifications panel ────────────────────────────────────────────────────── */
export default function NotificationsPanel({ session, toast, settings }) {
  const { venueId } = useVenue()
  const { supported, permission, subscribed, subscribing, subscribe, unsubscribe } =
    usePushNotifications(session?.staffId, venueId)
  const [sendingReport, setSendingReport] = useState(false)
  const [preferences, setPreferences] = useState({})
  const [prefsLoading, setPrefsLoading] = useState(true)
  const [savingType, setSavingType] = useState(null)

  const defaultPreferences = useMemo(
    () => Object.fromEntries(NOTIFICATION_TYPES.map(type => [type.id, true])),
    []
  )

  useEffect(() => {
    if (!session?.token) { setPrefsLoading(false); return }
    let cancelled = false
    setPrefsLoading(true)
    supabase.rpc('get_staff_notification_preferences', { p_session_token: session.token })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setPreferences(defaultPreferences)
          return
        }
        const saved = Object.fromEntries((data ?? []).map(row => [row.notification_type, row.enabled]))
        setPreferences({ ...defaultPreferences, ...saved })
      })
      .finally(() => { if (!cancelled) setPrefsLoading(false) })
    return () => { cancelled = true }
  }, [defaultPreferences, session?.token])

  const togglePreference = useCallback(async (notificationType, enabled) => {
    if (!session?.token) return
    const previous = preferences[notificationType] ?? true
    setPreferences(prev => ({ ...prev, [notificationType]: enabled }))
    setSavingType(notificationType)
    const { error } = await supabase.rpc('save_staff_notification_preference', {
      p_session_token:     session.token,
      p_notification_type: notificationType,
      p_enabled:           enabled,
    })
    setSavingType(null)
    if (error) {
      setPreferences(prev => ({ ...prev, [notificationType]: previous }))
      toast('Could not save notification preference: ' + error.message, 'error')
    }
  }, [preferences, session?.token, toast])

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

      {/* Notification type preferences */}
      <div className="border-t border-charcoal/8 pt-4">
        <p className="text-sm font-medium text-charcoal mb-1">Notification Types</p>
        <p className="text-xs text-charcoal/40 mb-2">
          Choose exactly which push notifications this staff profile receives on this device.
        </p>
        {prefsLoading ? (
          <p className="text-xs text-charcoal/35 italic py-3">Loading preferences…</p>
        ) : (
          <div className="divide-y divide-charcoal/8">
            {NOTIFICATION_TYPES.map(type => (
              <PreferenceToggle
                key={type.id}
                type={type}
                enabled={preferences[type.id] ?? true}
                saving={savingType === type.id}
                onToggle={togglePreference}
              />
            ))}
          </div>
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
