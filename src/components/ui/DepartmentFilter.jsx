import React from 'react'

/**
 * Manager-only "All · Kitchen · Front of House" switch for department-assigned
 * lists. Pair with useViewerDepartments(): pass its departments, filter and
 * setFilter straight through. Renders nothing until the venue has departments.
 */
export default function DepartmentFilter({ departments, value, onChange, className = '' }) {
  if (!departments?.length) return null
  const options = [{ id: 'all', name: 'All departments' }, ...departments]
  return (
    <div className={`flex gap-2 flex-wrap ${className}`} role="group" aria-label="Department">
      {options.map((d) => (
        <button
          key={d.id}
          type="button"
          onClick={() => onChange(d.id)}
          aria-pressed={value === d.id}
          className={[
            'px-[14px] py-[7px] rounded-full text-[13px] font-medium border transition-all',
            value === d.id
              ? 'bg-charcoal text-cream border-charcoal dark:border-white'
              : 'bg-white dark:bg-paperDark text-charcoal/50 dark:text-white/40 border-charcoal/15 dark:border-white/15 hover:border-charcoal/30 dark:hover:border-white/30',
          ].join(' ')}
        >
          {d.name}
        </button>
      ))}
    </div>
  )
}
