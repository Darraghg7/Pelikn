import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const leavingState = { byId: {}, missing: false, loading: false, reload: vi.fn() }
const holidayState = { loading: false, failed: false }

vi.mock('../../../hooks/useStaffLeaving', () => ({
  useStaffLeaving: () => leavingState,
  useLeaverHoliday: () => holidayState,
}))
vi.mock('../../../contexts/VenueContext', () => ({ useVenue: () => ({ venueId: 'v1', venueSlug: 'nomad' }) }))
vi.mock('../../../components/ui/Toast', () => ({ useToast: () => vi.fn() }))
vi.mock('../../../lib/time', async (orig) => ({ ...(await orig()), londonToday: () => '2026-10-10' }))

import StaffLeavingCard from '../StaffLeavingCard'

const AOIFE = { id: 's1', name: 'Aoife', is_active: true, employment_type: 'zero_hours' }
const show = (staff = AOIFE) => render(<MemoryRouter><StaffLeavingCard staff={staff} /></MemoryRouter>)

beforeEach(() => {
  leavingState.byId = {}
  leavingState.missing = false
  Object.assign(holidayState, { position: undefined, pay: undefined, hourlyRate: undefined })
})

describe('StaffLeavingCard', () => {
  it('offers "Mark as leaving" to someone active', () => {
    show()
    expect(screen.getByRole('button', { name: 'Mark as leaving' })).toBeTruthy()
  })

  it('shows nothing before migration 152, or for someone already inactive with no leaving record', () => {
    leavingState.missing = true
    const { container, unmount } = show()
    expect(container.textContent).toBe('')
    unmount()
    leavingState.missing = false
    expect(show({ ...AOIFE, is_active: false }).container.textContent).toBe('')
  })

  it('shows hours owed and pounds, and that it switches off automatically', () => {
    leavingState.byId = { s1: { staff_id: 's1', last_day: '2026-10-24', reason: 'resigned', checklist: {} } }
    Object.assign(holidayState, {
      position: { status: 'ok', unit: 'hours', region: 'ni', owed: 18.5, earned: 55.5, used: 37 },
      pay: 231.25, hourlyRate: 12.5,
    })
    show()
    expect(screen.getByText(/18.5 hours owed/)).toBeTruthy()
    expect(screen.getByText(/£231.25/)).toBeTruthy()
    expect(screen.getByText(/Resigned/)).toBeTruthy()
    expect(screen.getByText(/switches their account off the night after/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Switch off/ })).toBeNull()
  })

  it('explains a negative balance and offers to switch off once the last day has come', () => {
    leavingState.byId = { s1: { staff_id: 's1', last_day: '2026-10-10', checklist: { payroll: true } } }
    Object.assign(holidayState, { position: { status: 'ok', unit: 'days', owed: -2, earned: 20, used: 22 }, pay: null })
    show()
    expect(screen.getByText(/Took 2 days too many/)).toBeTruthy()
    expect(screen.getByText(/only take this back from their final pay if their contract allows/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Switch off their account now' })).toBeTruthy()
    expect(/** @type {HTMLInputElement} */ (screen.getByRole('checkbox', { name: /payroll/ })).checked).toBe(true)
  })

  it('asks for the venue region before working out zero-hours holiday', () => {
    leavingState.byId = { s1: { staff_id: 's1', last_day: '2026-10-24', checklist: {} } }
    holidayState.position = { status: 'needs_region' }
    show()
    expect(screen.getByText(/Choose where your venue is/)).toBeTruthy()
  })
})
