/**
 * Characterisation tests for the two rota screens.
 *
 * These render the REAL phone grid (RotaMobileGrid) and the REAL desktop week
 * table (RotaWeekView) against one shared fixture week and pin what each one
 * shows today, including where the two disagree. They were written before the
 * shared rota core (src/lib/rota) existed so the refactor can be checked
 * against them. Where a later PR deliberately changes a behaviour, the
 * expectation is edited in that PR, with the reason in its description.
 */
import React from 'react'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { format, addDays } from 'date-fns'
import { getWeekStart } from '../../../lib/utils'

// ── Fixture: one week, built relative to the current week ───────────────────
const MON = getWeekStart()
const d = (i) => format(addDays(MON, i), 'yyyy-MM-dd')
const WEEK_START = format(MON, 'yyyy-MM-dd')

const ana = { id: 'a1111111-0000-0000-0000-000000000001', name: 'Ana Adult', hourly_rate: 12, is_under_18: false, job_title: 'Chef' }
const ben = { id: 'b2222222-0000-0000-0000-000000000002', name: 'Ben Young', hourly_rate: 10, is_under_18: true, job_title: 'Bar' }
const cat = { id: 'c3333333-0000-0000-0000-000000000003', name: 'Cat Visitor', hourly_rate: 15, is_under_18: false, job_title: 'FOH', _crossVenue: true }
const STAFF = [ana, ben, cat]

let n = 0
const shift = (who, day, start, end, role = 'Chef') => ({
  id: `s${++n}`, venue_id: 'v1', staff_id: who.id, week_start: WEEK_START, shift_date: d(day),
  start_time: `${start}:00`, end_time: `${end}:00`, role_label: role,
  // fetchShifts embeds the person's pay rate on each shift
  staff: { id: who.id, hourly_rate: who.hourly_rate, is_under_18: who.is_under_18 },
})
const SHIFTS = [
  shift(ana, 0, '09:00', '17:00'),               // Mon 8h
  shift(ana, 1, '18:00', '02:00', 'Bar'),        // Tue overnight 8h
  shift(ana, 2, '09:00', '13:00'),               // Wed split, part 1 (4h)
  shift(ana, 2, '17:00', '22:00'),               // Wed split, part 2 (5h)
  shift(ben, 0, '10:00', '15:00', 'Bar'),        // Mon 5h, under 18
  shift(ben, 4, '09:00', '12:00', 'Bar'),        // Fri 3h, on a CLOSED day
]
const UNAVAIL = {
  [`${ana.id}:${d(3)}`]: { type: 'time_off' },   // Ana: Thu on leave
  [`${ben.id}:${d(1)}`]: { type: 'manual', subtype: 'unavailable' },
  [`${ana.id}:${d(0)}`]: { type: 'manual', subtype: 'unavailable' }, // unavailable but has a Mon shift
}
const CLOSED_DATES = new Set([d(4)])             // Fri closed (one-off)
const CROSS = [{ staff_id: cat.id, shift_date: d(5), start_time: '10:00', end_time: '16:00', venue_name: 'Other Place', venue_slug: 'other' }]

// ── Mocks for the phone grid's hooks ────────────────────────────────────────
vi.mock('../../../contexts/VenueContext', () => ({ useVenue: () => ({ venueId: 'v1', venueName: 'Test' }) }))
vi.mock('../../../contexts/ThemeContext', () => ({ useTheme: () => ({ dark: false }) }))
vi.mock('../../../components/ui/Toast', () => ({ useToast: () => vi.fn() }))
vi.mock('../../../lib/sendPush', () => ({ sendPush: vi.fn() }))
vi.mock('../../../lib/reportError', () => ({ reportError: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { value: 'x' }, error: null }) }) }) }) }) },
}))
vi.mock('../../../hooks/useShifts', async (orig) => {
  const actual = await orig()
  return { ...actual, useShifts: () => ({ shifts: globalThis.__SHIFTS, loading: false, isError: false, reload: vi.fn() }), useStaffList: () => ({ staff: globalThis.__STAFF, loading: false, isError: false, reload: vi.fn() }) }
})
vi.mock('../../../hooks/useShiftSwaps', () => ({ useShiftSwaps: () => ({ swaps: [], pendingCount: 0, reload: vi.fn() }) }))
vi.mock('../../../hooks/useAvailability', () => ({ useAvailability: () => ({ unavailability: globalThis.__UNAVAIL }) }))
vi.mock('../../../hooks/useVenueRoles', () => ({ useVenueRoles: () => ({ roles: [] }) }))

import RotaMobileGrid from '../RotaMobileGrid'
import RotaWeekView from '../RotaWeekView'

beforeEach(() => {
  globalThis.__SHIFTS = SHIFTS
  globalThis.__STAFF = STAFF
  globalThis.__UNAVAIL = UNAVAIL
})

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim()

// ── Phone grid ──────────────────────────────────────────────────────────────
describe('phone rota grid (RotaMobileGrid) — week view', () => {
  const renderPhone = async () => {
    const utils = render(<RotaMobileGrid />)
    await waitFor(() => expect(screen.getByText('Ana A.')).toBeTruthy())
    return utils
  }
  // The phone shows first names through shortName(); each person is a row.
  const rowFor = (name) => screen.getByText(name).closest('div.flex.items-center')

  it('shows RAW hours per person (no break taken off) and the week total in the header', async () => {
    await renderPhone()
    expect(text(rowFor('Ana A.'))).toContain('25h')      // 8 + 8 + 4 + 5
    expect(text(rowFor('Ben Y.'))).toContain('8h')       // 5 + 3, break NOT deducted
    expect(text(screen.getByText(/ – /).closest('div'))).toContain('33h') // header total
  })

  it('shows cost using a fixed 30-minute break, ignoring under-18 and the venue setting', async () => {
    await renderPhone()
    fireEvent.click(screen.getByRole('radio', { name: '£' }))
    // Ana: 7.5 + 7.5 + 4 + 5 = 24h paid × £12 = £288
    expect(text(rowFor('Ana A.'))).toContain('£288')
    // Ben (under 18 but treated as adult here): 5h → no break (adult rule needs >6h), 3h → 8h × £10 = £80
    expect(text(rowFor('Ben Y.'))).toContain('£80')
  })

  it('counts split shifts as separate "on" entries in the day footer', async () => {
    await renderPhone()
    // Wednesday has ONE person on two shifts; the phone footer says 2 on
    expect(screen.getAllByText('2 on').length).toBeGreaterThan(0)
  })

  it('shows only one shift per person per day in the grid (split shift: the later one wins)', async () => {
    await renderPhone()
    const wedButtons = screen.getAllByRole('button').filter((b) => /Ana Adult, .*Wednesday/.test(b.getAttribute('aria-label') ?? ''))
    expect(wedButtons).toHaveLength(1)
    expect(wedButtons[0].getAttribute('aria-label')).toContain('17 to 22')
  })

  it('shows "Leave" for approved time off with no shift', async () => {
    await renderPhone()
    expect(screen.getAllByText('Leave').length).toBe(1)
  })

  it('does NOT know about closed days: Friday shift shows and can be added to', async () => {
    await renderPhone()
    const friday = screen.getAllByRole('button').find((b) => /Ben Young, Friday/.test(b.getAttribute('aria-label') ?? ''))
    expect(friday.getAttribute('aria-label')).toContain('9 to 12')
    expect(screen.getAllByRole('button').some((b) => /Add shift, Ana Adult, Friday/.test(b.getAttribute('aria-label') ?? ''))).toBe(true)
  })

  it('shows no marker for a shift on a day the person marked unavailable', async () => {
    await renderPhone()
    expect(document.body.textContent).not.toMatch(/Unavail/i)
  })

  it('shows no "busy elsewhere" marker for the visiting person', async () => {
    await renderPhone()
    expect(document.body.textContent).not.toMatch(/Busy|Visiting/)
  })
})

// ── Desktop table ───────────────────────────────────────────────────────────
describe('desktop rota table (RotaWeekView)', () => {
  const renderDesktop = () => {
    render(
      <RotaWeekView
        weekStart={MON}
        shifts={SHIFTS}
        staff={STAFF}
        onCellClick={vi.fn()}
        onToggleAvailability={vi.fn()}
        isManager
        unavailability={UNAVAIL}
        closedDays={[]}
        closedDates={CLOSED_DATES}
        breakDurationMins={45}
        crossShifts={CROSS}
      />
    )
    return screen.getByRole('table')
  }
  const row = (table, name) => within(table).getByText(name).closest('tr')

  it('shows PAID hours and cost per person using the venue break setting and the under-18 rule', () => {
    const t = renderDesktop()
    // Ana: Mon 8h−45m = 7.25, Tue 8h−45m = 7.25, Wed 4 + 5 = 9 → 23.5h × £12 = £282
    expect(text(row(t, 'Ana Adult'))).toContain('£282.00')
    expect(text(row(t, 'Ana Adult'))).toContain('23.5h paid')
    expect(text(row(t, 'Ana Adult'))).toContain('2 × 45m breaks (90m)')
    // Ben (under 18): Mon 5h > 4.5 → 30m break → 4.5h; Fri 3h → 7.5h × £10 = £75 (Fri is closed but still costed)
    expect(text(row(t, 'Ben Young'))).toContain('£75.00')
    expect(text(row(t, 'Ben Young'))).toContain('7.5h paid')
  })

  it('shows the weekly wage bill as the sum of every person (closed-day shifts included)', () => {
    const t = renderDesktop()
    expect(within(t).getByText('Total weekly wage bill').closest('tr').textContent).toContain('£357.00')
  })

  it('lists both halves of a split shift in the same cell', () => {
    const t = renderDesktop()
    const wed = row(t, 'Ana Adult').querySelectorAll('td')[3]
    expect(text(wed)).toContain('09:00–13:00')
    expect(text(wed)).toContain('17:00–22:00')
  })

  it('greys out a closed date and hides the shift on it', () => {
    const t = renderDesktop()
    const fri = row(t, 'Ben Young').querySelectorAll('td')[5]
    expect(text(fri)).not.toContain('09:00')
    expect(within(t).getAllByText('Closed').length).toBe(1)
  })

  it('shows time off, manual unavailability, a clash warning and the visiting-person busy cell', () => {
    const t = renderDesktop()
    expect(within(t).getByText('Time Off')).toBeTruthy()
    expect(within(t).getByText('Unavail')).toBeTruthy()
    expect(within(t).getByText('Visiting')).toBeTruthy()
    expect(within(t).getByText('Other Place')).toBeTruthy()
    // Ana has a Monday shift on a day she marked unavailable → "!" badge
    expect(row(t, 'Ana Adult').textContent).toContain('!')
  })
})
