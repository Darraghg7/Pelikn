import React, { useState } from 'react'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useSuppliers, useSupplierOrders } from '../../hooks/useSupplierOrders'
import { useToast } from '../../components/ui/Toast'
import Modal from '../../components/ui/Modal'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const STATUS_CONFIG = {
  submitted: { label: 'Pending',  bg: 'bg-warning/10',  text: 'text-warning' },
  ordered:   { label: 'Ordered',  bg: 'bg-blue-50',     text: 'text-blue-600' },
  received:  { label: 'Received', bg: 'bg-success/10',  text: 'text-success' },
  draft:     { label: 'Draft',    bg: 'bg-charcoal/5',  text: 'text-charcoal/40' },
}

const STATUS_ORDER = ['submitted', 'ordered', 'received', 'draft']

function StatusChip({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
  return (
    <span className={`text-[11px] tracking-widest uppercase font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  )
}

function SectionLabel({ children }) {
  return <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-3">{children}</p>
}

export default function SupplierOrdersPage() {
  const toast = useToast()
  const { venueId } = useVenue()
  const { session, isManager } = useSession()
  const { suppliers, loading: suppLoading, reload: reloadSuppliers } = useSuppliers()
  const { orders, loading: ordersLoading, reload: reloadOrders }     = useSupplierOrders()

  // Filter tab
  const [tab, setTab] = useState('all')

  // New order modal
  const [showOrder, setShowOrder] = useState(false)
  const [orderForm, setOrderForm] = useState({ supplier_id: '', notes: '' })
  const [orderItems, setOrderItems] = useState([{ item_name: '', quantity: '', unit: '', notes: '' }])
  const [submittingOrder, setSubmittingOrder] = useState(false)

  // Manage suppliers panel (manager only)
  const [showManage, setShowManage] = useState(false)
  const [supplierForm, setSupplierForm] = useState({ name: '', contact_name: '', email: '', phone: '' })
  const [savingSupplier, setSavingSupplier] = useState(false)

  const openNewOrder = () => {
    setOrderForm({ supplier_id: suppliers[0]?.id ?? '', notes: '' })
    setOrderItems([{ item_name: '', quantity: '', unit: '', notes: '' }])
    setShowOrder(true)
  }

  const addItem = () => setOrderItems(items => [...items, { item_name: '', quantity: '', unit: '', notes: '' }])
  const removeItem = (i) => setOrderItems(items => items.filter((_, idx) => idx !== i))
  const updateItem = (i, field, val) => setOrderItems(items => items.map((it, idx) => idx === i ? { ...it, [field]: val } : it))

  const submitOrder = async () => {
    const validItems = orderItems.filter(it => it.item_name.trim() && it.quantity.trim())
    if (!orderForm.supplier_id) { toast('Select a supplier', 'error'); return }
    if (!validItems.length)     { toast('Add at least one item', 'error'); return }

    setSubmittingOrder(true)
    const supplier = suppliers.find(s => s.id === orderForm.supplier_id)

    const { data: order, error: orderErr } = await supabase
      .from('supplier_orders')
      .insert({
        supplier_id:    orderForm.supplier_id,
        supplier_name:  supplier?.name ?? '',
        status:         'submitted',
        notes:          orderForm.notes.trim() || null,
        raised_by:      session?.staffId,
        raised_by_name: session?.staffName ?? 'Unknown',
        venue_id:       venueId,
      })
      .select()
      .single()

    if (orderErr) { toast(orderErr.message, 'error'); setSubmittingOrder(false); return }

    const { error: itemsErr } = await supabase
      .from('supplier_order_items')
      .insert(validItems.map(it => ({
        order_id:  order.id,
        item_name: it.item_name.trim(),
        quantity:  it.quantity.trim(),
        unit:      it.unit.trim() || null,
        notes:     it.notes.trim() || null,
        venue_id:  venueId,
      })))

    setSubmittingOrder(false)
    if (itemsErr) { toast(itemsErr.message, 'error'); return }

    toast('Order submitted')
    setShowOrder(false)
    reloadOrders()
  }

  const advanceStatus = async (order) => {
    const next = order.status === 'submitted' ? 'ordered' : order.status === 'ordered' ? 'received' : null
    if (!next) return
    const update = { status: next }
    if (next === 'ordered')  update.ordered_at  = new Date().toISOString()
    if (next === 'received') update.received_at = new Date().toISOString()
    const { error } = await supabase.from('supplier_orders').update(update).eq('id', order.id)
    if (error) { toast(error.message, 'error'); return }
    toast(next === 'ordered' ? 'Marked as ordered' : 'Marked as received')
    reloadOrders()
  }

  const saveSupplier = async () => {
    if (!supplierForm.name.trim()) { toast('Name is required', 'error'); return }
    setSavingSupplier(true)
    const { error } = await supabase.from('suppliers').insert({
      name:         supplierForm.name.trim(),
      contact_name: supplierForm.contact_name.trim() || null,
      email:        supplierForm.email.trim() || null,
      phone:        supplierForm.phone.trim() || null,
      venue_id:     venueId,
    })
    setSavingSupplier(false)
    if (error) { toast(error.message, 'error'); return }
    toast(`${supplierForm.name.trim()} added`)
    setSupplierForm({ name: '', contact_name: '', email: '', phone: '' })
    reloadSuppliers()
  }

  const deactivateSupplier = async (id, name) => {
    await supabase.from('suppliers').update({ is_active: false }).eq('id', id)
    toast(`${name} removed`)
    reloadSuppliers()
  }

  const filteredOrders = tab === 'all'
    ? orders
    : orders.filter(o => o.status === tab)

  if (suppLoading || ordersLoading) return <div className="flex justify-center pt-20"><LoadingSpinner size="lg" /></div>

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl text-brand">Orders</h1>
        <div className="flex items-center gap-3">
          {isManager && (
            <button
              onClick={() => setShowManage(v => !v)}
              className="text-[11px] tracking-widest uppercase text-charcoal/40 hover:text-charcoal transition-colors border-b border-charcoal/20"
            >
              {showManage ? 'Done' : 'Manage Suppliers'}
            </button>
          )}
          <button
            onClick={openNewOrder}
            disabled={!suppliers.length}
            className="bg-charcoal text-cream px-4 py-2 rounded-lg text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-40"
          >
            + New Order
          </button>
        </div>
      </div>

      {/* Manage suppliers */}
      {showManage && isManager && (
        <div className="bg-white rounded-xl border border-charcoal/10 p-5 flex flex-col gap-4">
          <SectionLabel>Manage Suppliers</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {['name', 'contact_name', 'email', 'phone'].map(field => (
              <input key={field}
                value={supplierForm[field]}
                onChange={e => setSupplierForm(f => ({ ...f, [field]: e.target.value }))}
                placeholder={field === 'name' ? 'Supplier name *' : field === 'contact_name' ? 'Contact name' : field}
                className="px-3 py-2.5 rounded-lg border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
            ))}
          </div>
          <button onClick={saveSupplier} disabled={savingSupplier}
            className="self-start bg-charcoal text-cream px-4 py-2 rounded-lg text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-40">
            {savingSupplier ? 'Adding…' : '+ Add Supplier'}
          </button>
          {suppliers.length > 0 && (
            <div className="border-t border-charcoal/8 pt-3 flex flex-col divide-y divide-charcoal/6">
              {suppliers.map(s => (
                <div key={s.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-charcoal">{s.name}</p>
                    {s.contact_name && <p className="text-xs text-charcoal/40">{s.contact_name}{s.email ? ` · ${s.email}` : ''}</p>}
                  </div>
                  <button onClick={() => deactivateSupplier(s.id, s.name)}
                    className="text-xs text-charcoal/25 hover:text-danger transition-colors px-2 py-1">Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {suppliers.length === 0 && !showManage && (
        <div className="bg-white rounded-xl border border-charcoal/10 p-8 text-center">
          <p className="text-charcoal/40 text-sm">No suppliers set up yet.</p>
          {isManager && (
            <button onClick={() => setShowManage(true)}
              className="mt-3 text-xs text-charcoal/50 hover:text-charcoal underline underline-offset-2 transition-colors">
              Add your first supplier →
            </button>
          )}
        </div>
      )}

      {/* Status filter tabs */}
      {orders.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {['all', 'submitted', 'ordered', 'received'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={[
                'px-4 py-1.5 rounded-lg text-xs font-medium border transition-all',
                tab === t
                  ? 'bg-charcoal text-cream border-charcoal'
                  : 'bg-white text-charcoal/50 border-charcoal/15 hover:border-charcoal/35',
              ].join(' ')}>
              {t === 'all' ? 'All' : STATUS_CONFIG[t]?.label ?? t}
            </button>
          ))}
        </div>
      )}

      {/* Orders list */}
      {filteredOrders.length > 0 && (
        <div className="flex flex-col gap-3">
          {filteredOrders.map(order => (
            <div key={order.id} className="bg-white rounded-xl border border-charcoal/10 p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="font-semibold text-charcoal">{order.supplier_name}</p>
                  <p className="text-xs text-charcoal/40 mt-0.5">
                    {order.raised_by_name} · {format(new Date(order.created_at), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>
                <StatusChip status={order.status} />
              </div>

              {order.items?.length > 0 && (
                <div className="border-t border-charcoal/8 pt-3 mb-3">
                  <div className="flex flex-col divide-y divide-charcoal/6">
                    {order.items.map(item => (
                      <div key={item.id} className="flex items-center justify-between py-1.5">
                        <p className="text-sm text-charcoal">{item.item_name}</p>
                        <p className="text-sm font-mono text-charcoal/60">{item.quantity}{item.unit ? ` ${item.unit}` : ''}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {order.notes && (
                <p className="text-xs text-charcoal/40 italic mb-3">"{order.notes}"</p>
              )}

              {isManager && order.status !== 'received' && (
                <button
                  onClick={() => advanceStatus(order)}
                  className="text-[11px] tracking-widest uppercase text-charcoal/40 hover:text-charcoal transition-colors border-b border-charcoal/20"
                >
                  {order.status === 'submitted' ? 'Mark Ordered →' : 'Mark Received →'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {filteredOrders.length === 0 && suppliers.length > 0 && (
        <div className="bg-white rounded-xl border border-charcoal/10 p-8 text-center">
          <p className="text-charcoal/40 text-sm">No {tab !== 'all' ? tab : ''} orders yet.</p>
        </div>
      )}

      {/* New Order modal */}
      <Modal open={showOrder} onClose={() => setShowOrder(false)} title="New Order">
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1.5">Supplier</label>
            <select
              value={orderForm.supplier_id}
              onChange={e => setOrderForm(f => ({ ...f, supplier_id: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            >
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40">Items</label>
              <button type="button" onClick={addItem}
                className="text-[11px] tracking-widest uppercase text-charcoal/40 hover:text-charcoal transition-colors border-b border-charcoal/20">
                + Add Item
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {orderItems.map((item, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 grid grid-cols-3 gap-1.5">
                    <input value={item.item_name} onChange={e => updateItem(i, 'item_name', e.target.value)}
                      placeholder="Item name *"
                      className="col-span-3 px-3 py-2 rounded-lg border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20" />
                    <input value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)}
                      placeholder="Qty *"
                      className="px-3 py-2 rounded-lg border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20" />
                    <input value={item.unit} onChange={e => updateItem(i, 'unit', e.target.value)}
                      placeholder="Unit"
                      className="px-3 py-2 rounded-lg border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20" />
                    <input value={item.notes} onChange={e => updateItem(i, 'notes', e.target.value)}
                      placeholder="Notes"
                      className="px-3 py-2 rounded-lg border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20" />
                  </div>
                  {orderItems.length > 1 && (
                    <button type="button" onClick={() => removeItem(i)}
                      className="text-charcoal/25 hover:text-danger transition-colors text-lg leading-none mt-1.5">×</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1.5">Order Notes <span className="normal-case text-charcoal/30">(optional)</span></label>
            <textarea value={orderForm.notes} onChange={e => setOrderForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Any special instructions or notes for this order"
              rows={2}
              className="w-full px-3 py-2.5 rounded-lg border border-charcoal/15 bg-cream/30 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-charcoal/20" />
          </div>

          <button onClick={submitOrder} disabled={submittingOrder}
            className="w-full bg-charcoal text-cream py-2.5 rounded-lg text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-40">
            {submittingOrder ? 'Submitting…' : 'Submit Order →'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
