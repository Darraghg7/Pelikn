/**
 * Toggle — a clean, accessible on/off switch.
 *
 * Uses left-0.5 / right-0.5 positioning instead of translateX so the
 * knob has an identical 2px gap on both sides regardless of track width.
 *
 * Dark mode: a filled grey "off" track can't contrast with both the card and
 * the orange "on" track, so off is an outline (white/50, ≥5:1 on #1e1e1e and
 * #111) and on is the solid accent (≥3.6:1 on both). The knob stays light —
 * bg-paper, not bg-white, because html.dark .bg-white is forced dark.
 */
export default function Toggle({ checked, onChange, disabled = false, size = 'md' }) {
  const sizes = {
    sm: { track: 'w-9 h-5',  knob: 'w-4 h-4' },
    md: { track: 'w-11 h-6', knob: 'w-5 h-5' },
    lg: { track: 'w-14 h-7', knob: 'w-6 h-6' },
  }
  const { track, knob } = sizes[size] ?? sizes.md

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange?.(!checked)}
      className={[
        'relative rounded-full transition-colors duration-200 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        track,
        checked
          ? 'bg-accent'
          : 'bg-charcoal/20 dark:bg-transparent dark:ring-[1.5px] dark:ring-inset dark:ring-white/50',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      <span
        className={[
          'absolute top-0.5 rounded-full bg-paper shadow-sm transition-all duration-200',
          knob,
          checked ? 'right-0.5' : 'left-0.5 dark:bg-white/70',
        ].join(' ')}
      />
    </button>
  )
}
