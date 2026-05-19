import React, { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../ui/Toast'
import SignaturePad from '../ui/SignaturePad'

export default function AcknowledgeModal({ record, staffName, onSaved, onClose }) {
  const toast = useToast()
  const { session } = useSession()
  const [staffSig, setStaffSig] = useState(null)
  const [saving, setSaving]     = useState(false)

  const handleSubmit = async () => {
    if (!staffSig) { toast('Please sign to confirm you received this training', 'error'); return }
    setSaving(true)
    const { error } = await supabase.rpc('acknowledge_training_sign_off', {
      p_token:       session?.token,
      p_sign_off_id: record.id,
      p_signature:   staffSig,
    })
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Training record signed ✓')
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-charcoal/8 flex items-center justify-between">
          <div>
            <p className="font-semibold text-charcoal">Training Record — Sign to Confirm</p>
            <p className="text-xs text-charcoal/40 mt-0.5">
              {format(parseISO(record.training_date), 'd MMMM yyyy')} · Trainer: {record.trainer_name}
            </p>
          </div>
          <button onClick={onClose} className="text-charcoal/30 hover:text-charcoal text-xl leading-none">×</button>
        </div>

        <div className="p-6 flex flex-col gap-5">
          <div>
            <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-3">Training Covered</p>
            <ul className="flex flex-col gap-1.5">
              {record.topics.map(t => (
                <li key={t} className="flex items-start gap-2 text-sm text-charcoal">
                  <span className="text-success mt-0.5 shrink-0">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="2,6 5,9 10,3"/>
                    </svg>
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {record.notes && (
            <div className="bg-surface rounded-lg px-4 py-3">
              <p className="text-[11px] text-charcoal/40 uppercase tracking-widest mb-1">Notes</p>
              <p className="text-sm text-charcoal/70 italic">{record.notes}</p>
            </div>
          )}

          {record.manager_signature && (
            <div>
              <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-2">
                Manager / Trainer Signature{record.manager_name ? ` (${record.manager_name})` : ''}
              </p>
              <SignaturePad value={record.manager_signature} disabled />
            </div>
          )}

          <div>
            <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-1">Your Signature — {staffName}</p>
            <p className="text-xs text-charcoal/40 mb-2">
              By signing, you confirm you have received and understood the above training.
            </p>
            <SignaturePad onChange={setStaffSig} />
          </div>
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={handleSubmit}
            disabled={saving || !staffSig}
            className="w-full bg-charcoal text-cream py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-charcoal/90 transition-colors"
          >
            {saving ? 'Saving…' : 'I confirm I have received this training →'}
          </button>
        </div>
      </div>
    </div>
  )
}
