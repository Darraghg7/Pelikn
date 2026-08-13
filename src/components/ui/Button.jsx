import React from 'react'

const variants = {
  primary:   'bg-brand text-cream hover:bg-brand/90 hover:shadow-md hover:shadow-brand/20 dark:bg-charcoal dark:hover:bg-charcoal/90 active:scale-[0.98]',
  secondary: 'bg-cream text-charcoal dark:text-white border border-charcoal/20 dark:border-white/20 hover:bg-charcoal/5 dark:hover:bg-white/5 hover:shadow-sm dark:bg-white/8 dark:hover:bg-white/12 active:scale-[0.98]',
  danger:    'bg-danger text-white hover:bg-danger/80 hover:shadow-md hover:shadow-danger/20 active:scale-[0.98]',
  ghost:     'text-charcoal dark:text-white hover:bg-charcoal/5 dark:hover:bg-white/5 dark:hover:bg-white/8 active:scale-[0.98]',
  success:   'bg-success text-white hover:bg-success/80 hover:shadow-md hover:shadow-success/20 active:scale-[0.98]',
  warning:   'bg-warning text-white hover:bg-amber-700 active:scale-[0.98]',
}

const sizes = {
  sm:  'px-3 py-1.5 text-sm rounded-lg',
  md:  'px-4 py-2.5 text-sm rounded-xl',
  lg:  'px-5 py-3.5 text-base rounded-xl',
  xl:  'px-6 py-4 text-lg rounded-2xl',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  children,
  ...props
}) {
  return (
    <button
      disabled={disabled}
      className={[
        'font-medium transition-all duration-150 inline-flex items-center justify-center gap-2',
        'disabled:opacity-40 disabled:pointer-events-none',
        'focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2',
        variants[variant],
        sizes[size],
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}
