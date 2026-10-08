/**
 * Getting a venue JWT from pin-login's issue_jwt action, and telling "the
 * session is gone" (sign the device out) apart from "couldn't reach it" (try
 * again later). Used by SessionContext.
 */
import { supabaseUrl, supabaseAnonKey, SessionEndedError } from './supabase'
import { SESSION_TOKEN_KEY, SESSION_JWT_KEY, SESSION_VENUE_ID_KEY } from './constants'

/**
 * Ask pin-login for a venue-scoped JWT for a staff session token.
 * `ended` is true only when pin-login says the session itself is gone —
 * 401 (deleted, expired, staff deactivated) or 403 (the token belongs to a
 * different venue than the one this device thinks it is in). Anything else
 * (offline, 5xx) is `{ jwt: null, ended: false }`: worth trying again later,
 * never a reason to sign anyone out.
 */
export async function requestVenueJwt(token, venueId) {
  if (!token || !venueId) return { jwt: null, ended: false }
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/pin-login`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey':        supabaseAnonKey,
      },
      body: JSON.stringify({ action: 'issue_jwt', session_token: token, venue_id: venueId }),
    })
    if (res.status === 401 || res.status === 403) return { jwt: null, ended: true }
    if (!res.ok) return { jwt: null, ended: false }
    const { jwt } = await res.json()
    if (jwt) localStorage.setItem(SESSION_JWT_KEY, jwt)
    return { jwt: jwt ?? null, ended: false }
  } catch {
    return { jwt: null, ended: false }
  }
}

/** signIn's use: a JWT for a session that isn't in localStorage yet, or null. */
export async function issueVenueJwt(token, venueId) {
  return (await requestVenueJwt(token, venueId)).jwt
}

/**
 * Registered with the Supabase client as the JWT refresher, so an expiring or
 * rejected venue JWT is renewed without forcing a re-login. Reads token/venue
 * from localStorage each call, so it always reflects the active session
 * (including after a venue switch). Returns null when pin-login can't be
 * reached — the client then falls back to the anon key — and throws
 * SessionEndedError when the session is gone, which sends the device back to
 * the PIN screen (SessionContext's session-ended handler).
 */
export async function refreshVenueJwt() {
  const token = localStorage.getItem(SESSION_TOKEN_KEY)
  const { jwt, ended } = await requestVenueJwt(token, localStorage.getItem(SESSION_VENUE_ID_KEY))
  if (ended) throw new SessionEndedError(token)
  return jwt
}
