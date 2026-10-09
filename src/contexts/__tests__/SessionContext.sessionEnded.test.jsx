import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'
import {
  SESSION_TOKEN_KEY, SESSION_ID_KEY, SESSION_JWT_KEY, SESSION_VENUE_ID_KEY,
} from '../../lib/constants'

// Capture what SessionProvider registers with the Supabase client. The
// session check on mount never answers, so only the restored session and the
// handler are under test.
const registered = vi.hoisted(() => ({ ended: null }))
const authSignOut = vi.hoisted(() => vi.fn())
vi.mock('../../lib/supabase', () => ({
  supabase: { rpc: () => new Promise(() => {}), auth: { signOut: authSignOut } },
  supabaseUrl: 'https://example.supabase.co',
  supabaseAnonKey: 'anon',
  setSessionJwt: vi.fn(),
  clearSessionJwt: vi.fn(),
  registerJwtRefresher: vi.fn(),
  registerSessionEndedHandler: vi.fn((fn) => { if (fn) registered.ended = fn }),
  SessionEndedError: class extends Error {},
}))

const { SessionProvider, useSession } = await import('../SessionContext')

const wrapper = ({ children }) => <SessionProvider>{children}</SessionProvider>

describe('SessionProvider — session ended under the device (146)', () => {
  beforeEach(() => {
    localStorage.clear()
    registered.ended = null
    localStorage.setItem(SESSION_TOKEN_KEY, 'tok-1')
    localStorage.setItem(SESSION_ID_KEY, 'staff-1')
    localStorage.setItem(SESSION_VENUE_ID_KEY, 'v-1')
    localStorage.setItem(SESSION_JWT_KEY, 'old.jwt')
    localStorage.setItem('pelikn_sess_staff-1', JSON.stringify({ token: 'tok-1' }))
  })

  it('signs the device out (back to the PIN screen) and drops the offline copy of the dead token', async () => {
    const { result } = renderHook(() => useSession(), { wrapper })
    await waitFor(() => expect(result.current.session?.token).toBe('tok-1'))

    let answer
    act(() => { answer = registered.ended('tok-1') })

    expect(answer).toBe(true)   // the Supabase client drops the JWT
    expect(result.current.session).toBeNull()
    expect(localStorage.getItem(SESSION_TOKEN_KEY)).toBeNull()
    expect(localStorage.getItem(SESSION_JWT_KEY)).toBeNull()
    expect(localStorage.getItem('pelikn_sess_staff-1')).toBeNull()
  })

  it('ignores a late answer about a session that has since been replaced', async () => {
    const { result } = renderHook(() => useSession(), { wrapper })
    await waitFor(() => expect(result.current.session?.token).toBe('tok-1'))

    let answer
    act(() => { answer = registered.ended('tok-from-before-venue-switch') })

    expect(answer).toBe(false)  // the Supabase client keeps the new session's JWT
    expect(result.current.session?.token).toBe('tok-1')
    expect(localStorage.getItem(SESSION_TOKEN_KEY)).toBe('tok-1')
  })

  it("drops only the PIN layer: an owner's email sign-in is kept", async () => {
    localStorage.setItem('pelikn-auth-token', '{"access_token":"owner"}')
    const { result } = renderHook(() => useSession(), { wrapper })
    await waitFor(() => expect(result.current.session?.token).toBe('tok-1'))

    act(() => { registered.ended('tok-1') })

    expect(result.current.session).toBeNull()
    expect(authSignOut).not.toHaveBeenCalled()
    expect(localStorage.getItem('pelikn-auth-token')).toBe('{"access_token":"owner"}')
  })
})
