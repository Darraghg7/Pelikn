import React, { createContext, useContext, useEffect, useRef, useState } from 'react'

/**
 * Lets a dashboard hold back a widget's network fetch until the widget is
 * about to be seen.
 *
 * Why: measured 25 Sep 2026, a cold open after the database has been idle
 * pays a cost that grows with how many requests arrive at once — 1 request
 * ~1.0 s, 6 ~1.9 s, 12 ~2.5 s, 20 ~3.4-8 s — because the database has to
 * re-open a connection for each concurrent request. Widgets below the fold
 * don't need to be in that first burst: they already render their last-known
 * numbers from localStorage (useWidgetQuery's placeholder), and by the time
 * the user scrolls to them the connections are warm and a fetch is ~0.5 s.
 *
 * The gate defaults to open, so every hook that reads it behaves exactly as
 * before anywhere that isn't wrapped in <FetchWhenNearViewport>.
 */
const WidgetFetchGate = createContext(true)

/** False while the surrounding widget is still well off screen. */
export function useWidgetFetchGate() {
  return useContext(WidgetFetchGate)
}

/**
 * Opens the gate once its content comes within `margin` of the viewport, or
 * after `fallbackMs` — whichever is first — and keeps it open from then on;
 * scrolling away never cancels or re-triggers a fetch.
 *
 * The fallback matters: IntersectionObserver only reports while the page is
 * being rendered, so a hidden page (or any WebView quirk) would otherwise
 * leave a card on stale numbers indefinitely. By `fallbackMs` the cold-open
 * burst has finished and the connections are warm, so fetching then still
 * keeps these cards out of it. Opens immediately where IntersectionObserver
 * isn't available.
 */
export function FetchWhenNearViewport({ children, margin = '200px', fallbackMs = 3000 }) {
  const ref = useRef(null)
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    if (near || !ref.current) return undefined
    const io = new IntersectionObserver(
      (entries) => { if (entries.some(e => e.isIntersecting)) setNear(true) },
      { rootMargin: `0px 0px ${margin} 0px` },
    )
    io.observe(ref.current)
    const fallback = setTimeout(() => setNear(true), fallbackMs)
    return () => { io.disconnect(); clearTimeout(fallback) }
  }, [near, margin, fallbackMs])

  return (
    <div ref={ref}>
      <WidgetFetchGate.Provider value={near}>{children}</WidgetFetchGate.Provider>
    </div>
  )
}
