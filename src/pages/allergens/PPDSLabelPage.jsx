import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function PPDSLabelPage() {
  const { id }              = useParams()
  const { venueId, venueSlug, venueName } = useVenue()

  const [item, setItem]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [madeOn, setMadeOn] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [useBy, setUseBy]   = useState('')

  useEffect(() => {
    if (!id || !venueId) return
    supabase
      .from('ppds_items')
      .select('*')
      .eq('id', id)
      .eq('venue_id', venueId)
      .single()
      .then(({ data }) => { setItem(data); setLoading(false) })
  }, [id, venueId])

  if (loading) return <div className="flex justify-center pt-20"><LoadingSpinner size="lg" /></div>
  if (!item)   return <div className="pt-10 text-center text-charcoal/40 text-sm">Item not found.</div>

  const ingredients   = item.ingredients ?? []
  const mayContain    = item.may_contain_allergens ?? []
  const hasAllergens  = ingredients.some(r => r.allergen)

  const formatIngredients = () =>
    ingredients
      .filter(r => r.name?.trim())
      .map(r => ({ name: r.name.trim(), allergen: r.allergen ?? null }))

  const formatDate = (iso) => {
    if (!iso) return ''
    try { return format(new Date(iso), 'd MMM yyyy') } catch { return iso }
  }

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body > *:not(#ppds-print-root) { display: none !important; }
          #ppds-print-root { display: block !important; }
          @page { margin: 10mm; size: A6 portrait; }
          #ppds-screen-controls { display: none !important; }
        }
      `}</style>

      <div id="ppds-print-root">

        {/* ── Screen controls (hidden on print) ── */}
        <div id="ppds-screen-controls" className="flex flex-col gap-6 max-w-md">
          <div className="flex items-center gap-4">
            <Link to={`/v/${venueSlug}/allergens/ppds`} className="text-charcoal/40 hover:text-charcoal transition-colors text-lg">←</Link>
            <div>
              <h1 className="text-xl font-bold text-charcoal">Print Label</h1>
              <p className="text-xs text-charcoal/40 mt-0.5">Natasha's Law compliant — PPDS label</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border-charcoal/10 p-5 flex flex-col gap-4">
            <p className="text-[11px] tracking-widest uppercase text-charcoal/40">Label dates</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] tracking-widest uppercase text-charcoal/30">Made on</label>
                <input
                  type="date"
                  value={madeOn}
                  onChange={e => setMadeOn(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] tracking-widest uppercase text-charcoal/30">Use by</label>
                <input
                  type="date"
                  value={useBy}
                  onChange={e => setUseBy(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
                />
              </div>
            </div>
          </div>

          {/* Label preview */}
          <div className="bg-white rounded-2xl border-charcoal/10 p-5">
            <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-4">Label preview</p>
            <LabelContent
              item={item}
              venueName={venueName}
              madeOn={madeOn}
              useBy={useBy}
              formatIngredients={formatIngredients}
              formatDate={formatDate}
              mayContain={mayContain}
              hasAllergens={hasAllergens}
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-xs text-amber-800 leading-relaxed">
              <strong>Natasha's Law:</strong> This label complies with PPDS regulations (Food Information (Amendment) (England) Regulations 2021). Allergens are shown in <strong>bold and underlined</strong>. The label must be affixed to the packaging before the item is offered for sale.
            </p>
          </div>

          <button
            onClick={() => window.print()}
            className="w-full bg-charcoal text-cream py-3 rounded-xl text-sm font-semibold hover:bg-charcoal/90 transition-colors"
          >
            Print Label →
          </button>
        </div>

        {/* ── Printable label (always in DOM, shown on print) ── */}
        <div
          id="ppds-print-label"
          style={{
            display: 'none',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: '9pt',
            color: '#000',
            border: '1px solid #000',
            padding: '6mm',
            maxWidth: '74mm',
            lineHeight: '1.4',
          }}
        >
          {/* Shown only on print via CSS @media print rule below */}
        </div>
      </div>

      {/* Injected print label via @media print — cleaner than show/hide */}
      <style>{`
        @media print {
          #ppds-print-label { display: block !important; margin: 0 auto; }
        }
      `}</style>

      {/* Hidden print-only label */}
      <div
        id="ppds-print-label"
        style={{
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '9pt',
          color: '#000',
          border: '2px solid #000',
          padding: '6mm',
          width: '74mm',
          boxSizing: 'border-box',
          lineHeight: '1.5',
        }}
      >
        <p style={{ fontWeight: 'bold', fontSize: '11pt', marginBottom: '4px' }}>{item.name}</p>
        {item.description && <p style={{ fontSize: '8pt', color: '#444', marginBottom: '4px' }}>{item.description}</p>}
        <p style={{ fontWeight: 'bold', fontSize: '8pt', marginBottom: '2px', borderTop: '1px solid #000', paddingTop: '4px' }}>
          Prepared by {venueName}
        </p>

        <p style={{ marginBottom: '4px', marginTop: '6px' }}>
          <strong>INGREDIENTS: </strong>
          {formatIngredients().map((r, i, arr) => (
            <React.Fragment key={i}>
              {r.allergen
                ? <strong style={{ textDecoration: 'underline' }}>{r.name}</strong>
                : <span>{r.name}</span>
              }
              {i < arr.length - 1 ? ', ' : '.'}
            </React.Fragment>
          ))}
        </p>

        {mayContain.length > 0 && (
          <p style={{ marginBottom: '4px' }}>
            <strong>May contain: </strong>{mayContain.join(', ')}.
          </p>
        )}

        {hasAllergens && (
          <p style={{ fontSize: '7.5pt', color: '#333', borderTop: '1px solid #ccc', paddingTop: '3px', marginTop: '4px' }}>
            Allergens shown in <strong><u>bold and underlined</u></strong>.
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', paddingTop: '4px', borderTop: '1px solid #000', fontSize: '8.5pt' }}>
          <span><strong>Made on:</strong> {formatDate(madeOn) || '___________'}</span>
          <span><strong>Use by:</strong> {formatDate(useBy) || '___________'}</span>
        </div>
      </div>
    </>
  )
}

// ── Screen preview component ──────────────────────────────────────────────────

function LabelContent({ item, venueName, madeOn, useBy, formatIngredients, formatDate, mayContain, hasAllergens }) {
  return (
    <div
      style={{
        fontFamily: 'Arial, Helvetica, sans-serif',
        border: '2px solid #1a1a1a',
        borderRadius: '4px',
        padding: '12px',
        fontSize: '11px',
        lineHeight: '1.6',
        color: '#000',
        background: '#fff',
        maxWidth: '300px',
      }}
    >
      <p style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '2px' }}>{item.name || 'Product Name'}</p>
      {item.description && <p style={{ fontSize: '10px', color: '#555', marginBottom: '4px' }}>{item.description}</p>}
      <p style={{ fontWeight: 'bold', fontSize: '10px', borderTop: '1px solid #000', paddingTop: '5px', marginBottom: '6px' }}>
        Prepared by {venueName}
      </p>

      <p style={{ marginBottom: '5px' }}>
        <strong>INGREDIENTS: </strong>
        {formatIngredients().length === 0
          ? <span style={{ color: '#999', fontStyle: 'italic' }}>Add ingredients above…</span>
          : formatIngredients().map((r, i, arr) => (
            <React.Fragment key={i}>
              {r.allergen
                ? <strong style={{ textDecoration: 'underline' }}>{r.name}</strong>
                : <span>{r.name}</span>
              }
              {i < arr.length - 1 ? ', ' : '.'}
            </React.Fragment>
          ))
        }
      </p>

      {mayContain.length > 0 && (
        <p style={{ marginBottom: '5px' }}>
          <strong>May contain: </strong>{mayContain.join(', ')}.
        </p>
      )}

      {hasAllergens && (
        <p style={{ fontSize: '9px', color: '#555', borderTop: '1px solid #ccc', paddingTop: '3px', marginTop: '4px' }}>
          Allergens shown in <strong><u>bold and underlined</u></strong>.
        </p>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '5px', borderTop: '1px solid #000', fontSize: '11px' }}>
        <span><strong>Made on:</strong> {madeOn ? formatDate(madeOn) : '— '}</span>
        <span><strong>Use by:</strong> {useBy ? formatDate(useBy) : '—'}</span>
      </div>
    </div>
  )
}
