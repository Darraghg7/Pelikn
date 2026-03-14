import React from 'react'

export default function LoadingSpinner({ size = 'md', className = '' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' }
  return (
    <div className={`${sizes[size]} animate-spin rounded-full border-2 border-charcoal/20 border-t-charcoal ${className}`} />
  )
}

export function FullPageLoader() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-cream">
      <LoadingSpinner size="lg" />
    </div>
  )
}
