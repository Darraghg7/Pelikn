import React, { useState } from 'react'
import { useToast } from '../../components/ui/Toast'
import { useDutyTemplates } from '../../hooks/useDuties'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

function ItemInput({ value, onChange, onRemove, onKeyDown, autoFocus }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-charcoal/20 shrink-0">
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
          <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>
      </span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        placeholder="Task description…"
        className="flex-1 px-3 py-1.5 rounded-lg border border-charcoal/12 bg-white text-sm text-charcoal placeholder-charcoal/25 focus:outline-none focus:ring-2 focus:ring-charcoal/15"
      />
      <button
        type="button"
        onClick={onRemove}
        className="text-charcoal/25 hover:text-danger transition-colors shrink-0 px-1"
      >×</button>
    </div>
  )
}

function NewDutyForm({ onSave, onCancel }) {
  const [title, setTitle] = useState('')
  const [items, setItems] = useState(['', ''])
  const [saving, setSaving] = useState(false)

  const addItem = () => setItems(prev => [...prev, ''])
  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i))
  const updateItem = (i, val) => setItems(prev => prev.map((v, idx) => idx === i ? val : v))

  const handleKeyDown = (e, i) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (i === items.length - 1) addItem()
    }
  }

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    await onSave(title, items)
    setSaving(false)
  }

  return (
    <div className="rounded-2xl border border-charcoal/12 bg-charcoal/2 p-4 flex flex-col gap-3">
      <div>
        <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1.5">Duty name</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && document.activeElement.blur()}
          autoFocus
          placeholder="e.g. Opening Barista"
          className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 bg-white text-sm text-charcoal placeholder-charcoal/25 focus:outline-none focus:ring-2 focus:ring-charcoal/20"
        />
      </div>

      <div>
        <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">Tasks</label>
        <div className="flex flex-col gap-2">
          {items.map((item, i) => (
            <ItemInput
              key={i}
              value={item}
              onChange={val => updateItem(i, val)}
              onRemove={() => removeItem(i)}
              onKeyDown={e => handleKeyDown(e, i)}
              autoFocus={false}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={addItem}
          className="mt-2 text-xs text-brand/60 hover:text-brand transition-colors"
        >
          + Add task
        </button>
      </div>

      <div className="flex gap-2 pt-1 border-t border-charcoal/8">
        <button
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="px-4 py-2 rounded-lg bg-charcoal text-cream text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save Duty →'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-charcoal/15 text-sm text-charcoal/60 hover:text-charcoal hover:border-charcoal/30 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function TemplateRow({ template, onDelete }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-xl border border-charcoal/10 bg-charcoal/2 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-sm font-medium text-charcoal truncate">{template.title}</span>
          <span className="text-[11px] text-charcoal/35 shrink-0">{template.items.length} task{template.items.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onDelete(template) }}
            className="text-[11px] text-danger/40 hover:text-danger transition-colors px-2 py-1"
          >
            Remove
          </button>
          <svg
            className={`w-4 h-4 text-charcoal/30 transition-transform ${expanded ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </div>
      </button>

      {expanded && template.items.length > 0 && (
        <div className="border-t border-charcoal/8 px-3 py-2.5 flex flex-col gap-1.5">
          {template.items.map((item, i) => (
            <div key={item.id} className="flex items-center gap-2 text-sm text-charcoal/60">
              <span className="text-[11px] text-charcoal/25 font-mono w-4 shrink-0">{i + 1}.</span>
              {item.title}
            </div>
          ))}
        </div>
      )}

      {expanded && template.items.length === 0 && (
        <p className="border-t border-charcoal/8 px-3 py-2.5 text-sm text-charcoal/30 italic">No tasks added</p>
      )}
    </div>
  )
}

export default function DutiesSection() {
  const toast = useToast()
  const { templates, loading, addTemplate, deleteTemplate } = useDutyTemplates()
  const [adding, setAdding] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const handleSave = async (title, items) => {
    const { error } = await addTemplate(title, items)
    if (error) { toast(error.message, 'error'); return }
    setAdding(false)
    toast('Duty created')
  }

  const confirmDelete = async () => {
    const { error } = await deleteTemplate(deleteTarget.id)
    setDeleteTarget(null)
    if (error) toast(error.message, 'error')
    else toast('Duty removed')
  }

  if (loading) return <div className="py-4 text-center text-sm text-charcoal/30">Loading…</div>

  return (
    <div className="flex flex-col gap-4">
      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove duty?"
        message={`Remove "${deleteTarget?.title}"? Any existing shift assignments will also be removed.`}
        confirmLabel="Remove"
        danger
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />

      <p className="text-xs text-charcoal/45">
        Create named duty templates with a checklist of tasks. Assign them to staff when building the rota — staff see their duties on the dashboard when they log in.
      </p>

      {templates.length > 0 && (
        <div className="flex flex-col gap-2">
          {templates.map(t => (
            <TemplateRow key={t.id} template={t} onDelete={setDeleteTarget} />
          ))}
        </div>
      )}

      {templates.length === 0 && !adding && (
        <p className="text-sm text-charcoal/30 italic">No duties yet — create your first one below.</p>
      )}

      {adding ? (
        <NewDutyForm onSave={handleSave} onCancel={() => setAdding(false)} />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="self-start px-4 py-2.5 rounded-xl bg-charcoal text-cream text-sm font-medium hover:bg-charcoal/90 transition-colors"
        >
          + New Duty
        </button>
      )}
    </div>
  )
}
