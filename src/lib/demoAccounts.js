/**
 * Demo logins and the venues they may see.
 *
 * The database is what actually enforces this (migration 141: demo_accounts,
 * a trigger on venues, and has_venue_access). A demo login can't own, create
 * or read any other venue whatever the client sends. This copy only keeps the
 * venue picker tidy, so it's harmless if it falls out of date.
 *
 * The emails are Supabase auth account identifiers, not links, so dead
 * domains here don't matter. The live demo login is demo@safeserv.com. The
 * other three have no auth account today; they stay listed in case one is
 * recreated, and renaming them would NOT rename any account.
 */
export const DEMO_EMAILS = ['demo@safeserv.com', 'demo@pelikn.app', 'demo@saveserv.com', 'demopro@pelikn.com']
export const DEMO_SLUGS  = ['brew-and-bloom', 'the-corner-cup']

export const isDemoEmail = (email) =>
  !!email && DEMO_EMAILS.includes(email.trim().toLowerCase())

/** Venues a login should be offered: demo logins only ever get demo venues. */
export const visibleVenuesFor = (email, venues) =>
  isDemoEmail(email) ? (venues ?? []).filter(v => DEMO_SLUGS.includes(v.slug)) : (venues ?? [])
