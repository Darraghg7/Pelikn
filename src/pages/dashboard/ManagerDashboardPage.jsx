import React, { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'

// Multi-venue is just Pro × number of venues — no separate tier in the app
const PLAN_CONFIG = {
  starter: { label: 'Starter', bg: 'bg-teal-50',   text: 'text-teal-700', border: 'border-teal-200'  },
  pro:     { label: 'Pro',     bg: 'bg-accent/10', text: 'text-accent',   border: 'border-accent/25' },
}
function PlanBadge({ plan }) {
  const cfg = PLAN_CONFIG[plan] ?? PLAN_CONFIG.starter
  return (
    <span className={`text-[10px] tracking-widest uppercase font-semibold px-2 py-0.5 rounded border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.label}
    </span>
  )
}
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import { WIDGET_REGISTRY, DEFAULT_WIDGETS, ALL_WIDGET_IDS } from '../../components/widgets/WidgetRegistry'
import ClockPanel from '../../components/ClockPanel'
import Modal from '../../components/ui/Modal'

function useVenueBranding(venueId) {
  const [venueName, setVenueName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  useEffect(() => {
    if (!venueId) return
    supabase.from('app_settings').select('key, value')
      .eq('venue_id', venueId)
      .in('key', ['venue_name', 'logo_url'])
      .then(({ data }) => {
        if (data) {
          const map = Object.fromEntries(data.map(r => [r.key, r.value]))
          setVenueName(map.venue_name ?? '')
          setLogoUrl(map.logo_url ?? '')
        }
      })
  }, [venueId])
  return { venueName, logoUrl }
}

/* ── Widget preferences hook ─────────────────────────────────────────────── */
function useWidgetPreferences(staffId, venueId) {
  const [widgetIds, setWidgetIds] = useState(null) // null = loading
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!staffId || !venueId) return
    const { data } = await supabase
      .from('dashboard_widgets')
      .select('widget_id, position')
      .eq('venue_id', venueId)
      .eq('staff_id', staffId)
      .order('position')

    if (data && data.length > 0) {
      setWidgetIds(data.map(d => d.widget_id))
    } else {
      // No saved prefs — use defaults
      setWidgetIds(DEFAULT_WIDGETS)
    }
    setLoading(false)
  }, [staffId])

  useEffect(() => { load() }, [load])

  const save = useCallback(async (newIds) => {
    if (!staffId || !venueId) return
    setWidgetIds(newIds)

    // Delete existing, insert new
    await supabase.from('dashboard_widgets').delete().eq('staff_id', staffId).eq('venue_id', venueId)
    if (newIds.length > 0) {
      const rows = newIds.map((id, i) => ({ staff_id: staffId, widget_id: id, position: i, venue_id: venueId }))
      await supabase.from('dashboard_widgets').insert(rows)
    }
  }, [staffId, venueId])

  return { widgetIds: widgetIds ?? DEFAULT_WIDGETS, loading, save }
}

/* ── Widget Picker Modal ─────────────────────────────────────────────────── */
function WidgetPicker({ open, onClose, activeIds, onSave }) {
  const [selected, setSelected] = useState([])

  useEffect(() => {
    if (open) setSelected([...activeIds])
  }, [open, activeIds])

  const toggle = (id) => {
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
    )
  }

  const moveUp = (id) => {
    setSelected(prev => {
      const idx = prev.indexOf(id)
      if (idx <= 0) return prev
      const next = [...prev]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next
    })
  }

  const moveDown = (id) => {
    setSelected(prev => {
      const idx = prev.indexOf(id)
      if (idx < 0 || idx >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next
    })
  }

  return (
    <Modal open={open} onClose={onClose} title="Customise Dashboard">
      <div className="flex flex-col gap-4">
        <p className="text-xs text-charcoal/50">
          Select and reorder the widgets you want on your dashboard.
        </p>

        {/* Active widgets — reorderable */}
        {selected.length > 0 && (
          <div>
            <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-2">Your widgets</p>
            <div className="flex flex-col gap-1.5">
              {selected.map((id, idx) => {
                const w = WIDGET_REGISTRY[id]
                if (!w) return null
                return (
                  <div key={id} className="flex items-center gap-2 bg-charcoal/4 rounded-xl px-3 py-2.5">
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveUp(id)}
                        disabled={idx === 0}
                        className="text-charcoal/30 hover:text-charcoal disabled:opacity-20 text-[11px] leading-none"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveDown(id)}
                        disabled={idx === selected.length - 1}
                        className="text-charcoal/30 hover:text-charcoal disabled:opacity-20 text-[11px] leading-none"
                      >
                        ▼
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-charcoal truncate">{w.label}</p>
                      <p className="text-[11px] text-charcoal/40 truncate">{w.description}</p>
                    </div>
                    <button
                      onClick={() => toggle(id)}
                      className="text-danger/50 hover:text-danger text-xs px-2 py-1 shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Available widgets */}
        {(() => {
          const available = ALL_WIDGET_IDS.filter(id => !selected.includes(id))
          if (available.length === 0) return null
          return (
            <div>
              <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-2">Available widgets</p>
              <div className="flex flex-col gap-1.5">
                {available.map(id => {
                  const w = WIDGET_REGISTRY[id]
                  return (
                    <button
                      key={id}
                      onClick={() => toggle(id)}
                      className="flex items-center gap-3 rounded-xl border border-dashed border-charcoal/15 px-3 py-2.5 hover:border-charcoal/30 hover:bg-charcoal/3 transition-all text-left"
                    >
                      <span className="text-charcoal/20 text-lg shrink-0">+</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-charcoal/60 truncate">{w.label}</p>
                        <p className="text-[11px] text-charcoal/35 truncate">{w.description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* Save */}
        <div className="flex gap-2 pt-2 border-t border-charcoal/8">
          <button
            onClick={() => { onSave(selected); onClose() }}
            className="flex-1 bg-charcoal text-cream py-2.5 rounded-xl text-sm font-medium hover:bg-charcoal/90 transition-colors"
          >
            Save Layout
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-charcoal/15 text-sm text-charcoal/50 hover:text-charcoal transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   MANAGER DASHBOARD
   ═══════════════════════════════════════════════════════════════════════════ */

export default function ManagerDashboardPage() {
  const { venueId, venuePlan } = useVenue()
  const { session } = useSession()
  const toast = useToast()
  const { venueName, logoUrl } = useVenueBranding(venueId)
  const { widgetIds, loading, save } = useWidgetPreferences(session?.staffId, venueId)
  const [showPicker, setShowPicker] = useState(false)

  const handleSave = (newIds) => {
    save(newIds)
    toast('Dashboard updated')
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {logoUrl && (
            <img
              src={logoUrl}
              alt="Venue logo"
              className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl object-contain bg-white border border-charcoal/10 p-1 shrink-0"
            />
          )}
          <div>
            {venueName && (
              <p className="font-serif text-2xl sm:text-3xl text-charcoal font-semibold">{venueName}</p>
            )}
            <p className="text-xs uppercase tracking-widest text-charcoal/40 mt-0.5">{format(new Date(), 'EEEE, d MMMM')}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-sm text-charcoal/40">Manager Dashboard</p>
              <PlanBadge plan={venuePlan} />
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowPicker(true)}
          className="text-[11px] sm:text-[11px] tracking-widest uppercase text-charcoal/30 hover:text-charcoal/60 border border-charcoal/15 hover:border-charcoal/30 px-2.5 py-1.5 rounded-lg transition-colors mt-1"
        >
          Customise
        </button>
      </div>

      {/* Clock in/out */}
      <div className="bg-white rounded-xl border border-charcoal/10 p-5">
        <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-3">My Clock</p>
        <ClockPanel staffId={session?.staffId} hasShift />
      </div>

      {/* Widget grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {widgetIds.map(id => {
          const widget = WIDGET_REGISTRY[id]
          if (!widget) return null
          const Component = widget.component
          return <Component key={id} />
        })}
      </div>

      {widgetIds.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-charcoal/20 p-10 text-center">
          <p className="text-charcoal/30 text-sm mb-3">No widgets on your dashboard</p>
          <button
            onClick={() => setShowPicker(true)}
            className="bg-charcoal text-cream px-4 py-2 rounded-lg text-sm font-medium hover:bg-charcoal/90 transition-colors"
          >
            + Add Widgets
          </button>
        </div>
      )}

      {/* Widget picker modal */}
      <WidgetPicker
        open={showPicker}
        onClose={() => setShowPicker(false)}
        activeIds={widgetIds}
        onSave={handleSave}
      />
    </div>
  )
}
