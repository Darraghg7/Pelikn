import React, { useState } from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { vi } from 'vitest'
import { ReadingInput } from '../TempPageParts'

function Harness({ onSubmit, canSubmit = true, autoSave = true }) {
  const [value, setValue] = useState('')
  return (
    <ReadingInput
      value={value}
      onChange={setValue}
      onSubmit={onSubmit}
      canSubmit={canSubmit && value !== ''}
      autoSave={autoSave}
      ariaLabel="reading"
    />
  )
}

describe('ReadingInput auto-save', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('does not save just because typing paused', () => {
    // A pause mid-number ("1" on the way to "10") used to be saved as the reading.
    const onSubmit = vi.fn()
    render(<Harness onSubmit={onSubmit} />)
    fireEvent.change(screen.getByLabelText('reading'), { target: { value: '1' } })
    act(() => { vi.advanceTimersByTime(10000) })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('saves shortly after leaving the field', () => {
    const onSubmit = vi.fn()
    render(<Harness onSubmit={onSubmit} />)
    const input = screen.getByLabelText('reading')
    fireEvent.change(input, { target: { value: '4' } })
    fireEvent.blur(input)
    act(() => { vi.advanceTimersByTime(300) })
    expect(onSubmit).toHaveBeenCalledTimes(1)
    act(() => { vi.advanceTimersByTime(5000) })
    expect(onSubmit).toHaveBeenCalledTimes(1)  // saved once, not repeatedly
  })

  it('typing again after leaving cancels the pending save', () => {
    const onSubmit = vi.fn()
    render(<Harness onSubmit={onSubmit} />)
    const input = screen.getByLabelText('reading')
    fireEvent.change(input, { target: { value: '1' } })
    fireEvent.blur(input)
    fireEvent.change(input, { target: { value: '10' } })   // came back and kept typing
    act(() => { vi.advanceTimersByTime(5000) })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('does not save when the reading still needs a reason', () => {
    const onSubmit = vi.fn()
    render(<Harness onSubmit={onSubmit} canSubmit={false} />)
    const input = screen.getByLabelText('reading')
    fireEvent.change(input, { target: { value: '9' } })
    fireEvent.blur(input)
    act(() => { vi.advanceTimersByTime(5000) })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('does not save if the input goes away first (Cancel)', () => {
    const onSubmit = vi.fn()
    const { unmount } = render(<Harness onSubmit={onSubmit} />)
    const input = screen.getByLabelText('reading')
    fireEvent.change(input, { target: { value: '70' } })
    fireEvent.blur(input)
    unmount()
    act(() => { vi.advanceTimersByTime(5000) })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('leaves pages without autoSave on the manual button', () => {
    const onSubmit = vi.fn()
    render(<Harness onSubmit={onSubmit} autoSave={false} />)
    const input = screen.getByLabelText('reading')
    fireEvent.change(input, { target: { value: '4' } })
    fireEvent.blur(input)
    act(() => { vi.advanceTimersByTime(5000) })
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('ReadingInput ± button (freezers)', () => {
  function NegHarness({ allowNegative = true }) {
    const [value, setValue] = useState('')
    return (
      <ReadingInput
        value={value} onChange={setValue} onSubmit={() => {}} canSubmit={value !== ''}
        allowNegative={allowNegative} ariaLabel="reading"
        placeholder="" saving={false} warn={false} autoFocus={false}
      />
    )
  }
  const field = () => /** @type {HTMLInputElement} */ (screen.getByLabelText('reading'))

  it('is not shown unless the item can go below zero', () => {
    render(<NegHarness allowNegative={false} />)
    expect(screen.queryByRole('button', { name: /negative|positive/i })).toBeNull()
  })

  it('needs digits first, then flips the sign both ways', () => {
    render(<NegHarness />)
    expect(screen.getByRole('button', { name: /make negative/i }).hasAttribute('disabled')).toBe(true)

    fireEvent.change(field(), { target: { value: '18' } })
    fireEvent.click(screen.getByRole('button', { name: /make negative/i }))
    expect(field().value).toBe('-18')

    fireEvent.click(screen.getByRole('button', { name: /make positive/i }))
    expect(field().value).toBe('18')
  })
})
