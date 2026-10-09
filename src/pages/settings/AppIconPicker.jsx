import React, { useState, useEffect } from 'react'
import { useToast } from '../../components/ui/Toast'
import { appIconColors } from '../../lib/tokens'

const ICON_VARIANTS = [
  { id: 'light', label: 'Light', bg: appIconColors.white, fg: appIconColors.green, iconName: null },
  { id: 'dark',  label: 'Dark',  bg: appIconColors.green, fg: appIconColors.white, iconName: 'AppIconDark' },
  { id: 'mint',  label: 'Mint',  bg: appIconColors.black, fg: appIconColors.mint, iconName: 'AppIconMint' },
]

function MortarSVG({ fg }) {
  return (
    <svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <line x1="82" y1="272" x2="322" y2="272" stroke={fg} strokeWidth="26" strokeLinecap="round"/>
      <path d="M 110 272 C 103 316 101 364 202 368 C 303 364 301 316 294 272" stroke={fg} strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M 180 338 L 287 222 C 299 207 317 190 336 173 C 357 154 374 128 370 104 C 366 79 342 68 318 78 C 296 87 284 110 288 133 C 292 156 303 174 301 191" stroke={fg} strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  )
}

export default function AppIconPicker() {
  const [isNative, setIsNative] = useState(false)
  const [active, setActive]     = useState(() => localStorage.getItem('pelikn_icon_variant') ?? 'light')
  const [switching, setSwitching] = useState(false)
  const toast = useToast()

  useEffect(() => {
    import('@capacitor/core').then(({ Capacitor }) => {
      setIsNative(Capacitor.isNativePlatform())
    }).catch(() => { /* chunk failed to load — treat as web, so the picker stays hidden */ })
  }, [])

  if (!isNative) return null

  const switchIcon = async (variant) => {
    if (variant.id === active || switching) return
    setSwitching(true)
    try {
      const { AppIcon } = await import('@capacitor-community/app-icon')
      await AppIcon.change({ name: variant.iconName, suppressNotification: false })
      localStorage.setItem('pelikn_icon_variant', variant.id)
      setActive(variant.id)
      toast(`App icon changed to ${variant.label}`)
    } catch (err) {
      toast('Could not change icon, try updating the app', 'error')
      console.warn('[icon]', err)
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div className="border-t border-charcoal/6 dark:border-white/8 px-[15px] py-[13px]">
      <div className="text-sm font-medium text-charcoal dark:text-white tracking-[-0.005em]">App icon</div>
      <div className="text-[11.5px] text-charcoal/50 dark:text-white/40 mt-0.5 mb-3 leading-[1.4]">Choose the icon shown on your home screen.</div>
      <div className="flex gap-3">
        {ICON_VARIANTS.map(v => (
          <button
            key={v.id}
            onClick={() => switchIcon(v)}
            disabled={switching}
            className="flex flex-col items-center gap-1.5 focus:outline-none"
          >
            <span
              className={[
                'w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center transition-all',
                active === v.id ? 'ring-2 ring-offset-2 ring-charcoal dark:ring-white scale-105' : 'opacity-75 hover:opacity-100',
              ].join(' ')}
              style={{ backgroundColor: v.bg }}
            >
              <span className="w-8 h-8">
                <MortarSVG fg={v.fg} />
              </span>
            </span>
            <span className={`text-[11px] font-medium ${active === v.id ? 'text-charcoal dark:text-white' : 'text-charcoal/40 dark:text-white/35'}`}>
              {v.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
