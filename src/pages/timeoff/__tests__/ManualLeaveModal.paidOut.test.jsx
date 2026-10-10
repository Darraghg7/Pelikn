import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

const addPaidOut = vi.fn((_row) => Promise.resolve({ error: null }))
const removePaidOut = vi.fn(() => Promise.resolve({ error: null }))
vi.mock('../../../lib/api/holidayData', () => ({ addPaidOut, removePaidOut }))
vi.mock('../../../lib/supabase', () => ({ supabase: {} }))
vi.mock('../../../components/ui/Toast', () => ({ useToast: () => vi.fn() }))

const { default: ManualLeaveModal } = await import('../ManualLeaveModal')

const sarah = { id: 'sarah', name: 'Sarah', employment_type: 'zero_hours', working_days: [4, 5, 6, 7] }
const tom   = { id: 'tom', name: 'Tom', employment_type: 'full_time', working_days: [1, 2, 3, 4, 5] }
const props = { holiday: null, year: 2026, venueId: 'v1', managerId: 'mgr', onClose: vi.fn(), onSaved: vi.fn() }

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
