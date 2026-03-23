import React, { useState, useEffect } from 'react'
import { format, subDays } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const HACCP_POINTS = [
  {
    id: 'receiving',
    label: 'Receiving',
    default: `All deliveries are inspected on arrival for correct temperature, condition, and labelling. Chilled items must be ≤8°C and frozen items ≤-18°C. Rejected deliveries are documented. Delivery records are retained for a minimum of 3 months.`,
  },
  {
    id: 'storage',
    label: 'Storage',
    default: `Raw and ready-to-eat foods are stored separately. Fridge temperatures are maintained at 1–5°C and checked daily. Freezer temperatures are maintained at -18°C or below. Foods are stored off the floor, covered, and labelled with use-by dates. FIFO (first in, first out) rotation is applied.`,
  },
  {
    id: 'cooking',
    label: 'Cooking',
    default: `Core temperatures are checked with a calibrated probe thermometer. All poultry and pork must reach 75°C for at least 2 minutes. Cooking temperature records are completed for each service. Probe thermometers are cleaned and sanitised between uses.`,
  },
  {
    id: 'cooling',
    label: 'Cooling',
    default: `Cooked food must be cooled from 70°C to below 8°C within 90 minutes. Blast chiller or ice bath is used where required. Cooling logs are completed. Food is not left to cool at room temperature for extended periods.`,
  },
  {
    id: 'service',
    label: 'Service',
    default: `Hot foods are held at a minimum of 63°C during service. Cold foods are kept at or below 8°C. Foods are covered when not in use. Allergen information is available for all menu items. Staff are trained in allergen awareness and cross-contamination prevention.`,
  },
]

function useHACCPData(venueId, venueName) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    if (!venueId) return
    setLoading(true)

    const thirtyDaysAgo = subDays(new Date(), 30).toISOString()

    const [fridge, cooking, cleaning, deliveries, allergens, probes] = await Promise.all([
      supabase.from('fridge_temperature_logs').select('id', { count: 'exact', head: true })
        .eq('venue_id', venueId).gte('logged_at', thirtyDaysAgo),
      supabase.from('cooking_temp_logs').select('id', { count: 'exact', head: true })
        .eq('venue_id', venueId).gte('logged_at', thirtyDaysAgo),
      supabase.from('cleaning_completions').select('id', { count: 'exact', head: true })
        .eq('venue_id', venueId).gte('completed_at', thirtyDaysAgo),
      supabase.from('delivery_checks').select('id', { count: 'exact', head: true })
        .eq('venue_id', venueId).gte('checked_at', thirtyDaysAgo),
      supabase.from('food_items').select('id', { count: 'exact', head: true })
        .eq('venue_id', venueId),
      supabase.from('probe_calibrations').select('id', { count: 'exact', head: true })
        .eq('venue_id', venueId).gte('calibrated_at', thirtyDaysAgo),
    ])

    setData({
      venueName,
      generatedAt: new Date(),
      fridgeCount:    fridge.count   ?? 0,
      cookingCount:   cooking.count  ?? 0,
      cleaningCount:  cleaning.count ?? 0,
      deliveryCount:  deliveries.count ?? 0,
      allergenCount:  allergens.count  ?? 0,
      probeCount:     probes.count     ?? 0,
    })
    setLoading(false)
  }

  return { data, loading, load }
}

function HACCPDocument({ data, hazardPoints }) {
  const compliance = [
    { label: 'Fridge Temperature Logs',  count: data.fridgeCount,   ok: data.fridgeCount > 0 },
    { label: 'Cooking Temperature Logs', count: data.cookingCount,  ok: data.cookingCount > 0 },
    { label: 'Cleaning Completions',     count: data.cleaningCount, ok: data.cleaningCount > 0 },
    { label: 'Delivery Checks',          count: data.deliveryCount, ok: data.deliveryCount > 0 },
    { label: 'Allergen Registry',        count: data.allergenCount, ok: data.allergenCount > 0 },
    { label: 'Probe Calibrations',       count: data.probeCount,    ok: data.probeCount > 0 },
  ]

  return (
    <div id="haccp-print-doc" className="font-sans text-sm text-charcoal leading-relaxed">
      {/* Header */}
      <div className="border-b-2 border-charcoal pb-4 mb-6">
        <h1 className="font-serif text-2xl text-brand font-bold">HACCP Summary Report</h1>
        <p className="text-charcoal/60 mt-1">{data.venueName || 'Venue'}</p>
        <p className="text-charcoal/50 text-xs mt-0.5">
          Generated: {format(data.generatedAt, 'd MMMM yyyy, HH:mm')} &nbsp;·&nbsp;
          Period: Last 30 days
        </p>
      </div>

      {/* Compliance overview */}
      <section className="mb-8">
        <h2 className="font-semibold text-base text-charcoal mb-3 border-b border-charcoal/15 pb-1">
          Compliance Overview
        </h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-charcoal/5">
              <th className="text-left p-2 font-medium text-charcoal/60">Category</th>
              <th className="text-right p-2 font-medium text-charcoal/60">Records (30 days)</th>
              <th className="text-center p-2 font-medium text-charcoal/60">Status</th>
            </tr>
          </thead>
          <tbody>
            {compliance.map((c) => (
              <tr key={c.label} className="border-t border-charcoal/8">
                <td className="p-2">{c.label}</td>
                <td className="p-2 text-right font-mono">{c.count}</td>
                <td className="p-2 text-center">
                  {c.ok ? (
                    <span className="text-green-700 font-semibold">✓ Records exist</span>
                  ) : (
                    <span className="text-red-600 font-semibold">✗ No records</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Hazard control points */}
      <section className="mb-6">
        <h2 className="font-semibold text-base text-charcoal mb-3 border-b border-charcoal/15 pb-1">
          Hazard Control Points
        </h2>
        <p className="text-xs text-charcoal/40 mb-4">
          Review and amend each section below as appropriate for your premises.
        </p>
        {HACCP_POINTS.map((pt) => (
          <div key={pt.id} className="mb-6">
            <h3 className="font-semibold text-charcoal text-sm mb-2 uppercase tracking-wide">
              {pt.label}
            </h3>
            <div
              contentEditable
              suppressContentEditableWarning
              className="border border-charcoal/15 rounded-lg p-3 min-h-[80px] text-sm text-charcoal/80 leading-relaxed outline-none focus:ring-2 focus:ring-charcoal/20"
              style={{ whiteSpace: 'pre-wrap' }}
              dangerouslySetInnerHTML={{ __html: hazardPoints[pt.id] || pt.default }}
            />
          </div>
        ))}
      </section>

      {/* Signature block */}
      <section className="border-t border-charcoal/15 pt-4 mt-6">
        <div className="grid grid-cols-3 gap-8">
          <div>
            <p className="text-xs text-charcoal/50 mb-6">Manager signature</p>
            <div className="border-b border-charcoal/30 h-8" />
          </div>
          <div>
            <p className="text-xs text-charcoal/50 mb-6">Print name</p>
            <div className="border-b border-charcoal/30 h-8" />
          </div>
          <div>
            <p className="text-xs text-charcoal/50 mb-6">Date</p>
            <div className="border-b border-charcoal/30 h-8" />
          </div>
        </div>
      </section>
    </div>
  )
}

export default function HACCPPage() {
  const { venueId, venueName } = useVenue()
  const { data, loading, load } = useHACCPData(venueId, venueName)
  const [showDoc, setShowDoc] = useState(false)
  const [hazardPoints] = useState({})

  const handleGenerate = async () => {
    await load()
    setShowDoc(true)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <>
      {/* Print styles — hides everything except the document */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #haccp-print-root { display: block !important; }
          #haccp-print-doc { display: block !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl text-brand">HACCP Generator</h1>
            <p className="text-sm text-charcoal/40 mt-1">
              Generate a printable HACCP summary for your venue
            </p>
          </div>
          {showDoc && (
            <Button variant="primary" onClick={handlePrint}>
              Print / Save PDF
            </Button>
          )}
        </div>

        {!showDoc ? (
          <div className="bg-white rounded-xl border border-charcoal/10 p-8 text-center flex flex-col items-center gap-4">
            <div className="text-4xl">📋</div>
            <div>
              <p className="font-semibold text-charcoal">Generate your HACCP Summary</p>
              <p className="text-sm text-charcoal/50 mt-1 max-w-sm mx-auto">
                Pulls together the last 30 days of compliance records into a printable document you can complete, sign and file.
              </p>
            </div>
            <Button variant="primary" onClick={handleGenerate} disabled={loading}>
              {loading ? 'Loading…' : 'Generate HACCP Summary PDF'}
            </Button>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-10"><LoadingSpinner /></div>
        ) : data ? (
          <>
            {/* Compliance overview cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 no-print">
              {[
                { label: 'Fridge Readings',    count: data.fridgeCount   },
                { label: 'Cooking Temps',      count: data.cookingCount  },
                { label: 'Cleaning Tasks',     count: data.cleaningCount },
                { label: 'Deliveries Checked', count: data.deliveryCount },
                { label: 'Allergen Items',     count: data.allergenCount },
                { label: 'Probe Calibrations', count: data.probeCount    },
              ].map((item) => (
                <div key={item.label} className="bg-white rounded-xl border border-charcoal/10 p-4">
                  <p className="text-2xl font-serif font-semibold text-charcoal">{item.count}</p>
                  <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mt-0.5">{item.label}</p>
                  <p className="text-[10px] text-charcoal/30 mt-0.5">last 30 days</p>
                </div>
              ))}
            </div>

            <div className="no-print flex justify-between items-center">
              <p className="text-sm text-charcoal/50">
                Edit the Hazard Control Points below before printing.
              </p>
              <button
                onClick={() => setShowDoc(false)}
                className="text-xs text-charcoal/30 hover:text-charcoal transition-colors"
              >
                Reset
              </button>
            </div>

            {/* Printable document */}
            <div id="haccp-print-root" className="bg-white rounded-xl border border-charcoal/10 p-6 sm:p-8">
              <HACCPDocument data={data} hazardPoints={hazardPoints} />
            </div>

            <div className="no-print">
              <Button variant="primary" onClick={handlePrint} className="w-full sm:w-auto">
                Print / Save as PDF
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </>
  )
}
