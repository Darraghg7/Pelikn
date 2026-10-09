import React, { forwardRef } from 'react'
import { Link } from 'react-router-dom'

/**
 * The one way to draw a button. Use it instead of a hand-styled <button> so
 * sizes, colours, corners, focus rings and disabled/loading states match
 * everywhere (raw <button>s are counted by scripts/raw-buttons.mjs and the
 * count may only go down).
 *
 *   <Button onClick={save}>Save</Button>
 *   <Button variant="secondary" onClick={onClose}>Cancel</Button>
 *   <Button variant="danger" loading={deleting} onClick={remove}>Delete</Button>
 *   <Button type="submit" fullWidth loading={saving}>Create account</Button>
 *   <Button iconOnly aria-label="Close" variant="ghost" leadingIcon={<XIcon />} />
 *   <Button to="/settings" variant="secondary">Settings</Button>   // router link
 *   <Button href="https://…" variant="link">Help</Button>          // plain link
 *   <Button variant="label" onClick={exportPdf}>Export PDF</Button> // header micro-action
 *
 * - `type` defaults to "button". Pass type="submit" for the button that
 *   submits a form; a raw <button> inside a form submits by default, so check
 *   when migrating one.
 * - `loading` shows a spinner and disables the button, so a second tap can't
 *   send the same write twice.
 * - `iconOnly` makes a square button and needs an `aria-label` (screen readers
 *   have nothing else to read).
 * - 'className' is for layout only (flex-1, mt-2, self-start…). Don't use it to
 *   restyle colour, size or corners — add a variant or size here instead, or
 *   the classes fight and the look drifts again.
 */

// Disabled looks greyed out. Loading is disabled too but keeps its colour, so
// these use `idle-disabled:` (tailwind.config.js) — disabled and not loading.
const FILLED_DISABLED = 'idle-disabled:bg-ink3/60 dark:idle-disabled:bg-white/15 idle-disabled:text-white/90 idle-disabled:shadow-none'

export const BUTTON_VARIANTS = {
  // Main action on a screen or in a dialog. One per view where possible.
  primary:   `bg-brand text-white hover:bg-brand-700 dark:bg-brand-700 dark:hover:bg-brand-600 shadow-sm shadow-brand/10 ${FILLED_DISABLED}`,
  // Supporting action next to a primary (Cancel, Export, Edit).
  secondary: 'bg-white dark:bg-paperDark text-ink2 dark:text-white/85 border border-line dark:border-white/12 hover:border-ink4 hover:text-ink dark:hover:border-white/25 dark:hover:text-white idle-disabled:opacity-50',
  // Low-emphasis action inside a card or toolbar.
  ghost:     'text-ink2 dark:text-white/75 hover:bg-ink/5 hover:text-ink dark:hover:bg-white/8 dark:hover:text-white idle-disabled:opacity-40',
  // Destructive confirm (Delete, Remove permanently).
  danger:    `bg-bad text-white hover:bg-severe shadow-sm shadow-bad/10 ${FILLED_DISABLED}`,
  // Destructive but low-emphasis (Remove link inside a form).
  'danger-ghost': 'text-bad hover:bg-badBg dark:text-badDark dark:hover:bg-bad/20 idle-disabled:opacity-40',
  // Coral accent — marketing/upgrade moments only, not everyday actions.
  accent:    `bg-accent text-white hover:brightness-95 shadow-sm shadow-accent/15 ${FILLED_DISABLED}`,
  // Inline text action that sits in a sentence. Ignores `size` padding.
  link:      'text-brand dark:text-white underline-offset-2 hover:underline idle-disabled:opacity-40',
  // Small uppercase underlined action in a page header (EXPORT PDF, + ADD TASK). Ignores 'size' padding.
  label:     'text-[11px] tracking-widest uppercase text-ink3 dark:text-white/55 hover:text-ink dark:hover:text-white border-b border-ink4/70 dark:border-white/25 hover:border-ink3 dark:hover:border-white/50 idle-disabled:opacity-40',
  // On a dark brand-green card (the dashboard clock card).
  // bg-paper, not bg-white: index.css forces .bg-white dark in dark mode, which
  // left the old Clock in button dark-green-on-dark.
  inverse:   'bg-paper text-brand hover:bg-paper/90 idle-disabled:opacity-50',
  'inverse-secondary': 'bg-white/12 text-white border border-white/25 hover:bg-white/20 idle-disabled:opacity-50',
  // Kept for existing callers.
  success:   `bg-good text-white hover:bg-good/90 ${FILLED_DISABLED}`,
  warning:   `bg-warn text-white hover:bg-warn/90 ${FILLED_DISABLED}`,
}

// Heights: sm 36px, md 44px on phones / 40px from sm: up, lg 48px.
// sm grows its tap area to 44px on phones (.btn-hit in index.css), so the look
// stays compact without becoming hard to hit.
const HIT_AREA = 'btn-hit'

const SIZES = {
  sm: { text: `h-9 px-3 gap-1.5 text-[13px] ${HIT_AREA}`, icon: `h-9 w-9 ${HIT_AREA}`, svg: '[&_svg]:w-4 [&_svg]:h-4' },
  md: { text: 'h-11 sm:h-10 px-4 gap-2 text-sm', icon: 'h-11 w-11 sm:h-10 sm:w-10', svg: '[&_svg]:w-[18px] [&_svg]:h-[18px]' },
  lg: { text: 'h-12 px-5 gap-2 text-[15px]', icon: 'h-12 w-12', svg: '[&_svg]:w-5 [&_svg]:h-5' },
}
SIZES.xl = SIZES.lg // old name, kept for existing callers

const BASE = [
  'inline-flex items-center justify-center shrink-0 select-none whitespace-nowrap',
  'leading-none',
  'transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:scale-[0.98]',
  'disabled:cursor-not-allowed disabled:active:scale-100 aria-busy:cursor-progress',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
  'dark:focus-visible:ring-white/60 dark:focus-visible:ring-offset-paperDark',
].join(' ')

function Spinner() {
  return (
    <svg className="animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/** Class string for things that must look like a Button but can't be one (e.g. a <label> for a file input). */
export function buttonClasses({ variant = 'primary', size = 'md', iconOnly = false, fullWidth = false, className = '' } = {}) {
  const s = SIZES[size] ?? SIZES.md
  return [
    BASE,
    BUTTON_VARIANTS[variant] ?? BUTTON_VARIANTS.primary,
    variant === 'link' ? 'gap-1.5 text-sm font-semibold rounded-md'
      : variant === 'label' ? 'gap-1 pb-0.5 font-medium'
      : `rounded-xl font-semibold ${iconOnly ? s.icon : s.text}`,
    variant === 'label' ? '[&_svg]:w-3 [&_svg]:h-3' : s.svg,
    fullWidth ? 'w-full' : '',
    className,
  ].filter(Boolean).join(' ')
}

/**
 * @typedef {Object} ButtonOwnProps
 * @property {'primary'|'secondary'|'ghost'|'danger'|'danger-ghost'|'accent'|'link'|'label'|'inverse'|'inverse-secondary'|'success'|'warning'} [variant]
 * @property {'sm'|'md'|'lg'|'xl'} [size]
 * @property {'button'|'submit'|'reset'} [type]
 * @property {boolean} [iconOnly]
 * @property {React.ReactNode} [leadingIcon]
 * @property {React.ReactNode} [trailingIcon]
 * @property {boolean} [loading]
 * @property {boolean} [fullWidth]
 * @property {import('react-router-dom').To} [to]  render as a router <Link>
 * @property {string} [href]  render as a plain <a>
 * @property {string} [target]
 * @property {string} [rel]
 *
 * @typedef {ButtonOwnProps & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'>} ButtonProps
 */

const Button = forwardRef(/** @param {ButtonProps} props @param {React.Ref<any>} ref */ function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  iconOnly = false,
  leadingIcon = null,
  trailingIcon = null,
  loading = false,
  fullWidth = false,
  disabled = false,
  to,
  href,
  className = '',
  children,
  ...props
}, ref) {
  if (import.meta.env?.DEV && iconOnly && !props[`aria-label`] && !props['aria-labelledby']) {
    console.warn('<Button iconOnly> needs an aria-label so screen readers can name it.')
  }

  const classes = buttonClasses({ variant, size, iconOnly, fullWidth, className })
  const content = (
    <>
      {loading ? <Spinner /> : leadingIcon}
      {iconOnly ? (loading ? null : children) : children}
      {!loading && trailingIcon}
    </>
  )

  if (to || href) {
    // Links can't be disabled; render the button form instead when they must be.
    const linkProps = /** @type {any} */ ({ ref, className: classes, 'aria-disabled': disabled || loading || undefined, ...props })
    return to
      ? <Link to={to} {...linkProps}>{content}</Link>
      : <a href={href} {...linkProps}>{content}</a>
  }

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes}
      {...props}
    >
      {content}
    </button>
  )
})

export default Button

/** The standard "×" for closing a modal, sheet or banner. */
/** @param {{ label?: string } & ButtonProps} props */
export function CloseButton({ label = 'Close', size = 'sm', ...props }) {
  return (
    <Button iconOnly variant="ghost" size={size} aria-label={label} {...props}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
    </Button>
  )
}
