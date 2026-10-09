import React from 'react'
import Button from './Button'

/**
 * Shown in place of an empty state when a list failed to load.
 *
 * A failed Supabase read returns `data: null`, which used to fall through to
 * "Nothing here yet" — so a permissions block or a bad column looked exactly
 * like having no records. Use this instead whenever `error` is set and there's
 * nothing already on screen to keep showing.
 */
export default function LoadError({ what = 'this', onRetry, className = '' }) {
  return (
    <div role="alert" className={`py-6 px-4 text-center ${className}`}>
      <p className="text-sm text-danger/80">Couldn’t load {what} — check your connection.</p>
      {onRetry && (
        <Button
          variant="link"
          onClick={onRetry}
          className="mt-2"
        >
          Try again
        </Button>
      )}
    </div>
  )
}
