import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40)
}

export default function SignupPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    email: '', password: '',
    venueName: '', slug: '',
    ownerName: '', pin: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [slugEdited, setSlugEdited] = useState(false)

  const set = (key, value) => {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      // Auto-generate slug from venue name unless manually edited
      if (key === 'venueName' && !slugEdited) {
        next.slug = slugify(value)
      }
      return next
    })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.pin.length < 4) { setError('PIN must be at least 4 digits'); return }
    if (!form.slug.trim()) { setError('Venue slug is required'); return }

    setLoading(true)
    setError('')

    // 1. Create Supabase Auth account
    const { error: authErr } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    })
    if (authErr) { setError(authErr.message); setLoading(false); return }

    // 2. Create venue with owner (uses the new auth session)
    const { data: venueId, error: venueErr } = await supabase.rpc('create_venue_with_owner', {
      p_venue_name: form.venueName,
      p_slug: form.slug.toLowerCase(),
      p_owner_name: form.ownerName,
      p_owner_pin: form.pin,
    })

    if (venueErr) {
      setError(venueErr.message)
      setLoading(false)
      return
    }

    // 3. Sign out of Supabase Auth (staff use PIN auth instead)
    await supabase.auth.signOut()

    // 4. Redirect to venue login
    navigate(`/v/${form.slug.toLowerCase()}`)
  }

  return (
    <div className="min-h-dvh bg-cream flex flex-col items-center justify-center px-5 py-10 font-sans">
      <div className="mb-8 text-center">
        <h1 className="font-serif text-charcoal text-3xl tracking-tight">Create Your Venue</h1>
        <p className="text-xs text-charcoal/40 mt-1">Set up SafeServ for your business</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-charcoal/8 p-6 flex flex-col gap-5">
        {/* Account */}
        <div>
          <p className="text-[10px] tracking-widest uppercase text-charcoal/40 mb-2">Your Account</p>
          <div className="flex flex-col gap-2">
            <input type="email" required placeholder="Email" value={form.email}
              onChange={e => set('email', e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-charcoal/15 bg-white text-sm text-charcoal placeholder:text-charcoal/30 outline-none focus:border-charcoal/40" />
            <input type="password" required minLength={6} placeholder="Password (min 6 chars)" value={form.password}
              onChange={e => set('password', e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-charcoal/15 bg-white text-sm text-charcoal placeholder:text-charcoal/30 outline-none focus:border-charcoal/40" />
          </div>
        </div>

        {/* Venue */}
        <div>
          <p className="text-[10px] tracking-widest uppercase text-charcoal/40 mb-2">Your Venue</p>
          <div className="flex flex-col gap-2">
            <input type="text" required placeholder="Venue Name (e.g. The Corner Cafe)" value={form.venueName}
              onChange={e => set('venueName', e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-charcoal/15 bg-white text-sm text-charcoal placeholder:text-charcoal/30 outline-none focus:border-charcoal/40" />
            <div>
              <input type="text" required placeholder="venue-slug" value={form.slug}
                onChange={e => { set('slug', e.target.value.replace(/[^a-z0-9-]/g, '')); setSlugEdited(true) }}
                className="w-full px-4 py-2.5 rounded-xl border border-charcoal/15 bg-white text-sm text-charcoal font-mono placeholder:text-charcoal/30 outline-none focus:border-charcoal/40" />
              <p className="text-[10px] text-charcoal/30 mt-1">Your URL will be safeserv.app/v/{form.slug || 'your-venue'}</p>
            </div>
          </div>
        </div>

        {/* Owner */}
        <div>
          <p className="text-[10px] tracking-widest uppercase text-charcoal/40 mb-2">Owner Staff Profile</p>
          <div className="flex flex-col gap-2">
            <input type="text" required placeholder="Your Name" value={form.ownerName}
              onChange={e => set('ownerName', e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-charcoal/15 bg-white text-sm text-charcoal placeholder:text-charcoal/30 outline-none focus:border-charcoal/40" />
            <input type="password" inputMode="numeric" required minLength={4} maxLength={6}
              placeholder="PIN (4-6 digits)" value={form.pin}
              onChange={e => set('pin', e.target.value.replace(/\D/g, ''))}
              className="w-full px-4 py-2.5 rounded-xl border border-charcoal/15 bg-white text-sm text-charcoal font-mono tracking-[0.3em] placeholder:tracking-normal placeholder:font-sans placeholder:text-charcoal/30 outline-none focus:border-charcoal/40" />
          </div>
        </div>

        {error && <p className="text-red-500 text-xs">{error}</p>}

        <button type="submit" disabled={loading}
          className="w-full bg-charcoal text-cream py-3 rounded-xl text-sm font-semibold tracking-wide hover:bg-charcoal/85 transition-colors disabled:opacity-40">
          {loading ? 'Creating…' : 'Create Venue'}
        </button>

        <p className="text-center text-xs text-charcoal/40">
          Already have a venue? <Link to="/" className="text-accent hover:underline">Sign in</Link>
        </p>
      </form>
    </div>
  )
}
