import React from 'react'
import Modal from './Modal'

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
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg border border-charcoal/15 dark:border-white/15 text-sm text-charcoal/60 dark:text-white/50 hover:text-charcoal dark:hover:text-white hover:border-charcoal/30 dark:hover:border-white/30 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            danger
              ? 'bg-danger text-white hover:bg-danger/90'
              : 'bg-charcoal text-cream hover:bg-charcoal/90 dark:bg-white dark:text-charcoal dark:hover:bg-white/90'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
