import React, { useState, useEffect } from 'react'
import { TAB_ICONS, getTabIcon, setTabIcon } from '../../lib/tabIcon'

/** Choose the browser tab icon. Renders nothing in the native app, which has no tabs. */
export default function TabIconPicker() {
  const [isNative, setIsNative] = useState(false)
  const [active, setActive] = useState(getTabIcon)

  useEffect(() => {
    import('@capacitor/core').then(({ Capacitor }) => {
      setIsNative(Capacitor.isNativePlatform())
    }).catch(() => { /* chunk failed to load — treat as web, so the picker stays visible */ })
  }, [])

  if (isNative) return null

  const choose = (id) => { setTabIcon(id); setActive(id) }

  return (
    <div className="border-t border-charcoal/6 dark:border-white/8 px-[15px] py-[13px]">
      <div className="text-sm font-medium text-charcoal dark:text-white tracking-[-0.005em]">Browser tab icon</div>
      <div className="text-caption text-charcoal/50 dark:text-white/40 mt-0.5 mb-3 leading-[1.4]">Choose the icon shown on this device's browser tab.</div>
      <div role="radiogroup" aria-label="Browser tab icon" className="flex gap-3">
        {Object.entries(TAB_ICONS).map(([id, v]) => (
          <label key={id} className="flex flex-col items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="tab-icon"
              value={id}
              checked={active === id}
              onChange={() => choose(id)}
              className="sr-only peer"
            />
            <img
              src={v.svg}
              alt=""
              className={[
                'w-14 h-14 rounded-card transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-brand',
                active === id ? 'ring-2 ring-offset-2 ring-charcoal dark:ring-white scale-105' : 'opacity-75 hover:opacity-100',
              ].join(' ')}
            />
            <span className={`text-micro font-medium ${active === id ? 'text-charcoal dark:text-white' : 'text-charcoal/40 dark:text-white/35'}`}>
              {v.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
