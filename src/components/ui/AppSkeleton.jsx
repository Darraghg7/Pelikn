import React from 'react'
import Skeleton from './Skeleton'

/**
 * Stand-in for the AppShell layout, shown while an auth/permission guard is
 * still resolving (before AppShell itself mounts). Matches the rail width and
 * mobile header height so the real shell doesn't pop in as a jarring layout
 * shift once the guard clears.
 */
export default function AppSkeleton() {
  return (
    <div className="min-h-dvh flex bg-surface dark:bg-[#111111]">
      <div className="hidden lg:block w-20 shrink-0 bg-brand" aria-hidden="true" />
      <div className="flex-1 flex flex-col min-h-dvh">
        <div className="lg:hidden h-14 bg-brand shrink-0" aria-hidden="true" />
        <div className="flex-1 max-w-[1280px] mx-auto w-full px-4 lg:px-6 py-5 lg:py-6">
          <Skeleton className="h-7 w-48 mb-5" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-paperDark rounded-2xl border border-charcoal/8 p-4">
                <Skeleton className="h-3 w-2/3 mb-3" />
                <Skeleton className="h-8 w-1/2 mb-2" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
