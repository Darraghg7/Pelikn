import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import SettingsSection from './SettingsSection'

export default function VenueCodeSection({ venueId, sessionToken }) {
  const toast = useToast()
  const [code, setCode]             = useState('')
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [copied, setCopied]         = useState(false)
  const copyTimer                   = useRef(null)

  useEffect(() => {
    if (!venueId) return
    supabase.from('venues').select('join_code').eq('id', venueId).single()
      .then(({ data }) => { if (data?.join_code) setCode(data.join_code) })
      .finally(() => setLoading(false))
  }, [venueId])

  const copy = () => {
    if (!code) return
    navigator.clipboard.writeText(code).catch(() => {})
    setCopied(true)
    clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => setCopied(false), 2000)
  }

  const shareWhatsApp = () => {
    const msg = encodeURIComponent(
      `Download Pelikn from the App Store, open it, tap "Join with venue code" and enter: ${code}`
    )
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  const regenerate = async () => {
    if (!sessionToken) return
    setRefreshing(true)
    const { data, error } = await supabase.rpc('regenerate_venue_join_code', { p_session_token: sessionToken })
    setRefreshing(false)
    if (error) { toast('Failed to regenerate code', 'error'); return }
    setCode(data)
    toast('New venue code generated')
  }

  return (
    <SettingsSection title="Invite Staff">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-charcoal/60 dark:text-white/60">
          Share this code with staff so they can join your venue on the app — no email or password needed.
        </p>

        {loading ? (
          <div className="h-14 bg-charcoal/5 rounded-xl animate-pulse" />
        ) : (
          <div className="flex items-center gap-3 px-5 py-4 rounded-xl bg-brand/5 border border-brand/20">
            <span className="font-mono text-2xl font-bold tracking-[0.25em] text-brand dark:text-accent flex-1">
              {code}
            </span>
            <button
              onClick={copy}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-brand/25 text-brand dark:text-accent hover:bg-brand/10 transition-colors shrink-0"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={shareWhatsApp}
            disabled={!code}
            className="flex items-center gap-2 bg-[#25D366] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#20bc5a] transition-colors disabled:opacity-40"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.025.502 3.934 1.385 5.612L0 24l6.562-1.366A11.942 11.942 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.8 9.8 0 01-5.032-1.384l-.361-.214-3.737.979.997-3.648-.235-.374A9.757 9.757 0 012.182 12c0-5.42 4.398-9.818 9.818-9.818 5.42 0 9.818 4.398 9.818 9.818 0 5.42-4.398 9.818-9.818 9.818z"/>
            </svg>
            Share via WhatsApp
          </button>
          <button
            onClick={regenerate}
            disabled={refreshing || !code}
            className="flex items-center gap-2 border border-charcoal/15 text-charcoal/60 dark:text-white/60 px-4 py-2.5 rounded-xl text-sm font-medium hover:border-charcoal/30 hover:text-charcoal dark:hover:text-white transition-colors disabled:opacity-40"
          >
            <svg className={['w-3.5 h-3.5', refreshing ? 'animate-spin' : ''].join(' ')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6M3 12a9 9 0 0115-6.7L21 8M3 22v-6h6M21 12a9 9 0 01-15 6.7L3 16"/>
            </svg>
            {refreshing ? 'Refreshing…' : 'New code'}
          </button>
        </div>
        <p className="text-[11px] text-charcoal/35 dark:text-white/35">
          Tap "New code" if a staff member leaves — the old code stops working immediately.
        </p>
      </div>
    </SettingsSection>
  )
}
