import React, { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useFoodItems } from '../../hooks/useFoodItems'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import { SkeletonList } from '../../components/ui/Skeleton'
import { useVenueBranding } from '../../hooks/useVenueBranding'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Toggle from '../../components/ui/Toggle'

function SectionLabel({ children, action }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="text-[11px] tracking-widest uppercase text-charcoal/40">{children}</p>
      {action}
    </div>
  )
}

export default function AllergenRegistryPage() {
  const [search, setSearch] = useState('')
  const { items, loading, reload } = useFoodItems(search, { includeInactive: true })
  const { venueId, venueSlug, venueName } = useVenue()
  const { isManager } = useSession()
  const toast                     = useToast()
  const [deleting, setDeleting]     = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showQR, setShowQR]         = useState(false)
  const qrRef                     = useRef(null)
  const { logoUrl }               = useVenueBranding(venueId)

  const publicUrl = `${window.location.origin}/allergens/${venueSlug}`

  const downloadQR = () => {
    const canvas = qrRef.current?.querySelector('canvas')
    if (!canvas) return
    const link = document.createElement('a')
    link.download = 'allergen-qr.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const printCard = () => {
    const win = window.open('', '_blank', 'width=420,height=560')
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="Logo" style="height:56px;width:auto;object-fit:contain;display:block;margin:0 auto 16px;" />`
      : ''
    const canvas = qrRef.current?.querySelector('canvas')
    const qrDataUrl = canvas?.toDataURL('image/png') ?? ''
    win.document.write(`<!DOCTYPE html><html><head><title>Allergen QR</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:system-ui,sans-serif;background:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh}
        .card{text-align:center;padding:40px 36px;border:1px solid #e0ddd8;border-radius:16px;max-width:320px;width:100%}
        .venue{font-size:1.1rem;font-weight:700;color:#1a2e2a;margin-bottom:4px}
        .sub{font-size:.72rem;color:#888;letter-spacing:.08em;text-transform:uppercase;margin-bottom:24px}
        .qr{margin:0 auto 20px}
        .cta{font-size:.75rem;color:#555;line-height:1.6}
        .cta strong{display:block;font-size:.85rem;color:#1a2e2a;margin-bottom:4px}
        .badge{font-size:.6rem;color:#bbb;margin-top:20px;letter-spacing:.06em}
        @media print{body{min-height:auto}.card{border:none;padding:20px}}
      </style></head><body>
      <div class="card">
        ${logoHtml}
        <div class="venue">${venueName || 'Allergen Information'}</div>
        <div class="sub">Allergen Information</div>
        <div class="qr"><img src="${qrDataUrl}" width="180" height="180" /></div>
        <div class="cta"><strong>Scan to view allergens</strong>Updated in real-time. Ask staff if you have any dietary requirements.</div>
        <div class="badge">Powered by Pelikn</div>
      </div>
      <script>window.onload=()=>{window.print()}<\/script>
      </body></html>`)
    win.document.close()
  }

  const confirmDelete = async () => {
    setDeleting(deleteTarget.id)
    const { error } = await supabase.from('food_items').update({ is_active: false }).eq('id', deleteTarget.id).eq('venue_id', venueId)
    setDeleting(null)
    setDeleteTarget(null)
    if (error) { toast(error.message, 'error'); return }
    toast('Item removed')
    reload()
  }

  const toggleItemActive = async (item) => {
    const nextActive = !item.is_active
    const { error } = await supabase
      .from('food_items')
      .update({ is_active: nextActive })
      .eq('id', item.id)
      .eq('venue_id', venueId)
    if (error) { toast(error.message, 'error'); return }
    toast(nextActive ? 'Item shown on QR menu' : 'Item hidden from QR menu')
    reload()
  }

  return (
    <div className="flex flex-col gap-6">

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-charcoal">Allergen Checklists</h1>
        <input
          type="search"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 w-full sm:w-48"
        />
      </div>

      {/* QR code panel — manager only */}
      {isManager && venueSlug && (
        <div className="bg-white rounded-2xl border-charcoal/10 px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] tracking-widest uppercase text-charcoal/40">Customer Allergen QR Code</p>
              <p className="text-xs text-charcoal/45 mt-0.5">Customers can scan this to see your live allergen matrix — no login required.</p>
            </div>
            <button
              onClick={() => setShowQR(v => !v)}
              className="text-xs px-3 py-1.5 rounded-lg border border-charcoal/15 text-charcoal/55 hover:text-charcoal hover:border-charcoal/30 transition-colors shrink-0 ml-4"
            >
              {showQR ? 'Hide QR' : 'Show QR'}
            </button>
          </div>
          {showQR && (
            <div className="mt-4 flex flex-col sm:flex-row items-start gap-5">
              <div ref={qrRef} className="p-3 bg-white rounded-2xl border-charcoal/10 shadow-sm shrink-0">
                <QRCodeCanvas value={publicUrl} size={140} />
              </div>
              <div className="flex flex-col gap-2 min-w-0 flex-1">
                <p className="text-[11px] tracking-widest uppercase text-charcoal/35">Public URL</p>
                <p className="text-xs font-mono text-charcoal/60 break-all bg-charcoal/4 px-3 py-2 rounded-lg">{publicUrl}</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  <button
                    onClick={() => { navigator.clipboard.writeText(publicUrl); toast('URL copied') }}
                    className="text-xs px-3 py-1.5 rounded-lg border border-charcoal/15 text-charcoal/55 hover:text-charcoal hover:border-charcoal/30 transition-colors"
                  >
                    Copy URL
                  </button>
                  <button
                    onClick={downloadQR}
                    className="text-xs px-3 py-1.5 rounded-lg border border-charcoal/15 text-charcoal/55 hover:text-charcoal hover:border-charcoal/30 transition-colors"
                  >
                    Download PNG
                  </button>
                  <button
                    onClick={printCard}
                    className="text-xs px-3 py-1.5 rounded-lg bg-brand text-cream hover:bg-brand/90 transition-colors"
                  >
                    Print Table Card
                  </button>
                </div>
                <p className="text-[11px] text-charcoal/35 mt-1">
                  <strong className="text-charcoal/50">Print Table Card</strong> opens a ready-to-print card with your venue logo, QR code and instructions — place on tables or counters.
                  {!logoUrl && <span className="block mt-0.5 text-accent/70">Add your logo in Settings to include it on the card.</span>}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border-charcoal/10 overflow-hidden">
        <div className="px-5 pt-5">
          <SectionLabel
            action={
              isManager && (
                <Link
                  to={`/v/${venueSlug}/allergens/new`}
                  className="bg-charcoal text-cream px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-charcoal/90 transition-colors"
                >
                  + Add Dish
                </Link>
              )
            }
          >
            Menu Items
          </SectionLabel>
        </div>

        {loading ? (
          <SkeletonList rows={5} className="py-4" />
        ) : items.length === 0 ? (
          <EmptyState
            icon={search ? 'search' : 'utensils'}
            title={search ? 'No results' : 'No menu items yet'}
            description={search ? 'No items match your search. Try a different term.' : 'Add your first dish to start tracking allergens.'}
          />
        ) : (
          <div className="flex flex-col">
            {items.map((item) => {
              const allergens = item.food_allergens?.map((a) => a.allergen) ?? []
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-4 px-5 py-3.5 border-t border-charcoal/6 hover:bg-white transition-colors"
                >
                  {/* Icon placeholder */}
                  <div className="w-7 h-7 rounded-md bg-charcoal/8 flex items-center justify-center shrink-0 text-charcoal/40">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className={`font-medium text-sm truncate ${item.is_active ? 'text-charcoal' : 'text-charcoal/35'}`}>{item.name}</p>
                      {!item.is_active && (
                        <span className="text-[10px] uppercase tracking-widest text-charcoal/30 border border-charcoal/10 rounded-full px-1.5 py-0.5 shrink-0">Off QR</span>
                      )}
                    </div>
                    <p className="text-xs text-charcoal/40 truncate mt-0.5">
                      {allergens.length === 0
                        ? 'No allergens'
                        : allergens.join(', ')}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap">
                    {isManager && (
                      <div className="flex items-center gap-1.5 pr-1">
                        <span className="text-[11px] text-charcoal/35">QR</span>
                        <Toggle
                          checked={item.is_active}
                          onChange={() => toggleItemActive(item)}
                          size="sm"
                        />
                      </div>
                    )}
                    <Link
                      to={`/v/${venueSlug}/allergens/${item.id}`}
                      className="text-xs text-charcoal/50 hover:text-charcoal border border-charcoal/15 px-3 py-1.5 rounded-md hover:border-charcoal/30 transition-colors"
                    >
                      View
                    </Link>
                    {isManager && (
                      <>
                        <Link
                          to={`/v/${venueSlug}/allergens/${item.id}/edit`}
                          className="text-xs text-charcoal/50 hover:text-charcoal border border-charcoal/15 px-3 py-1.5 rounded-md hover:border-charcoal/30 transition-colors"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => setDeleteTarget({ id: item.id, name: item.name })}
                          disabled={deleting === item.id}
                          className="text-xs text-charcoal/35 hover:text-danger border border-charcoal/12 px-2.5 py-1.5 rounded-md hover:border-danger/30 transition-colors"
                        >
                          ×
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove item?"
        message={`Remove "${deleteTarget?.name}" from the allergen registry?`}
        confirmLabel="Remove"
        danger
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}
