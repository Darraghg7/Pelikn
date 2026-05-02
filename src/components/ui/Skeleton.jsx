import React from 'react'

export default function Skeleton({ className = '', rounded = 'rounded-lg' }) {
  return (
    <div className={`animate-pulse bg-charcoal/8 dark:bg-white/8 ${rounded} ${className}`} />
  )
}

export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}
        />
      ))}
    </div>
  )
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`bg-white dark:bg-[#1e1e1e] rounded-2xl border border-charcoal/8 p-4 ${className}`}>
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="w-10 h-10" rounded="rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-4 w-1/3 mb-2" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  )
}

export function SkeletonList({ rows = 5, className = '' }) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="w-8 h-8 shrink-0" rounded="rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-2/5 mb-1.5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonDashboard() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Skeleton className="h-8 w-1/3 mb-2" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-charcoal/8 p-4">
            <Skeleton className="h-3 w-2/3 mb-3" />
            <Skeleton className="h-8 w-1/2 mb-2" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
