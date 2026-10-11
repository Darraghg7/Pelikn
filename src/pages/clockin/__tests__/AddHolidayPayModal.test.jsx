import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

const addPaidOut = vi.fn((_row) => Promise.resolve({ error: null }))
vi.mock('../../../lib/api/holidayData', () => ({ addPaidOut: (row) => addPaidOut(row) }))
vi.mock('../../../components/ui/Toast', () => ({ useToast: () => vi.fn() }))
vi.mock('../../../hooks/useHolidayBalances', () => ({
  useHolidayBalances: () => ({ byId: { sarah: { status: 'ok', avgWeekHours: 20, balance: 30 } } }),
}))

const { default: AddHolidayPayModal } = await import('../AddHolidayPayModal')

const props = {
  people: [{ id: 'sarah', name: 'Sarah', working_days: [4, 5, 6], holiday_pay_eligible: true }],
  rates: { sarah: 12 },
  venueId: 'v1',
  managerId: 'mgr',
  periodFrom: '2026-12-21',
  periodTo: '2026-12-27',
  defaultDate: '2026-12-24',
  holidayYearStartMonth: 1,
  onClose: vi.fn(),
  onSaved: vi.fn(),
}

describe('AddHolidayPayModal', () => {
  beforeEach(() => { addPaidOut.mockClear(); props.onSaved.mockClear() })

  it('pays a share of their average week and saves it flagged for the timesheet', async () => {
    render(<AddHolidayPayModal {...props} />)
    fireEvent.change(screen.getByLabelText('Who'), { target: { value: 'sarah' } })
    fireEvent.click(screen.getByRole('button', { name: /50% of a week/ }))
    expect(/** @type {HTMLInputElement} */ (screen.getByLabelText('Hours to pay')).value).toBe('10')
    expect(screen.getByText('£120.00')).toBeTruthy()
    expect(screen.getByText('20 h of holiday left this year after this')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Note (optional)'), { target: { value: 'Christmas closure' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add holiday pay' })) })
    expect(addPaidOut).toHaveBeenCalledWith({
      venue_id: 'v1', staff_id: 'sarah', leave_year: 2026, hours: 10,
      paid_on: '2026-12-24', note: 'Christmas closure', created_by: 'mgr', on_timesheet: true,
    })
    expect(props.onSaved).toHaveBeenCalled()
  })

  it('needs a person and some hours before it can be saved', () => {
    render(<AddHolidayPayModal {...props} />)
    expect(/** @type {HTMLButtonElement} */ (screen.getByRole('button', { name: 'Add holiday pay' })).disabled).toBe(true)
  })
})
