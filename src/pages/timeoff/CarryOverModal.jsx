import React, { useState } from 'react'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { saveCarryOver } from '../../lib/api/holidayPay'

/**
 * Unused holiday hours a zero-hours person brings into this holiday year.
 * One number per person per year; it's added to their balance. 0 or blank
 * clears it.
 *
 * balance: their row from useTeamLeaveBalances (carriedOver is the current figure)
 */
export default function CarryOverModal({ balance: b, leaveYear, available, venueId, onClose, onSaved }) {
  const toast = useToast()
  const [hours, setHours]   = useState(b.carriedOver > 0 ? String(b.carriedOver) : '')
  const [saving, setSaving] = useState(false)

  const n = hours === '' ? 0 : parseFloat(hours)
  const valid = Number.isFinite(n) && n >= 0 && n <= 1000

  const save = async () => {
    setSaving(true)
    const { error } = await saveCarryOver({ venueId, staffId: b.id, leaveYear: leaveYear.startYear, hours: n > 0 ? n : null })
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast(n > 0 ? `${n} h carried over for ${b.name}` : `Carry-over cleared for ${b.name}`)
    onSaved()
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={`Carried over — ${b.name}`}>
      <div className="flex flex-col gap-3.5">
        {!available && (
          <p className="rounded-xl bg-warnBg dark:bg-warn/20 px-3.5 py-2.5 text-body-sm text-warn dark:text-warnDark">
            Carry-over needs a database update (migration 148) before it can be saved.
          </p>
        )}
        <p className="text-body-sm text-ink2 dark:text-white/70">
          Unused holiday hours from last holiday year, added to {b.name}'s {leaveYear.label} balance.
        </p>
        <label className="flex items-center gap-2.5">
          <span className="flex-1 text-body text-ink dark:text-white">Hours carried over</span>
          <input
            type="number" inputMode="decimal" min="0" step="0.25"
            value={hours} onChange={e => setHours(e.target.value)}
            placeholder="0"
            aria-label="Hours carried over"
            className="w-24 h-11 px-3 rounded-xl border border-line dark:border-white/10 bg-cream dark:bg-white/5 text-body text-right text-ink dark:text-white"
          />
          <span className="text-body-sm text-ink3 dark:text-white/45">h</span>
        </label>
        <Button fullWidth loading={saving} disabled={saving || !valid || !available} onClick={save}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </Modal>
  )
}
