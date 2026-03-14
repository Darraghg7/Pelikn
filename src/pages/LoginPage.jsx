import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSession } from '../contexts/SessionContext'

const ROLE_LABEL = {
  owner:   'Owner',
  manager: 'Manager',
  staff:   'Staff',
}

export default function LoginPage() {
  const { signIn, session, loading } = useSession()
  const navigate = useNavigate()

  const [staff, setStaff]           = useState([])
  const [selected, setSelected]     = useState(null)   // staff row
  const [pin, setPin]               = useState('')
  const [error, setError]           = useState('')
  const [submitting, setSubmitting] = useState(false)
  const pinRef = useRef(null)

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && session) navigate('/dashboard', { replace: true })
  }, [loading, session, navigate])

  // Fetch all active staff on mount
  useEffect(() => {
    supabase
      .from('staff')
      .select('id, name, role')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setStaff(data ?? []))
  }, [])

  const selectStaff = (member) => {
    setSelected(member)
    setPin('')
    setError('')
    setTimeout(() => pinRef.current?.focus(), 50)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selected || pin.length < 4) return
    setSubmitting(true)
    setError('')
    const { error: err } = await signIn(selected.id, pin)
    if (err) {
      setError('Incorrect PIN — try again')
      setPin('')
      setSubmitting(false)
      pinRef.current?.focus()
    }
    // On success SessionContext sets session → useEffect above redirects
  }

  if (loading) return null

  return (
    <div className="min-h-dvh bg-cream flex flex-col items-center justify-center px-5 py-10 font-sans">

      {/* Logo */}
      <div className="mb-10 text-center">
        <h1 className="font-serif text-charcoal text-4xl tracking-tight">SafeServ</h1>
        <p className="text-xs tracking-widest text-charcoal/40 uppercase mt-1">Food Safety &amp; Operations</p>
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-charcoal/8 p-6 flex flex-col gap-6">

        {/* Staff picker */}
        <div>
          <p className="text-[11px] tracking-widest font-semibold text-charcoal/40 uppercase mb-3">
            Select Staff Member
          </p>
          <div className="flex flex-col gap-2">
            {staff.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => selectStaff(s)}
                className={[
                  'w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all',
                  selected?.id === s.id
                    ? 'border-accent bg-accent/5 ring-1 ring-accent'
                    : 'border-charcoal/10 hover:border-charcoal/25 bg-white',
                ].join(' ')}
              >
                <span className="font-semibold text-charcoal text-sm">{s.name}</span>
                <span className={[
                  'text-[10px] uppercase tracking-widest font-medium',
                  selected?.id === s.id ? 'text-accent' : 'text-charcoal/35',
                ].join(' ')}>
                  {ROLE_LABEL[s.role] ?? s.role}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* PIN entry — shown once a staff member is selected */}
        {selected && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <p className="text-[11px] tracking-widest font-semibold text-charcoal/40 uppercase mb-2">PIN</p>
              <input
                ref={pinRef}
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError('') }}
                placeholder="Enter PIN"
                className={[
                  'w-full px-4 py-3 rounded-xl border bg-white text-charcoal text-sm font-mono tracking-[0.4em] placeholder:tracking-normal placeholder:font-sans placeholder:text-charcoal/30 outline-none transition-colors',
                  error ? 'border-red-400 focus:border-red-400' : 'border-charcoal/15 focus:border-accent',
                ].join(' ')}
              />
              {error && (
                <p className="text-red-500 text-xs mt-1.5">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={pin.length < 4 || submitting}
              className="w-full bg-charcoal text-cream py-3 rounded-xl text-sm font-semibold tracking-wide hover:bg-charcoal/85 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? 'Signing in…' : 'Sign In →'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
