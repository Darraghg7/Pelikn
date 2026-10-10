import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../../../components/ui/Toast', () => ({ useToast: () => vi.fn() }))
vi.mock('../../../hooks/useSettings', () => ({ useAppSettings: () => ({ closedDays: [0] }) }))
const mockInsert = vi.fn(async (_row) => ({ error: null }))
vi.mock('../../../lib/supabase', () => ({ supabase: { from: () => ({ insert: (row) => mockInsert(row) }) } }))
const mockCarry = vi.fn(async (_args) => ({ error: null }))
vi.mock('../../../lib/api/holidayPay', () => ({ saveCarryOver: (args) => mockCarry(args) }))

const { default: ManualLeaveModal } = await import('../ManualLeaveModal')
const { default: CarryOverModal } = await import('../CarryOverModal')

const sam = { id: 's1', name: 'Sam', working_days: [4, 5, 6, 7], carriedOver: 0 }

describe('ManualLeaveModal', () => {
  beforeEach(() => { mockInsert.mockClear() })

  const setDates = (container, from, to) => {
    const [start, end] = container.querySelectorAll('input[type="date"]')
    fireEvent.change(start, { target: { value: from } })
    fireEvent.change(end, { target: { value: to } })
  }

  it('suggests their usual hours and books approved holiday with them', async () => {
    const { container } = render(<ManualLeaveModal staff={sam} venueId="v1" managerId="m1" hoursReady dayHours={7.5} onClose={() => {}} onSaved={() => {}} />)
    setDates(container, '2026-10-15', '2026-10-18') // Thu–Sun, 4 working days
    expect(/** @type {HTMLInputElement} */ (screen.getByLabelText('Holiday hours to pay')).value).toBe('30')
    fireEvent.click(screen.getByRole('button', { name: 'Add leave' }))
    await waitFor(() => expect(mockInsert).toHaveBeenCalled())
    expect(mockInsert.mock.calls[0][0]).toMatchObject({ staff_id: 's1', status: 'approved', leave_type: 'annual', hours: 30 })
  })

  it('pays the hours a manager types for a week they are not working', async () => {
    const { container } = render(<ManualLeaveModal staff={sam} venueId="v1" managerId="m1" hoursReady dayHours={7.5} onClose={() => {}} onSaved={() => {}} />)
    setDates(container, '2026-10-20', '2026-10-21') // Tue–Wed: not their working days
    fireEvent.change(screen.getByLabelText('Holiday hours to pay'), { target: { value: '8' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add leave' }))
    await waitFor(() => expect(mockInsert).toHaveBeenCalled())
    expect(mockInsert.mock.calls[0][0]).toMatchObject({ hours: 8 })
  })

  it('leaves hours out until the database update is applied', async () => {
    const { container } = render(<ManualLeaveModal staff={sam} venueId="v1" managerId="m1" hoursReady={false} dayHours={7.5} onClose={() => {}} onSaved={() => {}} />)
    setDates(container, '2026-10-15', '2026-10-18')
    expect(screen.queryByLabelText('Holiday hours to pay')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Add leave' }))
    await waitFor(() => expect(mockInsert).toHaveBeenCalled())
    expect('hours' in mockInsert.mock.calls[0][0]).toBe(false)
  })
})

describe('CarryOverModal', () => {
  const leaveYear = { startYear: 2026, label: '2026', from: '2026-01-01', to: '2026-12-31' }
  beforeEach(() => { mockCarry.mockClear() })

  it('saves the hours carried into this holiday year', async () => {
    render(<CarryOverModal balance={sam} leaveYear={leaveYear} available venueId="v1" onClose={() => {}} onSaved={() => {}} />)
    fireEvent.change(screen.getByLabelText('Hours carried over'), { target: { value: '12.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mockCarry).toHaveBeenCalled())
    expect(mockCarry.mock.calls[0][0]).toEqual({ venueId: 'v1', staffId: 's1', leaveYear: 2026, hours: 12.5 })
  })

  it('clears it with 0', async () => {
    render(<CarryOverModal balance={{ ...sam, carriedOver: 6 }} leaveYear={leaveYear} available venueId="v1" onClose={() => {}} onSaved={() => {}} />)
    fireEvent.change(screen.getByLabelText('Hours carried over'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mockCarry).toHaveBeenCalled())
    expect(mockCarry.mock.calls[0][0].hours).toBeNull()
  })
})
