import React, { useEffect } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useSession } from '../contexts/SessionContext'

const HELP_EMAIL = 'hello@get-pelikn.com'

// Used by both catch-all routes: the top-level one and the one inside
// /v/:venueSlug/*. An unknown venue slug never reaches here — VenueProvider
// shows its own "We can't find that venue" card first.
export default function NotFoundPage() {
  const { venueSlug } = useParams()
  const { pathname } = useLocation()
  // Null outside SessionProvider (top-level route).
  const session = useSession()?.session

  useEffect(() => {
    const previous = document.title
    document.title = 'Page not found · Pelikn'
    return () => { document.title = previous }
  }, [])

  const primary = venueSlug
    ? session
      ? { to: `/v/${venueSlug}/dashboard`, label: 'Back to dashboard' }
      : { to: `/v/${venueSlug}`, label: 'Back to sign in' }
    : { to: '/', label: 'Go to Pelikn home' }
  const secondary = venueSlug ? null : { to: '/login', label: 'Sign in' }

  return (
    <div className="min-h-dvh bg-surface dark:bg-bgDark flex flex-col items-center justify-center px-4 py-10 font-sans">
      <Link to="/" className="mb-6 text-center" aria-label="Pelikn home">
        <span className="block font-bold text-brand dark:text-white text-3xl tracking-tight">Pelikn</span>
      </Link>

      <main className="w-full max-w-sm bg-white dark:bg-paperDark rounded-2xl border border-charcoal/8 dark:border-white/8 shadow-sm p-6 text-center">
        <p className="font-mono text-[11px] font-semibold tracking-[0.08em] uppercase text-accent mb-2">
          Error 404
        </p>
        <h1 className="text-xl font-semibold text-charcoal dark:text-white mb-2">
          We couldn’t find that page
        </h1>
        <p className="text-sm text-charcoal/60 dark:text-white/55 leading-relaxed mb-3">
          The link may be mistyped, or the page may have moved.
        </p>
        <p className="font-mono text-xs text-charcoal/70 dark:text-white/65 bg-charcoal/[0.04] dark:bg-white/5 rounded-lg px-3 py-2 mb-5 break-all">
          {pathname}
        </p>

        <Link
          to={primary.to}
          className="block w-full bg-brand text-cream py-3 rounded-xl text-sm font-semibold hover:bg-brand/90 transition-colors"
        >
          {primary.label}
        </Link>
        {secondary && (
          <Link
            to={secondary.to}
            className="block w-full mt-2 py-3 rounded-xl text-sm font-semibold text-charcoal dark:text-white border border-charcoal/12 dark:border-white/15 hover:bg-charcoal/[0.03] dark:hover:bg-white/5 transition-colors"
          >
            {secondary.label}
          </Link>
        )}
      </main>

      <p className="mt-6 text-xs text-charcoal/50 dark:text-white/45 text-center">
        Need a hand? Email{' '}
        <a
          href={`mailto:${HELP_EMAIL}`}
          className="text-brand dark:text-accent font-medium underline-offset-2 hover:underline"
        >
          {HELP_EMAIL}
        </a>
      </p>
    </div>
  )
}
