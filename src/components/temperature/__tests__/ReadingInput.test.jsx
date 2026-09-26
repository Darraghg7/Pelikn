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

  it('saves after a pause in typing, without tapping Log', () => {
    const onSubmit = vi.fn()
    render(<Harness onSubmit={onSubmit} />)
    fireEvent.change(screen.getByLabelText('reading'), { target: { value: '3' } })
    act(() => { vi.advanceTimersByTime(1500) })
    fireEvent.change(screen.getByLabelText('reading'), { target: { value: '3.5' } })
    act(() => { vi.advanceTimersByTime(2000) })
    expect(onSubmit).not.toHaveBeenCalled()  // still typing
    act(() => { vi.advanceTimersByTime(1000) })
    expect(onSubmit).toHaveBeenCalledTimes(1)
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
    expect(onSubmit).toHaveBeenCalledTimes(1)  // idle timer doesn't double-save
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
