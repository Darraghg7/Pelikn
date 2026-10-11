import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

const addPaidOut = vi.fn((_row) => Promise.resolve({ error: null }))
const removePaidOut = vi.fn(() => Promise.resolve({ error: null }))
const addCarryOver = vi.fn((_row) => Promise.resolve({ error: null }))
const removeCarryOver = vi.fn(() => Promise.resolve({ error: null }))
vi.mock('../../../lib/api/holidayData', () => ({ addPaidOut, removePaidOut, addCarryOver, removeCarryOver }))
const lastYear = { left: null }
vi.mock('../../../hooks/useHolidayBalances', () => ({ useLastYearLeft: () => lastYear.left }))
vi.mock('../../../lib/supabase', () => ({ supabase: {} }))
vi.mock('../../../components/ui/Toast', () => ({ useToast: () => vi.fn() }))

const { default: ManualLeaveModal } = await import('../ManualLeaveModal')
const { holidayYearStarting } = await import('../../../lib/holidayYear')

const sarah = { id: 'sarah', name: 'Sarah', employment_type: 'zero_hours', working_days: [4, 5, 6, 7] }
const tom   = { id: 'tom', name: 'Tom', employment_type: 'full_time', working_days: [1, 2, 3, 4, 5] }
const props = { holiday: null, holidayYear: holidayYearStarting(2026, 1), venueId: 'v1', managerId: 'mgr', onClose: vi.fn(), onSaved: vi.fn() }

describe('Holiday already paid', () => {
  beforeEach(() => { addPaidOut.mockClear(); removePaidOut.mockClear(); props.onSaved.mockClear() })

  it('records hours for a zero-hours worker', async () => {
    render(<ManualLeaveModal {...props} staff={sarah} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Holiday already paid' }))
    fireEvent.change(screen.getByLabelText('Hours paid'), { target: { value: '20' } })
    fireEvent.change(screen.getByLabelText('Note (optional)'), { target: { value: 'Paid in July payroll' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Record holiday already paid' })) })
    expect(addPaidOut).toHaveBeenCalledWith({
      venue_id: 'v1', staff_id: 'sarah', leave_year: 2026, hours: 20,
      paid_on: null, note: 'Paid in July payroll', created_by: 'mgr',
    })
    expect(props.onSaved).toHaveBeenCalled()
  })

  it('records days for someone with a days-based allowance', async () => {
    render(<ManualLeaveModal {...props} staff={tom} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Holiday already paid' }))
    fireEvent.change(screen.getByLabelText('Days paid'), { target: { value: '3' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Record holiday already paid' })) })
    expect(addPaidOut).toHaveBeenCalledWith(expect.objectContaining({ staff_id: 'tom', days: 3 }))
    expect(addPaidOut.mock.calls[0][0]).not.toHaveProperty('hours')
  })

  it('lists what is already recorded and can remove it', async () => {
    render(<ManualLeaveModal {...props} staff={sarah} paidOut={[{ id: 'p1', hours: 20, days: null, paid_on: '2026-07-31', note: 'July payroll' }]} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Holiday already paid' }))
    expect(screen.getByText('20 h')).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Remove' })) })
    expect(removePaidOut).toHaveBeenCalledWith('p1')
  })
})

describe('Carry over', () => {
  const april = holidayYearStarting(2026, 4)
  beforeEach(() => { addCarryOver.mockClear(); removeCarryOver.mockClear(); props.onSaved.mockClear(); lastYear.left = null })

  it('suggests what was left last holiday year and records it with who and a note', async () => {
    lastYear.left = { hours: 12.5, yearLabel: 'Apr 2025 – Mar 2026' }
    render(<ManualLeaveModal {...props} holidayYear={april} staff={sarah} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Carry over' }))
    expect(screen.getByText(/12.5 h left at the end of Apr 2025 – Mar 2026/)).toBeTruthy()
    expect(/** @type {HTMLInputElement} */ (screen.getByLabelText('Hours to carry over')).value).toBe('12.5')
    fireEvent.change(screen.getByLabelText('Note (optional)'), { target: { value: 'Agreed with Sarah' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Carry over' })) })
    expect(addCarryOver).toHaveBeenCalledWith({
      venue_id: 'v1', staff_id: 'sarah', leave_year: 2026, hours: 12.5, note: 'Agreed with Sarah', created_by: 'mgr',
    })
    expect(props.onSaved).toHaveBeenCalled()
  })

  it('carries days for someone with a days-based allowance, and the manager can change the figure', async () => {
    lastYear.left = { days: 4, yearLabel: '2025' }
    render(<ManualLeaveModal {...props} staff={tom} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Carry over' }))
    fireEvent.change(screen.getByLabelText('Days to carry over'), { target: { value: '2' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Carry over' })) })
    expect(addCarryOver).toHaveBeenCalledWith(expect.objectContaining({ staff_id: 'tom', days: 2, note: null }))
    expect(addCarryOver.mock.calls[0][0]).not.toHaveProperty('hours')
  })

  it('shows an existing carry-over with who recorded it, and can remove it', async () => {
    const row = { id: 'c1', hours: 6, days: null, note: null, created_at: '2026-04-03T09:00:00Z', creator: { name: 'Aoife' } }
    render(<ManualLeaveModal {...props} holidayYear={april} staff={sarah} carryOver={[row]} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Carry over' }))
    expect(screen.getByText('6 h')).toBeTruthy()
    expect(screen.getByText(/by Aoife, 3 Apr 2026/)).toBeTruthy()
    expect(screen.queryByLabelText('Hours to carry over')).toBeNull()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Remove' })) })
    expect(removeCarryOver).toHaveBeenCalledWith('c1')
  })
})
