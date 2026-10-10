import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../../../components/ui/Toast', () => ({ useToast: () => vi.fn() }))
const mockAdd = vi.fn(async (_row) => ({ error: null }))
vi.mock('../../../lib/api/holidayPay', async (importOriginal) => ({
  ...(await importOriginal()),
  addBalanceAdjustment: (row) => mockAdd(row),
  removeBalanceAdjustment: vi.fn(async () => ({ error: null })),
}))

const { default: BalanceAdjustModal } = await import('../BalanceAdjustModal')

const balance = {
  id: 's1', name: 'Sam', carriedOver: 0, paidOut: 0, adjustments: [],
  // one 8-hour day of holiday already allocated
  leaveDays: [{ requestId: 'r1', date: '2026-05-14', isWorkingDay: true, allocationId: 'a1', allocatedHours: 8 }],
}
const leaveYear = { startYear: 2026, from: '2026-01-01', to: '2026-12-31', label: '2026' }

describe('BalanceAdjustModal', () => {
  beforeEach(() => { mockAdd.mockClear() })

  it('pays out every hour left, dated, for this holiday year', async () => {
    render(<BalanceAdjustModal balance={balance} accrual={{ accrued: 20, avgDailyHours: 7 }} leaveYear={leaveYear}
      available venueId="v1" managerId="m1" onClose={() => {}} onSaved={() => {}} />)
    expect(screen.getByText('12 h left')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Pay out' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pay out all 12 h' }))
    expect(screen.getByText('0 h left after this.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Pay out hours' }))
    await waitFor(() => expect(mockAdd).toHaveBeenCalled())
    expect(mockAdd.mock.calls[0][0]).toMatchObject({
      venue_id: 'v1', staff_id: 's1', leave_year: 2026, kind: 'payout', hours: 12, created_by: 'm1',
    })
    expect(mockAdd.mock.calls[0][0].pay_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('carries hours over with no pay date', async () => {
    render(<BalanceAdjustModal balance={balance} accrual={{ accrued: 20, avgDailyHours: 7 }} leaveYear={leaveYear}
      available venueId="v1" managerId="m1" onClose={() => {}} onSaved={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText('e.g. 8'), { target: { value: '10' } })
    expect(screen.getByText('22 h left after this.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Carry over hours' }))
    await waitFor(() => expect(mockAdd).toHaveBeenCalled())
    expect(mockAdd.mock.calls[0][0]).toMatchObject({ kind: 'carry_over', hours: 10, pay_date: null })
  })

  it('cannot save until the database update is applied', () => {
    render(<BalanceAdjustModal balance={balance} accrual={{ accrued: 20, avgDailyHours: 7 }} leaveYear={leaveYear}
      available={false} venueId="v1" managerId="m1" onClose={() => {}} onSaved={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText('e.g. 8'), { target: { value: '10' } })
    expect(screen.getByRole('button', { name: 'Carry over hours' }).hasAttribute('disabled')).toBe(true)
  })
})
