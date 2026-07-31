import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import StaffAlertModal from '../StaffAlertModal'

/**
 * Regression: the modal renders nothing until `visible` state flips true, and
 * `visible` is set from an effect when `open` becomes true. Any hook placed
 * after that `if (!visible) return null` guard runs on the second render but
 * not the first, which crashes with React error #310 ("Rendered more hooks
 * than during the previous render") every time an alert opens.
 */
describe('StaffAlertModal hook order', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('does not change hook count when opening (React #310)', async () => {
    const errors = []
    vi.spyOn(console, 'error').mockImplementation((...args) => { errors.push(String(args[0])) })

    const props = {
      type: 'late_clock_in',
      minsOver: 12,
      strikeCount: 1,
      scheduledTime: '09:00',
      actualTime: '09:12',
      onAcknowledge: vi.fn(),
      onVerifyManagerPin: vi.fn(),
    }

    // First render with open=false takes the `!visible` early-return path.
    const { rerender } = render(<StaffAlertModal {...props} open={false} />)
    expect(screen.queryByText(/LATE CLOCK-IN/i)).toBeNull()

    // Opening flips visible false -> true, so the guard is no longer taken.
    await act(async () => {
      rerender(<StaffAlertModal {...props} open />)
    })

    expect(await screen.findByText(/LATE CLOCK-IN/i)).toBeTruthy()

    const hookOrderError = errors.find(e =>
      /Rendered more hooks|Rendered fewer hooks|order of Hooks|Minified React error #3(10|00)/.test(e),
    )
    expect(hookOrderError).toBeUndefined()
  })
})
