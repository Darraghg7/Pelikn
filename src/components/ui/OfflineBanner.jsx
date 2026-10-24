import React, { useState, useEffect, useCallback, useRef } from 'react'
import { queueCount } from '../../lib/offlineQueue'
import { syncQueue } from '../../lib/offlineSupabase'
import { useToast } from './Toast'

export default function OfflineBanner() {
  const toast = useToast()
  const [online, setOnline] = useState(navigator.onLine)
  const [pending, setPending] = useState(queueCount())
  const [syncing, setSyncing] = useState(false)

  // Listen for online/offline events
  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  // Poll queue count
  useEffect(() => {
    const interval = setInterval(() => setPending(queueCount()), 3000)
    return () => clearInterval(interval)
  }, [])

  // Auto-sync when coming back online. Held in a ref: if this function changed
  // every time `syncing` flipped, the effect below re-ran the moment a sync
  // ended, so one item the server kept refusing was re-sent non-stop.
  const syncingRef = useRef(false)
  const doSync = useCallback(async () => {
    if (queueCount() === 0 || syncingRef.current) return
    syncingRef.current = true
    setSyncing(true)
    const { synced, failed } = await syncQueue()
    setPending(queueCount())
    syncingRef.current = false
    setSyncing(false)
    if (synced > 0) toast(`Synced ${synced} offline record${synced !== 1 ? 's' : ''}`)
    if (failed > 0) toast(`${failed} record${failed !== 1 ? 's' : ''} failed to sync`, 'error')
  }, [toast])

  // On going online, and when something new joins the queue. NOT when a sync
  // ends with items still waiting: the timer below retries those, once a minute.
  useEffect(() => {
    if (online && pending > 0) doSync()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doSync is stable; only these two should trigger it
  }, [online, pending > 0])

  // Safety-net retry — the native online/offline events only fire on actual
  // connectivity changes, but navigator.onLine only reflects "connected to a
  // network," not "can reach Supabase." A venue with a flaky router or a weak
  // signal can sit at onLine:true the whole time while every request fails,
  // so the reactive triggers above never fire again after the first attempt
  // and a queued write can be stuck on that device indefinitely. Poll
  // independently of connectivity state so it self-heals once the request
  // actually succeeds, without needing the OS to ever report "offline".
  useEffect(() => {
    const interval = setInterval(() => {
      if (queueCount() > 0) doSync()
    }, 60_000)
    return () => clearInterval(interval)
  }, [doSync])

  // Show nothing if online and no pending
  if (online && pending === 0) return null

  return (
    <div className={`px-4 py-2 text-center text-xs font-medium ${
      online
        ? 'bg-warning/10 text-warning'
        : 'bg-danger/10 text-danger'
    }`}>
      {!online ? (
        <span>You're offline. Clock-ins are saved on this device and sent when you reconnect. Everything else needs a connection, so it won't save until you're back.</span>
      ) : syncing ? (
        <span>Syncing {pending} offline record{pending !== 1 ? 's' : ''}...</span>
      ) : (
        <button onClick={doSync} className="underline">
          {pending} offline record{pending !== 1 ? 's' : ''} pending, tap to sync
        </button>
      )}
    </div>
  )
}
