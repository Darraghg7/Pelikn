import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('navOrigin', () => {
  let nav: typeof import('../navOrigin')
  beforeEach(async () => {
    vi.resetModules()
    nav = await import('../navOrigin')
  })

  it('remembers the page before the current one', () => {
    nav.noteLocation('/v/x/dashboard')
    nav.noteLocation('/v/x/cleaning')
    expect(nav.previousLocation()).toBe('/v/x/dashboard')
  })

  it('ignores repeat renders of the same page', () => {
    nav.noteLocation('/v/x/dashboard')
    nav.noteLocation('/v/x/cleaning')
    nav.noteLocation('/v/x/cleaning')
    expect(nav.previousLocation()).toBe('/v/x/dashboard')
  })

  it('moves on when the person goes somewhere else', () => {
    nav.noteLocation('/v/x/dashboard')
    nav.noteLocation('/v/x/cleaning')
    nav.noteLocation('/v/x/fridge')
    expect(nav.previousLocation()).toBe('/v/x/cleaning')
  })

  it('has no previous page on a fresh load', () => {
    nav.noteLocation('/v/x/cleaning')
    expect(nav.previousLocation()).toBeNull()
  })
})
