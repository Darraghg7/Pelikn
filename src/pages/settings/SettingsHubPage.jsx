import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useAuth } from '../../contexts/AuthContext'
import { useAppSettings } from '../../hooks/useSettings'

function GroupLabel({ label }) {
  return (
    <div className="font-mono text-[11px] font-semibold tracking-[0.08em] uppercase text-charcoal/50 px-0.5 pt-3 pb-1.5">
      {label}
    </div>
  )
}

function RowGroup({ children }) {
  return (
    <div className="bg-white dark:bg-paperDark border border-charcoal/10 rounded-[14px] overflow-hidden">
      {children}
    </div>
  )
}

function SRow({ icon, label, sub, value, attention, last, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-[13px] px-[14px] min-h-[52px] border-b border-charcoal/6 last:border-0 hover:bg-charcoal/[0.02] transition-colors ${last ? 'border-b-0' : ''}`}
    >
      <span className={`w-8 h-8 rounded-[9px] shrink-0 flex items-center justify-center ${attention ? 'bg-warning/10 text-warning' : danger ? 'bg-danger/10 text-danger' : 'bg-brand/8 text-brand'}`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
      </span>
      <div className="flex-1 min-w-0 py-3">
        <div className={`text-sm font-medium tracking-[-0.005em] leading-snug ${danger ? 'text-danger' : 'text-charcoal'}`}>{label}</div>
        {sub && <div className={`font-mono text-[11px] mt-0.5 leading-[1.4] ${attention ? 'text-warning' : 'text-charcoal/50'}`}>{sub}</div>}
      </div>
      {value && <span className="font-mono text-[11px] text-charcoal/50 shrink-0">{value}</span>}
      {onClick && (
        <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${attention ? 'text-warning' : 'text-charcoal/30'}`}>
          <path d="M1 1l4 4-4 4"/>
        </svg>
      )}
    </button>
  )
}

export default function SettingsHubPage() {
  const navigate = useNavigate()
  const { venueSlug, venueName } = useVenue()
  const { session } = useSession()
  const { signOutVenue } = useAuth()
  const { lateGraceMins } = useAppSettings()

  const vp = (path) => `/v/${venueSlug}${path}`

  const isOwner  = session?.staffRole === 'owner'
  const staffName = session?.name ?? 'Manager'
  const role = session?.staffRole === 'owner' ? 'Owner' : session?.staffRole === 'manager' ? 'General Manager' : 'Manager'
  const initials = staffName.split(' ').map(w => w[0]).slice(0, 2).join('')

  const attendanceAttention = lateGraceMins > 0

  return (
    <div className="pb-24">

      <h1 className="text-[26px] font-semibold tracking-[-0.028em] mb-[14px] text-charcoal">Settings</h1>

      <button
        onClick={() => navigate(vp('/settings/hub'))}
        className="w-full text-left bg-brand text-white rounded-[14px] p-4 flex items-center gap-[13px] mb-1 hover:bg-brand/90 transition-colors"
      >
        <span className="w-[50px] h-[50px] rounded-[13px] shrink-0 bg-white/[0.16] flex items-center justify-center font-mono text-base font-semibold">
          {initials}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[17px] font-semibold tracking-[-0.015em]">{staffName}</div>
          <div className="font-mono text-[11px] text-white/65 mt-0.5">
            {role}{venueName ? ` · ${venueName}` : ''}
          </div>
        </div>
        <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 1l4 4-4 4"/>
        </svg>
      </button>

      <GroupLabel label="Account" />
      <RowGroup>
        <SRow
          icon={<><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></>}
          label="Venue"
          sub="Name, logo, hours, venues, appearance"
          onClick={() => navigate(vp('/settings/venue'))}
        />
        <SRow
          icon={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>}
          label="Staff & Roles"
          sub="Members, invite code, roles, duties"
          onClick={() => navigate(vp('/settings/staff'))}
          last
        />
      </RowGroup>

      <GroupLabel label="Operations" />
      <RowGroup>
        <SRow
          icon={<><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>}
          label="Attendance"
          sub={attendanceAttention ? `Grace: ${lateGraceMins} min · Breaks on` : 'Clock-in & break rules'}
          attention={attendanceAttention}
          onClick={() => navigate(vp('/settings/attendance'))}
        />
        <SRow
          icon={<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/></>}
          label="Compliance"
          sub="Fridge check time, action schedules"
          onClick={() => navigate(vp('/settings/compliance'))}
        />
        <SRow
          icon={<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>}
          label="Notifications"
          sub="Push alerts, digest, reminders"
          onClick={() => navigate(vp('/settings/notifications'))}
          last
        />
      </RowGroup>

      <GroupLabel label="Customise" />
      <RowGroup>
        <SRow
          icon={<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>}
          label="Features"
          sub="Enable or disable modules"
          onClick={() => navigate(vp('/settings/hub-tiles'))}
          last
        />
      </RowGroup>

      <GroupLabel label="More" />
      <RowGroup>
        {isOwner && (
          <SRow
            icon={<><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></>}
            label="Plan & Billing"
            sub="Subscription & usage"
            onClick={() => navigate(vp('/settings/billing'))}
          />
        )}
        <SRow
          icon={<><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></>}
          label="Help & Support"
          sub="FAQ, docs, contact"
          onClick={() => navigate(vp('/settings/help'))}
          last
        />
      </RowGroup>

      <button
        onClick={signOutVenue}
        className="w-full h-[50px] mt-3.5 rounded-[13px] border border-danger/20 bg-danger/8 text-danger text-[15px] font-semibold flex items-center justify-center gap-2 hover:bg-danger/[0.12] transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
        </svg>
        Sign out
      </button>

      <div className="text-center font-mono text-[11px] text-charcoal/30 tracking-[0.08em] pt-3">
        Pelikn
      </div>
    </div>
  )
}
