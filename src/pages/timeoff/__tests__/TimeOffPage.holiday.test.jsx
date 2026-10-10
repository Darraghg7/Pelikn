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
vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => ({ session: { staffId: 'mgr', staffName: 'Manager' }, isManager: true }),
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
  useOwnProfile: () => null,
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
  beforeEach(() => { update.mockClear(); eq.mockClear() })

  it('shows hours left, not hours earned, and flags overdrawn, estimated and missing clock-outs', () => {
    renderPage()
    expect(screen.getByText('63.2 h')).toBeTruthy()            // Sarah: left, after leave
    expect(screen.getByText('13.7 h used of 76.9 h', { exact: false })).toBeTruthy()
    expect(screen.getByText('−17.8 h')).toBeTruthy()           // Catherine overdrawn, shown negative
    expect(screen.getByText(/estimated/)).toBeTruthy()
    expect(screen.getByText(/2 shifts missing a clock-out/)).toBeTruthy()
    expect(screen.getByText('Self-employed')).toBeTruthy()     // Blathnaid
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
