import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockToast = vi.fn()
vi.mock('../../../components/ui/Toast', () => ({ useToast: () => mockToast }))
const mockAllocate = vi.fn(async (_rows) => ({ error: null }))
vi.mock('../../../lib/api/holidayPay', () => ({
  allocateHolidayPay: (rows) => mockAllocate(rows),
  removeHolidayAllocations: vi.fn(async () => ({ error: null })),
}))

const { AllocateHolidayModal } = await import('../HolidayPaySection')

const row = {
  staffId: 's1', name: 'Sam', hourlyRate: 12,
  days: [
    { requestId: 'r1', staffId: 's1', date: '2026-10-15', isWorkingDay: true, allocationId: null, allocatedHours: null },
    { requestId: 'r1', staffId: 's1', date: '2026-10-16', isWorkingDay: true, allocationId: null, allocatedHours: null },
  ],
}

describe('AllocateHolidayModal', () => {
  beforeEach(() => { mockAllocate.mockClear() })

  it('shows the balance before and after, then saves the hours entered', async () => {
    const onSaved = vi.fn()
    // 20 h earned; the two booked days are already estimated in `used` at 6.5 h each
    const loadBalance = async () => ({ accrued: 20, used: 13, avgDailyHours: 6.5 })
    render(
      <AllocateHolidayModal row={row} venueId="v1" managerId="m1" locked={false} suggestedHours={8}
        loadBalance={loadBalance} onClose={() => {}} onSaved={onSaved} />,
    )
    await screen.findByText('7 h')
    // 20 − (13 − 13 estimated + 16 allocated) = 4
    expect(screen.getByText('4 h left after this.')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Hours for Fri 16 Oct'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: /Allocate 8 h \(£96\.00\)/ }))
    await waitFor(() => expect(mockAllocate).toHaveBeenCalled())
    expect(mockAllocate.mock.calls[0][0]).toEqual([{
      venue_id: 'v1', staff_id: 's1', time_off_request_id: 'r1', leave_date: '2026-10-15', hours: 8, allocated_by: 'm1',
    }])
    expect(onSaved).toHaveBeenCalled()
  })

  it('warns, but still allows, going over the balance', async () => {
    const loadBalance = async () => ({ accrued: 5, used: 13, avgDailyHours: 6.5 })
    render(
      <AllocateHolidayModal row={row} venueId="v1" managerId="m1" locked={false} suggestedHours={8}
        loadBalance={loadBalance} onClose={() => {}} onSaved={() => {}} />,
    )
    await screen.findByText(/more than they have left/)
    expect(screen.getByRole('button', { name: /Allocate 16 h/ }).hasAttribute('disabled')).toBe(false)
  })
})
