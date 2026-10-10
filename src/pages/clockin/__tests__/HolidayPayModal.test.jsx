import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

const update = vi.fn()
const eq = vi.fn()
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: (patch) => { update(patch); return { eq: (...a) => { eq(...a); return Promise.resolve({ error: null }) } } },
    }),
  },
}))
vi.mock('../../../components/ui/Toast', () => ({ useToast: () => vi.fn() }))

const { default: HolidayPayModal } = await import('../HolidayPayModal')

// Sarah: Thu–Sun, 13.7 h average week, booked Sat 14 + Sun 15 Nov, on the rota for the Saturday (8 h)
const base = {
  request: { id: 'r1', staff_id: 'sarah', start_date: '2026-11-14', end_date: '2026-11-15', paid_hours: null },
  staffName: 'Sarah',
  hourlyRate: 12.5,
  workingDays: [4, 5, 6, 7],
  avgWeekHours: 13.7,
  rotaHoursByDate: { '2026-11-14': 8 },
  holidayLeft: 63.2,
  periodFrom: '2026-11-09',
  periodTo: '2026-11-15',
  locked: false,
  onClose: vi.fn(),
  onSaved: vi.fn(),
}

describe('HolidayPayModal', () => {
  beforeEach(() => { update.mockClear(); eq.mockClear() })

  it('suggests the rota shift plus an average day, and shows the pay', async () => {
    render(<HolidayPayModal {...base} />)
    expect(await screen.findByText('Suggested: 11.4 h')).toBeTruthy()
    expect(screen.getByText(/8 h from the rota/)).toBeTruthy()
    expect(screen.getByText(/3.4 h from their average week/)).toBeTruthy()
    const box = /** @type {HTMLInputElement} */ (screen.getByLabelText('Hours to pay'))
    expect(box.value).toBe('11.4')
    expect(screen.getByText('£142.50')).toBeTruthy() // 11.4 × £12.50
    // 63.2 left already counted this booking at 2 × 13.7/4 = 6.85 h; at 11.4 h → 58.65
    expect(screen.getByText('58.7 h of holiday left this year after this')).toBeTruthy()
  })

  it('saves the hours the manager enters', async () => {
    render(<HolidayPayModal {...base} />)
    fireEvent.change(await screen.findByLabelText('Hours to pay'), { target: { value: '16' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save holiday pay' })) })
    expect(update).toHaveBeenCalledWith({ paid_hours: 16 })
    expect(eq).toHaveBeenCalledWith('id', 'r1')
    expect(base.onSaved).toHaveBeenCalled()
  })

  it('opens on the hours already recorded, and can\'t be changed in a locked period', async () => {
    render(<HolidayPayModal {...base} request={{ ...base.request, paid_hours: 9 }} locked />)
    const box = /** @type {HTMLInputElement} */ (await screen.findByLabelText('Hours to pay'))
    expect(box.value).toBe('9')
    expect(box.disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Save holiday pay' })).toBeNull()
  })
})
