import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * The zero-hours holiday rows can't be seen in a local preview (the dev session
 * has no venue data), so they are checked here with the data hooks mocked.
 */

const update = vi.fn()
const eq = vi.fn()

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: (patch) => { update(patch); return { eq: (...a) => { eq(...a); return Promise.resolve({ error: null }) } } },
    }),
  },
}))
vi.mock('../../../lib/sendPush', () => ({ sendPush: vi.fn() }))
vi.mock('../../../contexts/VenueContext', () => ({ useVenue: () => ({ venueId: 'v1', venueSlug: 'nomad' }) }))
const who = { session: { staffId: 'mgr', staffName: 'Manager' }, isManager: true, own: null }
vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => ({ session: who.session, isManager: who.isManager }),
}))
vi.mock('../../../components/ui/Toast', () => ({ useToast: () => vi.fn() }))
vi.mock('../../../hooks/useSettings', () => ({ useAppSettings: () => ({ maxStaffOffEnabled: false, maxStaffOffCount: 1 }) }))
vi.mock('../../../hooks/useTodaySummary', () => ({ invalidateSummaryCache: vi.fn() }))

const sarah = { id: 'sarah', name: 'Sarah', employment_type: 'zero_hours', working_days: [4, 5, 6, 7], holiday_pay_eligible: true }
const eve   = { id: 'eve',   name: 'Eve',   employment_type: 'zero_hours', working_days: [], holiday_pay_eligible: true }
const cat   = { id: 'cat',   name: 'Catherine', employment_type: 'zero_hours', working_days: [], holiday_pay_eligible: true }
const blath = { id: 'blath', name: 'Blathnaid', employment_type: 'zero_hours', working_days: [], holiday_pay_eligible: false }

const pending = {
  id: 'req1', staff_id: 'sarah', status: 'pending', leave_type: 'annual',
  start_date: '2026-11-09', end_date: '2026-11-15', staff: { name: 'Sarah', working_days: [4, 5, 6, 7], employment_type: 'zero_hours' },
}

vi.mock('../../../hooks/useTimeOffData', () => ({
  useTimeOffRequests: () => ({ requests: [pending], loading: false, error: null, reload: vi.fn() }),
  useActiveStaff: () => [sarah, eve, cat, blath],
  useOwnProfile: () => who.own,
  useTeamLeaveBalances: (staff) => ({
    balances: staff.map(s => ({ ...s, isZeroHours: true, entitlement: null, used: 0, remaining: null })),
    loading: false, failed: false, reloadBalances: vi.fn(),
  }),
}))

const ok = (o) => ({ status: 'ok', region: 'ni', usedIsEstimate: false, missingClockOuts: 0, firstYear: false, ...o })
vi.mock('../../../hooks/useHolidayBalances', () => ({
  HOLIDAY_BALANCES_KEY: 'holiday-balances',
  // Sarah was already on the rota for the Saturday of her week off: 8 h
  useRotaHours: () => ({ sarah: { '2026-11-14': 8 } }),
  usePaidOut: () => ({}),
  useHolidayBalances: (list) => ({
    byId: list.length ? {
      sarah: ok({ allowance: 76.9, used: 13.7, balance: 63.2, avgWeekHours: 13.7 }),
      eve:   ok({ allowance: 46.9, used: 0, balance: 46.9, avgWeekHours: 8.4, missingClockOuts: 2 }),
      cat:   ok({ allowance: 41.2, used: 59, balance: -17.8, avgWeekHours: 16.8, usedIsEstimate: true }),
      blath: { status: 'self_employed' },
    } : {},
    loading: false, failed: false, reload: vi.fn(),
  }),
}))

const { default: TimeOffPage } = await import('../TimeOffPage')

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter><TimeOffPage /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Time Off page — zero-hours holiday', () => {
  beforeEach(() => {
    update.mockClear(); eq.mockClear()
    Object.assign(who, { session: { staffId: 'mgr', staffName: 'Manager' }, isManager: true, own: null })
  })

  it('a staff member sees just their holiday left', () => {
    Object.assign(who, { session: { staffId: 'sarah', staffName: 'Sarah' }, isManager: false, own: sarah })
    renderPage()
    expect(screen.getByText('63.2 h')).toBeTruthy()
    expect(screen.getByText('holiday left')).toBeTruthy()
    expect(screen.queryByText(/used of/)).toBeNull()
  })

  it('shows just the hours left for each person, negative when overdrawn', () => {
    renderPage()
    expect(screen.getByText('63.2 h left')).toBeTruthy()       // Sarah: left, after leave
    expect(screen.getByText('−17.8 h left')).toBeTruthy()      // Catherine overdrawn, shown negative
    expect(screen.getByText('46.9 h left')).toBeTruthy()       // Eve
    expect(screen.getByText('Self-employed')).toBeTruthy()     // Blathnaid
    // The working behind the number isn't on this list any more
    expect(screen.queryByText(/used of/)).toBeNull()
    expect(screen.queryByText(/5\.6 ×/)).toBeNull()
    expect(screen.queryByText(/missing a clock-out/)).toBeNull()
  })

  it('asks the manager for the hours to pay and saves them on approval', async () => {
    renderPage()
    // Thu–Sun worker, Mon–Sun booked: the rota'd Saturday is 8 h, the other
    // three usual days a quarter of her 13.7 h week each → 8 + 10.3 = 18.3
    const box = /** @type {HTMLInputElement} */ (screen.getByLabelText(/Holiday hours to pay Sarah/))
    expect(box.value).toBe('18.3')
    fireEvent.change(box, { target: { value: '12' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Approve' })) })
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved', paid_hours: 12 }))
    expect(eq).toHaveBeenCalledWith('id', 'req1')
  })
})
