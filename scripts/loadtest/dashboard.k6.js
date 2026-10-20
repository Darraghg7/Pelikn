/**
 * Load test: what a venue's devices ask the database for while the dashboard
 * is open. Run it against a COPY of the project (a Supabase branch or a
 * separate staging project), never production. It refuses to run otherwise.
 *
 *   k6 run -e BASE_URL=https://<staging-ref>.supabase.co \
 *          -e ANON_KEY=<staging anon key> \
 *          -e SESSIONS=scripts/loadtest/sessions.json \
 *          -e VENUES=500 \
 *          scripts/loadtest/dashboard.k6.js
 *
 * sessions.json (not committed): [{ "jwt": "...", "venueId": "...", "staffId": "...", "fridgeId": "..." }, ...]
 * minted from staging PIN logins; each venue should appear a few times (a
 * manager plus a couple of staff devices).
 *
 * Each virtual user = one device. It opens the dashboard (the two RPCs the app
 * calls on open) then repeats the background refresh the app does, at the same
 * cadence (team status ~60 s, summary on a ~5 s debounce after a change),
 * and occasionally writes a log. Pass criteria are in `thresholds`.
 *
 * Install k6: brew install k6
 */
import http from 'k6/http'
import { check, sleep } from 'k6'
import { SharedArray } from 'k6/data'

const BASE = __ENV.BASE_URL
const ANON = __ENV.ANON_KEY
if (!BASE || !ANON) throw new Error('Set BASE_URL and ANON_KEY')
if (!__ENV.ALLOW_PROD && !/(staging|branch|loadtest)/i.test(BASE) && !__ENV.I_AM_SURE_THIS_IS_NOT_PRODUCTION) {
  throw new Error('BASE_URL does not look like a staging project. Set I_AM_SURE_THIS_IS_NOT_PRODUCTION=1 only if it really is a copy.')
}

const sessions = new SharedArray('sessions', () => JSON.parse(open(__ENV.SESSIONS || './sessions.json')))
const VENUES = Number(__ENV.VENUES || 100)

export const options = {
  scenarios: {
    devices: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: VENUES * 2 },   // ~2 devices per venue
        { duration: '10m', target: VENUES * 2 },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed:   ['rate<0.01'],
    http_req_duration: ['p(95)<800', 'p(99)<2000'],
  },
}

function headers(jwt) {
  return { apikey: ANON, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' }
}

function rpc(name, body, jwt) {
  const res = http.post(`${BASE}/rest/v1/rpc/${name}`, JSON.stringify(body), { headers: headers(jwt), tags: { name } })
  check(res, { [`${name} ok`]: (r) => r.status === 200 })
  return res
}

export default function () {
  const s = sessions[(__VU - 1) % sessions.length]
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const dayStart = `${today}T00:00:00Z`
  const dayEnd = `${today}T23:59:59Z`
  const week = (d) => d.toISOString().slice(0, 10)
  const plus = (days) => week(new Date(now.getTime() + days * 86400000))

  // Open: the dashboard summary and the team status.
  const summary = () => rpc('get_dashboard_snapshot', {
    p_venue_id: s.venueId, p_date: today, p_day_start: dayStart, p_day_end: dayEnd, p_active_periods: ['am', 'pm'],
  }, s.jwt)
  const team = () => rpc('get_team_status', {
    p_venue_id: s.venueId, p_day_start: dayStart, p_day_end: dayEnd, p_today: today,
    p_training_until: plus(30), p_week_from: plus(-3), p_week_to: plus(3),
    p_rota_key: `rota_published_${plus(-3)}`, p_calendar_from: today, p_calendar_to: plus(14),
  }, s.jwt)
  summary(); team()

  // Stay open: refresh like the app does (jittered).
  for (let i = 0; i < 10; i++) {
    sleep(60 * (1 + Math.random() * 0.25))
    team()
    // One write in four iterations: a fridge temperature log, then the
    // summary refresh that follows it.
    if (s.fridgeId && Math.random() < 0.25) {
      http.post(`${BASE}/rest/v1/fridge_temperature_logs`, JSON.stringify({
        venue_id: s.venueId, fridge_id: s.fridgeId, logged_by: s.staffId, temperature: 3.5, logged_at: new Date().toISOString(),
      }), { headers: { ...headers(s.jwt), Prefer: 'return=minimal' }, tags: { name: 'write_fridge_log' } })
      sleep(5)
      summary()
    }
  }
}
