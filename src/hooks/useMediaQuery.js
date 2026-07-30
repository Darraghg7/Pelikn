import { useEffect, useState } from 'react'

/**
 * Subscribe to a CSS media query from JS.
 *
 * Exists so layouts can be *rendered* conditionally instead of merely hidden
 * with Tailwind's `lg:hidden` / `hidden lg:block`. Those classes only affect
 * paint — both subtrees still mount, so every hook inside both of them runs
 * and every query inside both of them fires. The manager dashboard was making
 * 76 API calls per load for exactly that reason: a phone dashboard and a
 * desktop dashboard were being built on every device, and one was thrown away.
 *
 * Reads synchronously on first render so there is no wrong-layout flash.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const mq = window.matchMedia(query)
    const onChange = (e) => setMatches(e.matches)
    setMatches(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** Tailwind's `lg` breakpoint — keep in step with tailwind.config.js. */
export const LG_BREAKPOINT = '(min-width: 1024px)'

/** True when the viewport is at or above Tailwind's `lg` breakpoint. */
export function useIsDesktop() {
  return useMediaQuery(LG_BREAKPOINT)
}
