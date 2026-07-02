/**
 * AuthCallbackPage — handles Supabase email redirect links.
 *
 * Supabase redirects here after:
 *   • Email verification  (type=signup)   → show confirmed message → landing
 *   • Password reset      (type=recovery) → redirect to /reset-password
 *
 * Supabase JS v2 automatically exchanges the token in the URL hash
 * and fires onAuthStateChange. We listen and route accordingly.
 */
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('Verifying…')

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password', { replace: true })
      } else if (event === 'SIGNED_IN') {
        setStatus('Email verified! Redirecting…')
        // Sign out the temporary Supabase Auth session — owners use PIN for daily login
        supabase.auth.signOut().finally(() => {
          setTimeout(() => navigate('/', { replace: true }), 1500)
        })
      } else if (event === 'USER_UPDATED') {
        navigate('/', { replace: true })
      }
    })

    // Fallback: if no event fires within 5s the link may be expired
    const timeout = setTimeout(() => {
      setStatus('Link expired or already used. Please request a new one.')
    }, 5000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [navigate])

  return (
    <div className="min-h-dvh bg-surface flex items-center justify-center px-5">
      <div className="text-center max-w-xs">
        <div className="w-12 h-12 rounded-full border-2 border-brand/20 border-t-brand animate-spin mx-auto mb-4" />
        <p className="text-sm text-charcoal/60">{status}</p>
        {status.includes('expired') && (
          <button
            onClick={() => navigate('/')}
            className="mt-4 text-sm font-semibold text-brand underline"
          >
            Back to sign in
          </button>
        )}
      </div>
    </div>
  )
}
