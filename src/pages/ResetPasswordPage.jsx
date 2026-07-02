import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword]   = useState('')
  const [confirm,  setConfirm]    = useState('')
  const [loading,  setLoading]    = useState(false)
  const [error,    setError]      = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirm)  { setError('Passwords do not match'); return }

    setLoading(true)
    setError('')

    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) { setError(err.message); setLoading(false); return }

    // Sign out the temporary session — owner uses PIN for daily login
    await supabase.auth.signOut()
    navigate('/', { replace: true, state: { notice: 'Password updated. You can now sign in.' } })
  }

  return (
    <div className="min-h-dvh bg-surface flex flex-col items-center justify-center px-5 py-10">
      <div className="mb-8 text-center">
        <h1 className="font-bold text-charcoal text-2xl tracking-tight">Set new password</h1>
        <p className="text-xs text-charcoal/40 mt-1">Choose a strong password for your Pelikn account</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-charcoal/8 p-6 flex flex-col gap-4">
        <input
          type="password"
          required
          minLength={6}
          placeholder="New password (min 6 chars)"
          value={password}
          onChange={e => { setPassword(e.target.value); setError('') }}
          className="w-full px-4 py-2.5 rounded-xl border border-charcoal/15 bg-white text-sm text-charcoal placeholder:text-charcoal/30 outline-none focus:border-charcoal/40"
        />
        <input
          type="password"
          required
          placeholder="Confirm new password"
          value={confirm}
          onChange={e => { setConfirm(e.target.value); setError('') }}
          className="w-full px-4 py-2.5 rounded-xl border border-charcoal/15 bg-white text-sm text-charcoal placeholder:text-charcoal/30 outline-none focus:border-charcoal/40"
        />

        {error && <p className="text-danger text-xs">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-charcoal text-cream py-3 rounded-xl text-sm font-semibold tracking-wide hover:bg-charcoal/85 transition-colors disabled:opacity-40"
        >
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  )
}
