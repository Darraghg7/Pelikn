import { useLayoutEffect } from 'react'

// The public marketing page is drawn in light colours only (it has no dark
// styles of its own). Dark mode's global overrides would turn its white cards
// dark on a cream page, so take the `dark` class off <html> while it is shown
// and put it back on leaving.
export default function useForceLight() {
  useLayoutEffect(() => {
    const root = document.documentElement
    const wasDark = root.classList.contains('dark')
    root.classList.remove('dark')
    return () => { if (wasDark) root.classList.add('dark') }
  }, [])
}
