import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const markNotHoliday = vi.fn(async (_ids) => ({ error: null }))
const restoreAsHoliday = vi.fn(async (_id, _hours) => ({ error: null }))
vi.mock('../../../lib/api/timeOff', () => ({ markNotHoliday: (ids) => markNotHoliday(ids), restoreAsHoliday: (id, hours) => restoreAsHoliday(id, hours) }))
vi.mock('../../../lib/sendPush', () => ({ sendPush: vi.fn() }))
vi.mock('../../../components/ui/Toast', () => ({ useToast: () => vi.fn() }))

import HolidayBookingsModal from '../HolidayBookingsModal'
import { holidayYearStarting } from '../../../lib/holidayYear'

const FRI_SUN = [5, 6, 7]
const req = (id, start, extra = {}) => ({
  id, staff_id: 'sarah', start_date: start, end_date: start, status: 'approved', leave_type: 'annual',
  paid_hours: null, staff: { working_days: FRI_SUN }, ...extra,
})
const REQUESTS = [
  req('a', '2026-08-01'),                       // Sat
  req('b', '2026-08-02'),                       // Sun
  req('c', '2026-08-08', { paid_hours: 6 }),    // confirmed
  req('d', '2026-08-09', { leave_type: 'unavailable' }),  // already not holiday
  req('e', '2026-08-15', { staff_id: 'someone-else' }),
]

const show = () => render(
  <HolidayBookingsModal
    staff={{ id: 'sarah', name: 'Sarah', isZeroHours: true }}
    holiday={{ status: 'ok', avgWeekHours: 14.7 }}
    requests={REQUESTS}
    holidayYear={holidayYearStarting(2026)}
    venueId="v1"
    onClose={() => {}}
    onSaved={() => {}}
  />,
)

beforeEach(() => { markNotHoliday.mockClear(); restoreAsHoliday.mockClear() })

describe('HolidayBookingsModal', () => {
  it('lists only their annual leave, with estimated and confirmed hours', () => {
    show()
    expect(screen.getByText('Sat 1 Aug')).toBeTruthy()
    expect(screen.getAllByText('about 4.9 h · not confirmed')).toHaveLength(2)
    expect(screen.getByText('6 h paid')).toBeTruthy()
    expect(screen.queryByText('Sun 9 Aug')).toBeNull()   // already Not available
    expect(screen.queryByText('Sat 15 Aug')).toBeNull()  // someone else's
  })

  it('"Not holiday" changes one booking, and Undo puts back its hours', async () => {
    show()
    fireEvent.click(screen.getAllByRole('button', { name: 'Not holiday' })[2])  // the 6 h one
    await waitFor(() => expect(markNotHoliday).toHaveBeenCalledWith(['c']))
    expect(await screen.findByText(/Not available · doesn’t use holiday/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(restoreAsHoliday).toHaveBeenCalledWith('c', 6))
  })

  it('changes every unconfirmed booking at once, leaving confirmed ones alone', async () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Change all 2 unconfirmed to Not available' }))
    fireEvent.click(screen.getByRole('button', { name: 'Change them' }))
    await waitFor(() => expect(markNotHoliday).toHaveBeenCalledWith(['a', 'b']))
  })
})
