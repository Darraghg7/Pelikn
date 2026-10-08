import { describe, it, expect, beforeEach, vi } from 'vitest'
import { reportError, attachSentry, captureSilent, __resetForTests } from '../reportError'

const fakeSentry = () => ({ captureException: vi.fn() })

describe('reportError', () => {
  beforeEach(() => {
    __resetForTests()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('sends straight to Sentry once it has been attached', () => {
    const sentry = fakeSentry()
    attachSentry(sentry)
    const err = new Error('boom')
    reportError(err, 'Thing:save')
    expect(sentry.captureException).toHaveBeenCalledWith(err, {
      tags: { silent: true },
      extra: { context: 'Thing:save' },
    })
  })

  it('queues reports made before Sentry loads and flushes them on attach', () => {
    reportError(new Error('early'), { venueId: 'v1' })
    const sentry = fakeSentry()
    attachSentry(sentry)
    expect(sentry.captureException).toHaveBeenCalledTimes(1)
    expect(sentry.captureException.mock.calls[0][0].message).toBe('early')
    expect(sentry.captureException.mock.calls[0][1].extra).toEqual({ venueId: 'v1' })
  })

  it('bounds the queue so a never-loaded Sentry cannot leak memory', () => {
    for (let i = 0; i < 100; i++) reportError(new Error(`e${i}`))
    const sentry = fakeSentry()
    attachSentry(sentry)
    expect(sentry.captureException).toHaveBeenCalledTimes(20)
  })

  it('turns a Supabase error object into a readable Error', () => {
    const sentry = fakeSentry()
    attachSentry(sentry)
    reportError({ message: 'permission denied for table staff', code: '42501' }, 'x')
    const sent = sentry.captureException.mock.calls[0][0]
    expect(sent).toBeInstanceOf(Error)
    expect(sent.message).toBe('permission denied for table staff')
    expect(sent.name).toBe('SupabaseError 42501')
  })

  it('never throws, even if Sentry itself does', () => {
    attachSentry({ captureException: () => { throw new Error('sdk broke') } })
    expect(() => reportError(new Error('x'))).not.toThrow()
  })

  it('can be marked as user-visible (ErrorBoundary)', () => {
    const sentry = fakeSentry()
    attachSentry(sentry)
    reportError(new Error('render'), {}, { silent: false })
    expect(sentry.captureException.mock.calls[0][1].tags).toEqual({ silent: false })
  })

  it('keeps the old captureSilent name working', () => {
    expect(captureSilent).toBe(reportError)
  })
})
