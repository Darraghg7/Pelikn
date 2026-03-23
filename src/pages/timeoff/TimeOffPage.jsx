import React, { useState, useEffect, useCallback } from 'react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths,
  isSameDay, isWithinInterval, isBefore, parseISO,
} from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'

/* ── Hook ──────────────────────────────────────────────────────────────── */
function useTimeOffRequests(venueId) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    if (!venueId) return
    setLoading(true)
    const { data } = await supabase
      .from('time_off_requests')
      .select('*, staff:staff_id(name), reviewer:reviewed_by(name)')
      .eq('venue_id', venueId)
      .order('start_date', { ascending: true })
    setRequests(data ?? [])
    setLoading(false)
  }, [venueId])
  useEffect(() => { load() }, [load])
  return { requests, loading, reload: load }
}

function useActiveStaff(venueId) {
  const [staff, setStaff] = useState([])
  useEffect(() => {
    if (!venueId) return
    supabase.from('staff').select('id, name').eq('venue_id', venueId).eq('is_active', true).order('name')
      .then(({ data }) => setStaff(data ?? []))
  }, [venueId])
  return staff
}

/* ── Calendar component ───────────────────────────────────────────────── */
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function CalendarView({ month, requests, onDayClick }) {
  const start = startOfMonth(month)
  const end = endOfMonth(month)
  const days = eachDayOfInterval({ start, end })

  // Pad start to Monday
  const startDow = getDay(start) // 0=Sun
  const mondayOffset = startDow === 0 ? 6 : startDow - 1
  const padBefore = Array.from({ length: mondayOffset }, () => null)

  const allCells = [...padBefore, ...days]
  // Pad end to fill last row
  while (allCells.length % 7 !== 0) allCells.push(null)

  const today = new Date()

  function getRequestsForDay(day) {
    if (!day) return []
    return requests.filter(r => {
      const s = parseISO(r.start_date)
      const e = parseISO(r.end_date)
      return isWithinInterval(day, { start: s, end: e })
    })
  }

  return (
    <div className="overflow-x-auto -mx-0">
      <div style={{ minWidth: '320px' }}>
      <div className="grid grid-cols-7 gap-px bg-charcoal/8 rounded-t-xl overflow-hidden">
        {DAY_LABELS.map(d => (
          <div key={d} className="bg-white py-2 text-center text-[11px] tracking-widest uppercase text-charcoal/40 font-medium">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-charcoal/8 rounded-b-xl overflow-hidden">
        {allCells.map((day, i) => {
          if (!day) return <div key={`pad-${i}`} className="bg-charcoal/3 min-h-[60px] sm:min-h-[72px]" />

          const dayRequests = getRequestsForDay(day)
          const isToday = isSameDay(day, today)
          const isPast = isBefore(day, today) && !isToday

          return (
            <button
              key={i}
              onClick={() => onDayClick(day)}
              className={`bg-white min-h-[60px] sm:min-h-[72px] p-1 text-left transition-colors hover:bg-charcoal/3 ${isPast ? 'opacity-50' : ''}`}
            >
              <span className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${
                isToday ? 'bg-charcoal text-cream' : 'text-charcoal/70'
              }`}>
                {format(day, 'd')}
              </span>
              <div className="flex flex-col gap-0.5 mt-0.5">
                {dayRequests.slice(0, 2).map(r => (
                  <div
                    key={r.id}
                    className={`rounded px-1 py-0.5 text-[9px] sm:text-[11px] font-medium truncate ${
                      r.status === 'approved'
                        ? 'bg-success/15 text-success'
                        : r.status === 'pending'
                          ? 'bg-warning/15 text-warning'
                          : 'bg-danger/10 text-danger/60 line-through'
                    }`}
                  >
                    {r.staff?.name?.split(' ')[0] ?? '?'}
                  </div>
                ))}
                {dayRequests.length > 2 && (
                  <span className="text-[9px] text-charcoal/30">+{dayRequests.length - 2}</span>
                )}
              </div>
            </button>
          )
        })}
      </div>
      </div>
    </div>
  )
}

/* ── Main Page ─────────────────────────────────────────────────────────── */
export default function TimeOffPage() {
  const toast = useToast()
  const { venueId } = useVenue()
  const { session, isManager } = useSession()
  const { requests, loading, reload } = useTimeOffRequests(venueId)
  const staff = useActiveStaff(venueId)

  const [month, setMonth] = useState(new Date())
  const [showRequest, setShowRequest] = useState(false)
  const [showDayDetail, setShowDayDetail] = useState(null) // Date or null
  const [form, setForm] = useState({ startDate: '', endDate: '', reason: '' })
  const [saving, setSaving] = useState(false)

  // Manager review state
  const [reviewing, setReviewing] = useState(null) // request id
  const [managerNote, setManagerNote] = useState('')

  const prevMonth = () => setMonth(m => subMonths(m, 1))
  const nextMonth = () => setMonth(m => addMonths(m, 1))

  // Submit time-off request
  const submitRequest = async () => {
    if (!form.startDate || !form.endDate) { toast('Please select start and end dates', 'error'); return }
    if (form.endDate < form.startDate) { toast('End date must be after start date', 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('time_off_requests').insert({
      staff_id: session?.staffId,
      start_date: form.startDate,
      end_date: form.endDate,
      reason: form.reason.trim() || null,
      venue_id: venueId,
    })
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Time-off request submitted')
    setForm({ startDate: '', endDate: '', reason: '' })
    setShowRequest(false)
    reload()
  }

  // Manager: approve
  const approve = async (id) => {
    setReviewing(id)
    const { error } = await supabase.from('time_off_requests').update({
      status: 'approved',
      reviewed_by: session?.staffId,
      reviewed_at: new Date().toISOString(),
      manager_note: managerNote.trim() || null,
    }).eq('id', id)
    setReviewing(null)
    setManagerNote('')
    if (error) { toast(error.message, 'error'); return }
    toast('Time off approved')
    reload()
  }

  // Manager: reject
  const reject = async (id) => {
    setReviewing(id)
    const { error } = await supabase.from('time_off_requests').update({
      status: 'rejected',
      reviewed_by: session?.staffId,
      reviewed_at: new Date().toISOString(),
      manager_note: managerNote.trim() || null,
    }).eq('id', id)
    setReviewing(null)
    setManagerNote('')
    if (error) { toast(error.message, 'error'); return }
    toast('Time off rejected')
    reload()
  }

  // My requests (for staff view)
  const myRequests = requests.filter(r => r.staff_id === session?.staffId)
  const pendingRequests = requests.filter(r => r.status === 'pending')

  // Day detail
  const dayDetailRequests = showDayDetail
    ? requests.filter(r => {
      const s = parseISO(r.start_date)
      const e = parseISO(r.end_date)
      return isWithinInterval(showDayDetail, { start: s, end: e })
    })
    : []

  const statusColors = {
    pending: 'bg-warning/10 text-warning border-warning/20',
    approved: 'bg-success/10 text-success border-success/20',
    rejected: 'bg-danger/10 text-danger border-danger/20',
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl text-brand">Time Off</h1>
        <button
          onClick={() => setShowRequest(true)}
          className="bg-charcoal text-cream px-4 py-2 rounded-lg text-sm font-medium hover:bg-charcoal/90 transition-colors"
        >
          + Request
        </button>
      </div>

      {/* Legend */}
      <div className="flex gap-4">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-warning/30" />
          <span className="text-[11px] tracking-wider uppercase text-charcoal/40">Pending</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-success/30" />
          <span className="text-[11px] tracking-wider uppercase text-charcoal/40">Approved</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-danger/20" />
          <span className="text-[11px] tracking-wider uppercase text-charcoal/40">Rejected</span>
        </div>
      </div>

      {/* Calendar nav */}
      <div className="bg-white rounded-xl border border-charcoal/10 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-charcoal/8">
          <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-charcoal/8 text-charcoal/50 hover:text-charcoal transition-colors text-sm">‹</button>
          <span className="text-sm font-medium text-charcoal">{format(month, 'MMMM yyyy')}</span>
          <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-charcoal/8 text-charcoal/50 hover:text-charcoal transition-colors text-sm">›</button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><LoadingSpinner /></div>
        ) : (
          <CalendarView
            month={month}
            requests={requests.filter(r => r.status !== 'rejected')}
            onDayClick={setShowDayDetail}
          />
        )}
      </div>

      {/* Manager: pending requests */}
      {isManager && pendingRequests.length > 0 && (
        <div className="bg-white rounded-xl border border-warning/20 overflow-hidden">
          <div className="px-5 py-3 border-b border-warning/10 bg-warning/5">
            <p className="text-[11px] tracking-widest uppercase text-warning font-medium">
              {pendingRequests.length} Pending Request{pendingRequests.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex flex-col divide-y divide-charcoal/6">
            {pendingRequests.map(r => (
              <div key={r.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-charcoal">{r.staff?.name}</p>
                    <p className="text-sm text-charcoal/50">
                      {format(parseISO(r.start_date), 'd MMM')} — {format(parseISO(r.end_date), 'd MMM yyyy')}
                    </p>
                    {r.reason && <p className="text-xs text-charcoal/40 mt-1 italic">"{r.reason}"</p>}
                  </div>
                  <span className="text-[11px] tracking-wider uppercase font-medium px-2 py-0.5 rounded-full bg-warning/15 text-warning">
                    Pending
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="Optional note..."
                  value={reviewing === r.id ? managerNote : ''}
                  onFocus={() => setReviewing(r.id)}
                  onChange={e => setManagerNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-cream/30 text-xs focus:outline-none focus:ring-2 focus:ring-charcoal/20 placeholder-charcoal/25"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => approve(r.id)}
                    disabled={reviewing === r.id && reviewing === null}
                    className="flex-1 py-2 rounded-lg bg-success text-white text-xs font-medium hover:bg-success/90 transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => reject(r.id)}
                    className="flex-1 py-2 rounded-lg border border-danger/25 text-danger text-xs font-medium hover:bg-danger/5 transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My requests (staff or manager) */}
      {myRequests.length > 0 && (
        <div>
          <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-2">My Requests</p>
          <div className="flex flex-col gap-2">
            {myRequests.map(r => (
              <div key={r.id} className={`rounded-xl border px-4 py-3 ${statusColors[r.status]}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {format(parseISO(r.start_date), 'd MMM')} — {format(parseISO(r.end_date), 'd MMM yyyy')}
                    </p>
                    {r.reason && <p className="text-xs opacity-70 mt-0.5">{r.reason}</p>}
                    {r.manager_note && <p className="text-xs opacity-60 mt-0.5 italic">Note: {r.manager_note}</p>}
                  </div>
                  <span className="text-[11px] tracking-wider uppercase font-semibold">
                    {r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request modal */}
      <Modal open={showRequest} onClose={() => setShowRequest(false)} title="Request Time Off">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">Start date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value, endDate: f.endDate || e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
            </div>
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">End date</label>
              <input
                type="date"
                value={form.endDate}
                min={form.startDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">Reason (optional)</label>
            <textarea
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              rows={2}
              placeholder="e.g. Holiday, family event, appointment..."
              className="w-full px-4 py-2.5 rounded-xl border border-charcoal/15 bg-cream/30 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>

          <button
            onClick={submitRequest}
            disabled={saving || !form.startDate || !form.endDate}
            className="bg-charcoal text-cream py-3 rounded-xl text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-40"
          >
            {saving ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </Modal>

      {/* Day detail modal */}
      <Modal
        open={!!showDayDetail}
        onClose={() => setShowDayDetail(null)}
        title={showDayDetail ? format(showDayDetail, 'EEEE d MMMM yyyy') : ''}
      >
        {dayDetailRequests.length === 0 ? (
          <p className="text-sm text-charcoal/30 italic py-4">No time-off requests for this day.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {dayDetailRequests.map(r => (
              <div key={r.id} className={`rounded-xl border px-4 py-3 ${statusColors[r.status]}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{r.staff?.name}</p>
                    <p className="text-xs opacity-70">
                      {format(parseISO(r.start_date), 'd MMM')} — {format(parseISO(r.end_date), 'd MMM')}
                    </p>
                    {r.reason && <p className="text-xs opacity-60 mt-0.5">{r.reason}</p>}
                  </div>
                  <span className="text-[11px] tracking-wider uppercase font-semibold">
                    {r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
