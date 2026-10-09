import React from 'react'
import Modal from './Modal'
import Button from './Button'

/**
 * Reusable confirmation dialog.
 * Replaces window.confirm() with a proper modal.
 *
 * Usage:
 *   const [target, setTarget] = useState(null)
 *   <ConfirmDialog
 *     open={!!target}
 *     title="Delete item?"
 *     message="This cannot be undone."
 *     confirmLabel="Delete"
 *     danger
 *     onConfirm={() => { doDelete(target); setTarget(null) }}
 *     onClose={() => setTarget(null)}
 *   />
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-charcoal/70 dark:text-white/60 mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  )
}
