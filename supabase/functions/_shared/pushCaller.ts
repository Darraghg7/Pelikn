// Resolve who is sending a push, for the rules in pushRules.ts.
// `db` is a service-role client; the session token is checked against the
// venue first, so a token from another venue gets nothing.

// deno-lint-ignore no-explicit-any
export async function resolvePushCaller(db: any, sessionToken: string, venueId: string) {
  const { data: allowed, error: authErr } = await db.rpc('validate_staff_session_for_venue', {
    p_session_token: sessionToken,
    p_venue_id:      venueId,
  })
  if (authErr) throw authErr
  if (!allowed) return null

  const [{ data: session }, { data: venue }] = await Promise.all([
    db.from('staff_sessions').select('staff(role)').eq('token', sessionToken).maybeSingle(),
    db.from('venues').select('slug').eq('id', venueId).maybeSingle(),
  ])
  return {
    role: (session?.staff?.role as string | undefined) ?? null,
    venueSlug: (venue?.slug as string | undefined) ?? null,
  }
}
