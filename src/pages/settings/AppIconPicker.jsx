import React, { useState, useEffect } from 'react'
import { useToast } from '../../components/ui/Toast'
import { appIconColors } from '../../lib/tokens'
import Logo from '../../components/ui/Logo'

const ICON_VARIANTS = [
  { id: 'light', label: 'Light', bg: appIconColors.white, fg: appIconColors.green, iconName: null },
  { id: 'dark',  label: 'Dark',  bg: appIconColors.green, fg: appIconColors.white, iconName: 'AppIconDark' },
  { id: 'mint',  label: 'Mint',  bg: appIconColors.black, fg: appIconColors.mint, iconName: 'AppIconMint' },
]

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
      <div className="text-caption text-charcoal/50 dark:text-white/40 mt-0.5 mb-3 leading-[1.4]">Choose the icon shown on your home screen.</div>
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
                'w-14 h-14 rounded-card overflow-hidden flex items-center justify-center transition-all',
                active === v.id ? 'ring-2 ring-offset-2 ring-charcoal dark:ring-white scale-105' : 'opacity-75 hover:opacity-100',
              ].join(' ')}
              style={{ backgroundColor: v.bg }}
            >
              <span style={{ color: v.fg }}><Logo variant="mark" height={28} className="!text-current" /></span>
            </span>
            <span className={`text-micro font-medium ${active === v.id ? 'text-charcoal dark:text-white' : 'text-charcoal/40 dark:text-white/35'}`}>
              {v.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
