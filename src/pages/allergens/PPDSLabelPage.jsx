import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams, Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { usePPDSItem } from '../../hooks/usePPDSItems'
import { useVenue } from '../../contexts/VenueContext'
import { PageSkeleton } from '../../components/ui/Skeleton'
import LoadError from '../../components/ui/LoadError'
import Button from '../../components/ui/Button'
import PPDSIngredients from '../../components/allergens/PPDSIngredients'
import { recipeAllergens } from '../../lib/ppdsLabel'
import { colors, radius } from '../../lib/tokens'

// The printed label is rendered straight into <body> (a portal), next to the
// app rather than inside it. Printing hides every other child of <body>; with
// the label inside the app's #root, that hid the label too and every print
// came out blank.
const PRINT_CSS = `
  #ppds-print-root { display: none; }
  @media print {
    body > *:not(#ppds-print-root) { display: none !important; }
    #ppds-print-root { display: block !important; }
    @page { margin: 10mm; size: A6 portrait; }
  }
`

const formatDate = (iso) => {
  if (!iso) return ''
  try { return format(parseISO(iso), 'd MMM yyyy') } catch { return iso }
}

export default function PPDSLabelPage() {
  const { id }              = useParams()
  const { venueSlug, venueName } = useVenue()

  const [madeOn, setMadeOn] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [useBy, setUseBy]   = useState('')
  const { item, loading, failed, reload } = usePPDSItem(id)

  if (loading) return <PageSkeleton />
  if (failed)  return <LoadError what="this item" onRetry={reload} />
  if (!item)   return <div className="pt-10 text-center text-charcoal/40 dark:text-white/35 text-sm">Item not found.</div>

  const labelProps = { item, venueName, madeOn, useBy }

  return (
    <>
      <style>{PRINT_CSS}</style>

      <div className="flex flex-col gap-6 max-w-md">
        <div className="flex items-center gap-4">
          <Link to={`/v/${venueSlug}/allergens/ppds`} className="text-charcoal/40 dark:text-white/35 hover:text-charcoal dark:hover:text-white transition-colors text-lg">←</Link>
          <div>
            <h1 className="text-xl font-bold text-charcoal dark:text-white">Print Label</h1>
            <p className="text-xs text-charcoal/40 dark:text-white/35 mt-0.5">Natasha's Law compliant — PPDS label</p>
          </div>
        </div>

        <div className="bg-white dark:bg-paperDark rounded-card border-charcoal/10 dark:border-white/10 p-5 flex flex-col gap-4">
          <p className="text-micro tracking-widest uppercase text-charcoal/40 dark:text-white/35">Label dates</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-micro tracking-widest uppercase text-charcoal/30 dark:text-white/30">Made on</label>
              <input aria-label="Made on"
                type="date"
                value={madeOn}
                onChange={e => setMadeOn(e.target.value)}
                className="px-3 py-2 rounded-control border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-micro tracking-widest uppercase text-charcoal/30 dark:text-white/30">Use by</label>
              <input aria-label="Use by"
                type="date"
                value={useBy}
                onChange={e => setUseBy(e.target.value)}
                className="px-3 py-2 rounded-control border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-paperDark rounded-card border-charcoal/10 dark:border-white/10 p-5">
          <p className="text-micro tracking-widest uppercase text-charcoal/40 dark:text-white/35 mb-4">Label preview</p>
          <Label {...labelProps} variant="screen" />
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-control px-4 py-3">
          <p className="text-xs text-amber-800 leading-relaxed">
            <strong>Natasha's Law:</strong> Each allergen is named on the label and shown in <strong>bold and underlined</strong>. The label must be affixed to the packaging before the item is offered for sale.
          </p>
        </div>

        <Button fullWidth onClick={() => window.print()}>
          Print Label →
        </Button>
      </div>

      {createPortal(
        <div id="ppds-print-root">
          <Label {...labelProps} variant="print" />
        </div>,
        document.body,
      )}
    </>
  )
}

// ── The label itself (preview and print share it) ─────────────────────────────

const SIZES = {
  screen: { title: '14px', body: '11px', small: '10px', note: '9px', border: `2px solid ${colors.charcoal}`, width: '300px', padding: '12px' },
  print:  { title: '11pt', body: '9pt',  small: '8pt',  note: '7.5pt', border: `2px solid ${colors.print.ink}`, width: '74mm', padding: '6mm' },
}

function Label({ item, venueName, madeOn, useBy, variant }) {
  const s = SIZES[variant]
  const mayContain   = item.may_contain_allergens ?? []
  const hasAllergens = recipeAllergens(item.ingredients).length > 0
  return (
    <div
      style={{
        fontFamily: 'Arial, Helvetica, sans-serif',
        border: s.border,
        borderRadius: variant === 'screen' ? radius.tag : 0,
        padding: s.padding,
        fontSize: s.body,
        lineHeight: '1.5',
        color: colors.print.ink,
        background: colors.paper,
        width: variant === 'print' ? s.width : undefined,
        maxWidth: s.width,
        boxSizing: 'border-box',
        margin: variant === 'print' ? '0 auto' : undefined,
      }}
    >
      <p style={{ fontWeight: 'bold', fontSize: s.title, marginBottom: '2px' }}>{item.name || 'Product Name'}</p>
      {item.description && <p style={{ fontSize: s.small, color: colors.print.muted, marginBottom: '4px' }}>{item.description}</p>}
      <p style={{ fontWeight: 'bold', fontSize: s.small, borderTop: `1px solid ${colors.print.ink}`, paddingTop: '4px', marginBottom: '6px' }}>
        Prepared by {venueName}
      </p>

      <p style={{ marginBottom: '5px' }}>
        <strong>INGREDIENTS: </strong>
        <PPDSIngredients
          rows={item.ingredients}
          empty={<span style={{ color: colors.print.muted, fontStyle: 'italic' }}>No ingredients added.</span>}
        />
      </p>

      {mayContain.length > 0 && (
        <p style={{ marginBottom: '5px' }}>
          <strong>May contain: </strong>{mayContain.join(', ')}.
        </p>
      )}

      {hasAllergens && (
        <p style={{ fontSize: s.note, color: colors.print.ink, borderTop: `1px solid ${colors.print.rule}`, paddingTop: '3px', marginTop: '4px' }}>
          Allergens shown in <strong><u>bold and underlined</u></strong>.
        </p>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', paddingTop: '4px', borderTop: `1px solid ${colors.print.ink}`, fontSize: s.body }}>
        <span><strong>Made on:</strong> {formatDate(madeOn) || '___________'}</span>
        <span><strong>Use by:</strong> {formatDate(useBy) || '___________'}</span>
      </div>
    </div>
  )
}
