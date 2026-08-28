import React, { useState, useEffect, useCallback } from 'react'
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

  // Auto-sync when coming back online
  const doSync = useCallback(async () => {
    if (pending === 0 || syncing) return
    setSyncing(true)
    const { synced, failed } = await syncQueue()
    setPending(queueCount())
    setSyncing(false)
    if (synced > 0) toast(`Synced ${synced} offline record${synced !== 1 ? 's' : ''}`)
    if (failed > 0) toast(`${failed} record${failed !== 1 ? 's' : ''} failed to sync`, 'error')
  }, [pending, syncing, toast])

  useEffect(() => {
    if (online && pending > 0) doSync()
  }, [online, pending, doSync])

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
        <span>You're offline. Data will be saved locally and synced when reconnected</span>
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
