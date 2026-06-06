import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import Toggle from '../../components/ui/Toggle'
import { PERMISSION_PRESETS, PERMISSION_TITLES_SETTING_KEY, STAFF_PERMISSIONS } from '../../lib/constants'

export default function PermissionTitlesSection({ venueId, titles, reloadSettings }) {
  const toast = useToast()
  const [draft, setDraft] = useState(() => titles?.length ? titles : PERMISSION_PRESETS)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraft(titles?.length ? titles : PERMISSION_PRESETS)
  }, [titles])

  const updateTitle = (id, patch) => {
    setDraft(prev => prev.map(title => title.id === id ? { ...title, ...patch } : title))
  }

  const togglePermission = (titleId, permissionId, on) => {
    setDraft(prev => prev.map(title => {
      if (title.id !== titleId) return title
      const permissions = new Set(title.permissions)
      on ? permissions.add(permissionId) : permissions.delete(permissionId)
      return { ...title, permissions: [...permissions] }
    }))
  }

  const addTitle = () => {
    setDraft(prev => [...prev, { id: `custom-${Date.now()}`, label: 'New title', permissions: [] }])
  }

  const removeTitle = (id) => {
    setDraft(prev => prev.filter(title => title.id !== id))
  }

  const saveTitles = async () => {
    const cleaned = draft
      .map(title => ({
        ...title,
        label: title.label.trim(),
        permissions: title.permissions.filter(id => STAFF_PERMISSIONS.some(p => p.id === id)),
      }))
      .filter(title => title.label)

    if (!cleaned.length) { toast('Add at least one permission title', 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('app_settings').upsert({
      venue_id: venueId,
      key: PERMISSION_TITLES_SETTING_KEY,
      value: JSON.stringify(cleaned),
    }, { onConflict: 'venue_id,key' })
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Permission titles saved')
    reloadSettings()
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-charcoal/45">
        Create the access titles used when editing staff members. Each venue can keep its own set.
      </p>

      <div className="flex flex-col gap-3">
        {draft.map(title => (
          <div key={title.id} className="rounded-xl border border-charcoal/10 bg-white p-4">
            <div className="flex items-center gap-2 mb-4">
              <input
                value={title.label}
                onChange={e => updateTitle(title.id, { label: e.target.value })}
                className="flex-1 px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm font-semibold text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
              <button
                onClick={() => removeTitle(title.id)}
                className="text-xs text-danger/45 hover:text-danger px-2 py-1"
              >
                Remove
              </button>
            </div>

            {['Compliance', 'Operations', 'Team'].map(category => (
              <div key={category} className="mb-3 last:mb-0">
                <p className="text-[11px] tracking-widest uppercase text-charcoal/30 mb-1.5">{category}</p>
                <div className="grid sm:grid-cols-2 gap-1.5">
                  {STAFF_PERMISSIONS.filter(p => p.category === category).map(permission => (
                    <label key={permission.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-charcoal/2">
                      <span className="text-xs text-charcoal/65">{permission.label}</span>
                      <Toggle
                        checked={title.permissions.includes(permission.id)}
                        onChange={on => togglePermission(title.id, permission.id, on)}
                        size="sm"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={addTitle}
          className="px-4 py-2 rounded-lg border border-charcoal/15 text-sm text-charcoal/60 hover:text-charcoal hover:border-charcoal/30 transition-colors"
        >
          + Add Title
        </button>
        <button
          onClick={saveTitles}
          disabled={saving}
          className="bg-charcoal text-cream px-5 py-2 rounded-lg text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save Titles →'}
        </button>
      </div>
    </div>
  )
}
