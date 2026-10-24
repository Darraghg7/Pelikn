import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { format } from 'date-fns'
import TempHistoryView from '../TempHistoryView'

const today = format(new Date(), 'yyyy-MM-dd')
const fridge = { id: 'f1', name: 'Prep Fridge', min_temp: 0, max_temp: 5 }
const statusOf = (log, item) => (log.temperature < item.min_temp || log.temperature > item.max_temp ? 'bad' : 'ok')
const reading = (temperature, time) => ({ temperature, logged_at: `${today}T${time}:00`, logged_by_name: 'Sarah' })

const renderWith = (cell) => render(
  <TempHistoryView
    items={[fridge]}
    matrix={{ f1: { [today]: { am: cell } } }}
    loading={false}
    range={1}
    onRange={() => {}}
    statusOf={statusOf}
    renderMissed={undefined}
    noteOf={(log) => log.notes}
  />,
)

describe('TempHistoryView', () => {
  it('shows a failed reading even when a later re-check passed', () => {
    // Newest reading (the re-check) passes; the earlier one was 9.5°C.
    renderWith({ ...reading(4.0, '09:30'), earlier: [{ ...reading(9.5, '09:00'), notes: 'Door left open, stock moved' }] })

    const cell = screen.getByLabelText(/9\.5° at 09:00 by Sarah, re-checked 4\.0° at 09:30/)
    expect(cell.textContent).toBe('9.5→4.0')
    expect(screen.getByText('Excursion')).toBeTruthy()
    expect(screen.getByText(/Door left open, stock moved/)).toBeTruthy()
  })

  it('shows a single passing reading as before', () => {
    renderWith({ ...reading(3.2, '09:00'), earlier: [] })
    expect(screen.getByText('3.2°')).toBeTruthy()
    expect(screen.getByText('Excursions')).toBeTruthy()
  })

  it('shows the newest reading when it is the one that failed', () => {
    renderWith({ ...reading(8.1, '09:30'), earlier: [reading(4.0, '09:00')] })
    expect(screen.getByText('8.1°')).toBeTruthy()
    expect(screen.getByText('Excursion')).toBeTruthy()
  })
})
