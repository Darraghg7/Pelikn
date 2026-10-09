import React from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { useVenue } from '../../contexts/VenueContext'
import { useToast } from '../../components/ui/Toast'
import { SkeletonList } from '../../components/ui/Skeleton'
import SettingsSubHeader from '../../components/layout/SettingsSubHeader'
import useStaffLastLogins from '../../hooks/useStaffLastLogins'

const ROLE_LABELS = { staff: 'Staff', manager: 'Manager', owner: 'Owner' }

export default function AnalyticsSettingsPage() {
  const navigate = useNavigate()
  const { venueSlug } = useVenue()
  const toast = useToast()
  const { rows, error, loading } = useStaffLastLogins()

  React.useEffect(() => { if (error) toast(error.message, 'error') }, [error, toast])

  const vp = (path) => `/v/${venueSlug}${path}`

  return (
    <div>
      <SettingsSubHeader title="Analytics" onBack={() => navigate(vp('/settings/hub'))} />

      <div className="pb-24 max-w-[480px] mx-auto">

        <div className="font-mono text-micro font-semibold tracking-[0.08em] uppercase text-charcoal/50 dark:text-white/40 pt-[18px] pb-[7px] px-0.5">
          Last login · {loading ? '—' : rows.length}
        </div>

        {loading ? (
          <SkeletonList rows={5} />
        ) : rows.length === 0 ? (
          <div className="bg-white dark:bg-paperDark border border-charcoal/10 dark:border-white/10 rounded-[14px] px-[15px] py-6 text-center">
            <p className="text-sm text-charcoal/40 dark:text-white/35">No staff on this venue yet</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-paperDark border border-charcoal/10 dark:border-white/10 rounded-[14px] overflow-hidden">
            {rows.map((r, i) => (
              <div
                key={r.staff_id}
                className={`flex items-center gap-3 px-[15px] py-[13px] ${i < rows.length - 1 ? 'border-b border-charcoal/6 dark:border-white/8' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-charcoal dark:text-white tracking-[-0.005em]">{r.staff_name}</div>
                  <div className="font-mono text-micro text-charcoal/40 dark:text-white/35 mt-0.5">
                    {ROLE_LABELS[r.role] ?? r.role}
                  </div>
                </div>
                <span className="font-mono text-caption text-charcoal/50 dark:text-white/40 shrink-0 text-right">
                  {r.last_login ? format(parseISO(r.last_login), 'd MMM yyyy, HH:mm') : 'Never logged in'}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="text-caption text-charcoal/50 dark:text-white/40 pt-2 px-1 leading-[1.45]">
          Shows when each staff member last signed in to this venue on any device.
        </div>

      </div>
    </div>
  )
}
