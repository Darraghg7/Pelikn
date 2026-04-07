import React, { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import { supabase } from '../../lib/supabase'
import SettingsSection from './SettingsSection'
import { useVenueFeatures } from '../../hooks/useVenueFeatures'
import { PLANS } from '../../lib/constants'
import { EXTRA_VENUE_PRICE } from '../../lib/pricing'
import { slugify } from '../../lib/utils'

export default function VenuesSection() {
  const { venues, refreshVenues, selectVenue } = useAuth()
  const { venuePlan } = useVenueFeatures()
  const { session } = useSession()
  const toast = useToast()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({ name: '', slug: '' })
  const [saving, setSaving]     = useState(false)
  const [slugEdited, setSlugEdited] = useState(false)

  const handleNameChange = (name) => {
    setForm(f => ({
      ...f,
      name,
      slug: slugEdited ? f.slug : slugify(name),
    }))
  }

  const handleAdd = async () => {
    if (!form.name.trim()) { toast('Venue name is required', 'error'); return }
    if (!form.slug.trim()) { toast('URL slug is required', 'error'); return }
    if (!/^[a-z0-9-]+$/.test(form.slug)) {
      toast('Slug can only contain lowercase letters, numbers and hyphens', 'error')
      return
    }

    setSaving(true)
    const { error } = await supabase.rpc('create_additional_venue', {
      p_name: form.name.trim(),
      p_slug: form.slug.trim(),
    })
    setSaving(false)

    if (error) {
      toast(error.message.includes('already taken')
        ? 'That URL is already taken — try a different slug'
        : error.message, 'error')
      return
    }

    toast(`${form.name} added successfully`)
    setShowForm(false)
    setForm({ name: '', slug: '' })
    setSlugEdited(false)
    refreshVenues()
  }

  const handleOpenVenue = (slug) => {
    selectVenue(slug)
    window.location.replace(`/v/${slug}/dashboard`)
  }

  return (
    <SettingsSection
      title="My Venues"
      subtitle={`${venues.length} venue${venues.length !== 1 ? 's' : ''}`}
      locked={venuePlan !== PLANS.PRO}
    >
      {/* Venue list */}
      <div className="flex flex-col divide-y divide-charcoal/6 mb-4">
        {venues.map((v, i) => (
          <div key={v.id} className="py-3.5 first:pt-0 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-charcoal text-sm">{v.name}</p>
                <span className="text-[10px] tracking-widest uppercase font-semibold px-1.5 py-0.5 rounded bg-brand/8 text-brand">
                  {v.plan}
                </span>
                {i === 0 && (
                  <span className="text-[10px] tracking-widest uppercase font-medium px-1.5 py-0.5 rounded bg-charcoal/5 text-charcoal/40">
                    Primary
                  </span>
                )}
              </div>
              <p className="text-xs text-charcoal/40 mt-0.5">safeserv.app/v/{v.slug}</p>
            </div>
            <button
              onClick={() => handleOpenVenue(v.slug)}
              className="text-xs px-3 py-1.5 rounded-lg border border-charcoal/15 text-charcoal/60 hover:text-charcoal hover:border-charcoal/30 transition-colors whitespace-nowrap shrink-0"
            >
              Open →
            </button>
          </div>
        ))}
      </div>

      {/* Add venue form */}
      {showForm ? (
        <div className="p-4 rounded-xl bg-cream/50 border border-charcoal/10 flex flex-col gap-3.5">
          <p className="text-sm font-semibold text-charcoal">Add New Venue</p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1.5">Venue Name *</label>
              <input
                value={form.name}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="e.g. Nomad City Centre"
                className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
            </div>
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1.5">URL Slug *</label>
              <div className="flex items-center rounded-lg border border-charcoal/15 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-charcoal/20">
                <span className="pl-3 text-xs text-charcoal/30 whitespace-nowrap">/v/</span>
                <input
                  value={form.slug}
                  onChange={e => { setSlugEdited(true); setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })) }}
                  placeholder="nomad-city-centre"
                  className="flex-1 px-2 py-2.5 text-sm bg-transparent focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 text-xs text-charcoal/50 bg-amber-50 rounded-lg px-3 py-2.5">
            <span className="text-amber-500 shrink-0">💳</span>
            <span>
              Adding a venue costs <strong>{EXTRA_VENUE_PRICE}/mo</strong> and will be reflected on your next billing cycle.
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving || !form.name.trim() || !form.slug.trim()}
              className="flex-1 bg-charcoal text-cream py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-charcoal/90 transition-colors"
            >
              {saving ? 'Creating…' : 'Create Venue →'}
            </button>
            <button
              onClick={() => { setShowForm(false); setForm({ name: '', slug: '' }); setSlugEdited(false) }}
              className="px-4 py-2.5 rounded-lg border border-charcoal/15 text-sm text-charcoal/50 hover:border-charcoal/30 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <button
            onClick={() => setShowForm(true)}
            className="text-[11px] tracking-widest uppercase text-charcoal/40 hover:text-charcoal transition-colors border-b border-charcoal/20"
          >
            + Add Venue
          </button>
        </div>
      )}
    </SettingsSection>
  )
}
