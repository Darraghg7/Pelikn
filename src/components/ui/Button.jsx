import React from 'react'

const variants = {
  primary:   'bg-brand text-cream hover:bg-brand/90 dark:bg-charcoal dark:hover:bg-charcoal/90 active:scale-[0.98]',
  secondary: 'bg-cream text-charcoal border border-charcoal/20 hover:bg-charcoal/5 active:scale-[0.98]',
  danger:    'bg-danger text-white hover:bg-red-700 active:scale-[0.98]',
  ghost:     'text-charcoal hover:bg-charcoal/5 active:scale-[0.98]',
  success:   'bg-success text-white hover:bg-green-700 active:scale-[0.98]',
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
