/**
 * Clock-in rules — where and on what a clock-in / clock-out is allowed (157).
 *
 * The server is the authority (record_clock_event checks the same rules); this
 * file lets the phone refuse early with a useful message instead of waiting
 * for the server to say no, and works out what to send along with a punch.
 *
 * Two opt-in rules per venue:
 *   • location — the phone must be within radius_m of the venue's saved point
 *   • device   — the punch must come from the one registered tablet
 * With the tablet rule on, the tablet alone decides and GPS is not asked for.
 * Breaks are never gated.
 */

export const GATED_EVENTS = ['clock_in', 'clock_out']

/** Mirrors the server: a position this loose can't tell the cafe from the car park. */
export const MAX_ACCURACY_M = 100

export const RULES_OFF = {
  require_location: false,
  latitude: null,
  longitude: null,
  radius_m: 50,
  require_device: false,
  device_id: null,
  device_name: null,
  device_registered_at: null,
}

/** Great-circle distance in metres between two { latitude, longitude } points. */
export function distanceMetres(a, b) {
  const rad = (d) => (d * Math.PI) / 180
  const h =
    Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) *
    Math.sin(rad(b.longitude - a.longitude) / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

// ── The tablet's secret ─────────────────────────────────────────────────────
// Kept in localStorage on the tablet only. Losing it (cleared site data) just
// means the tablet has to be registered again from Settings.

const tabletKey = (venueId) => `pelikn_clock_device_${venueId}`

/** @returns {{ device_id: string, token: string } | null} */
export function getTabletCredentials(venueId) {
  if (!venueId) return null
  try {
    const raw = localStorage.getItem(tabletKey(venueId))
    if (!raw) return null
    const d = JSON.parse(raw)
    return d?.device_id && d?.token ? d : null
  } catch { return null }
}

export function saveTabletCredentials(venueId, creds) {
  try { localStorage.setItem(tabletKey(venueId), JSON.stringify(creds)) } catch { /* storage unavailable */ }
}

export function clearTabletCredentials(venueId) {
  try { localStorage.removeItem(tabletKey(venueId)) } catch { /* storage unavailable */ }
}

/** True when this device holds the credentials of the venue's registered tablet. */
export function isThisTablet(rules, venueId) {
  const creds = getTabletCredentials(venueId)
  return !!creds && !!rules?.device_id && creds.device_id === rules.device_id
}

// ── Position ────────────────────────────────────────────────────────────────

/**
 * One position fix. Rejects with an Error whose message is fit to show staff.
 * @returns {Promise<{ latitude: number, longitude: number, accuracy: number }>}
 */
export function getPosition({ timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error("This device can't share its location."))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({
        latitude: p.coords.latitude,
        longitude: p.coords.longitude,
        accuracy: p.coords.accuracy,
      }),
      (err) => {
        if (err.code === 1) reject(new Error('Location is switched off for Pelikn. Allow it in your settings to clock in.'))
        else if (err.code === 3) reject(new Error("Couldn't get your location in time. Try again."))
        else reject(new Error("Couldn't find your location. Try again."))
      },
      { enableHighAccuracy: true, timeout, maximumAge: 10000 },
    )
  })
}

// ── The decision ────────────────────────────────────────────────────────────

/**
 * Does this rule need a position for this event? (False means the caller can
 * skip asking the phone for one.)
 */
export function needsPosition(rules, eventType) {
  if (!GATED_EVENTS.includes(eventType)) return false
  if (rules.require_device) return false
  return !!rules.require_location && rules.latitude != null && rules.longitude != null
}

/**
 * Decide whether a punch may go ahead, and what to send with it.
 *
 * @param {object} p
 * @param {typeof RULES_OFF} p.rules
 * @param {string} p.eventType
 * @param {string | null} p.venueId
 * @param {{ latitude: number, longitude: number, accuracy: number } | null} [p.position]
 * @returns {{ ok: boolean, message?: string, args: Record<string, unknown> }}
 */
export function decideClockRules({ rules, eventType, venueId, position = null }) {
  if (!GATED_EVENTS.includes(eventType)) return { ok: true, args: {} }

  if (rules.require_device) {
    const creds = getTabletCredentials(venueId)
    if (!creds || creds.device_id !== rules.device_id) {
      return { ok: false, message: `Clock in on ${rules.device_name || 'the venue tablet'}.`, args: {} }
    }
    return { ok: true, args: { p_device_token: creds.token } }
  }

  if (needsPosition(rules, eventType)) {
    if (!position) return { ok: false, message: 'Turn on location to clock in.', args: {} }
    if (position.accuracy > MAX_ACCURACY_M) {
      return { ok: false, message: 'Your location is not precise enough yet. Try again in a moment.', args: {} }
    }
    if (distanceMetres(position, rules) > rules.radius_m) {
      return { ok: false, message: 'You need to be at the venue to clock in.', args: {} }
    }
    return {
      ok: true,
      args: {
        p_latitude: position.latitude,
        p_longitude: position.longitude,
        p_accuracy_m: position.accuracy,
      },
    }
  }

  return { ok: true, args: {} }
}

/** Short line for the clock card when the rules mean this device can't punch at all. */
export function clockBlockedNotice(rules, venueId) {
  if (rules.require_device && !isThisTablet(rules, venueId)) {
    return `Clock in on ${rules.device_name || 'the venue tablet'}.`
  }
  return null
}
