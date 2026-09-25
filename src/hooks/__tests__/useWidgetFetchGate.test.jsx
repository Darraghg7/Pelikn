import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { FetchWhenNearViewport, useWidgetFetchGate } from '../useWidgetFetchGate'

function Probe() {
  return <span data-testid="gate">{useWidgetFetchGate() ? 'open' : 'closed'}</span>
}

let observers
class FakeIntersectionObserver {
  constructor(cb, opts) { this.cb = cb; this.opts = opts; this.disconnected = false; observers.push(this) }
  observe() {}
  disconnect() { this.disconnected = true }
  fire(isIntersecting) { this.cb([{ isIntersecting }]) }
}

describe('FetchWhenNearViewport', () => {
  beforeEach(() => {
    observers = []
    vi.useFakeTimers()
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('leaves the gate open outside any wrapper, so other pages are unaffected', () => {
    render(<Probe />)
    expect(screen.getByTestId('gate').textContent).toBe('open')
  })

  it('keeps the gate closed while the card is off screen', () => {
    render(<FetchWhenNearViewport><Probe /></FetchWhenNearViewport>)
    act(() => observers[0].fire(false))
    expect(screen.getByTestId('gate').textContent).toBe('closed')
  })

  it('opens when the card comes near the viewport, and stops observing', () => {
    render(<FetchWhenNearViewport><Probe /></FetchWhenNearViewport>)
    expect(observers[0].opts.rootMargin).toBe('0px 0px 200px 0px')
    act(() => observers[0].fire(true))
    expect(screen.getByTestId('gate').textContent).toBe('open')
    expect(observers[0].disconnected).toBe(true)
  })

  it('opens on the fallback timer even if the observer never reports', () => {
    render(<FetchWhenNearViewport><Probe /></FetchWhenNearViewport>)
    act(() => { vi.advanceTimersByTime(2999) })
    expect(screen.getByTestId('gate').textContent).toBe('closed')
    act(() => { vi.advanceTimersByTime(1) })
    expect(screen.getByTestId('gate').textContent).toBe('open')
  })

  it('opens immediately where IntersectionObserver does not exist', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    render(<FetchWhenNearViewport><Probe /></FetchWhenNearViewport>)
    expect(screen.getByTestId('gate').textContent).toBe('open')
  })
})
