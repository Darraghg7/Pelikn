import React, { useEffect, useState } from 'react'
import { WIDGET_REGISTRY, ALL_WIDGET_IDS } from '../../components/widgets/WidgetRegistry'
import Modal from '../../components/ui/Modal'
import { TODAY_ITEM_REGISTRY, ALL_TODAY_ITEM_IDS } from './todayItemRegistry'

export default function WidgetPicker({ open, onClose, activeIds, todayIds, onSave, onSaveToday }) {
  const [selected, setSelected] = useState([])
  const [selectedToday, setSelectedToday] = useState([])

  useEffect(() => {
    if (open) setSelected([...activeIds])
  }, [open, activeIds])

  useEffect(() => {
    if (open) setSelectedToday([...todayIds])
  }, [open, todayIds])

  const toggleWidget = (id) => {
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
    )
  }

  const toggleToday = (id) => {
    setSelectedToday(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
    )
  }

  const moveTodayUp = (id) => {
    setSelectedToday(prev => {
      const idx = prev.indexOf(id)
      if (idx <= 0) return prev
      const next = [...prev]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next
    })
  }

  const moveTodayDown = (id) => {
    setSelectedToday(prev => {
      const idx = prev.indexOf(id)
      if (idx < 0 || idx >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next
    })
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
          Choose what appears in your personal Today view and dashboard widgets.
        </p>

        <div>
          <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-2">Today view</p>
          <div className="flex flex-col gap-1.5">
            {selectedToday.map((id, idx) => {
              const item = TODAY_ITEM_REGISTRY[id]
              if (!item) return null
              return (
                <div key={id} className="flex items-center gap-2 bg-charcoal/4 rounded-xl px-3 py-2.5">
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveTodayUp(id)}
                      disabled={idx === 0}
                      className="text-charcoal/30 hover:text-charcoal disabled:opacity-20 text-sm leading-none p-1.5"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveTodayDown(id)}
                      disabled={idx === selectedToday.length - 1}
                      className="text-charcoal/30 hover:text-charcoal disabled:opacity-20 text-sm leading-none p-1.5"
                    >
                      ▼
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-charcoal truncate">{item.label}</p>
                    <p className="text-[11px] text-charcoal/40 truncate">{item.description}</p>
                  </div>
                  <button
                    onClick={() => toggleToday(id)}
                    className="text-danger/50 hover:text-danger text-xs px-2 py-1 shrink-0"
                  >
                    Remove
                  </button>
                </div>
              )
            })}
          </div>
          {ALL_TODAY_ITEM_IDS.filter(id => !selectedToday.includes(id)).length > 0 && (
            <div className="flex flex-col gap-1.5 mt-2">
              {ALL_TODAY_ITEM_IDS.filter(id => !selectedToday.includes(id)).map(id => {
                const item = TODAY_ITEM_REGISTRY[id]
                return (
                  <button
                    key={id}
                    onClick={() => toggleToday(id)}
                    className="flex items-center gap-3 rounded-xl border border-dashed border-charcoal/15 px-3 py-2.5 hover:border-charcoal/30 hover:bg-charcoal/3 transition-all text-left"
                  >
                    <span className="text-charcoal/20 text-lg shrink-0">+</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-charcoal/60 truncate">{item.label}</p>
                      <p className="text-[11px] text-charcoal/35 truncate">{item.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

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
                        className="text-charcoal/30 hover:text-charcoal disabled:opacity-20 text-sm leading-none p-1.5"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveDown(id)}
                        disabled={idx === selected.length - 1}
                        className="text-charcoal/30 hover:text-charcoal disabled:opacity-20 text-sm leading-none p-1.5"
                      >
                        ▼
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-charcoal truncate">{w.label}</p>
                      <p className="text-[11px] text-charcoal/40 truncate">{w.description}</p>
                    </div>
                    <button
                      onClick={() => toggleWidget(id)}
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
                      onClick={() => toggleWidget(id)}
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
            onClick={() => { onSave(selected); onSaveToday(selectedToday); onClose() }}
            className="flex-1 bg-charcoal text-cream py-2.5 rounded-xl text-sm font-medium hover:bg-charcoal/90 transition-colors"
          >
            Save Customisation
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
