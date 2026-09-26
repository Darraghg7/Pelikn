import { useSearchParams } from 'react-router-dom'
import StaffMembersSection from '../settings/StaffMembersSection'

/** Team → Staff Members. Same list and person page as Settings → Staff & roles. */
export default function StaffPage() {
  const [params, setParams] = useSearchParams()
  const detailId = params.get('staff')
  const openStaff  = (id) => setParams({ staff: id }, { replace: !!detailId })
  const closeStaff = () => setParams({}, { replace: true })

  return (
    <div className={`${detailId ? 'pb-8' : ''} max-w-[480px] md:max-w-2xl lg:max-w-3xl flex flex-col gap-2.5`}>
      {!detailId && (
        <div className="flex items-center justify-between gap-2.5">
          <div>
            <h1 className="text-[20px] min-[420px]:text-[22px] leading-tight font-bold tracking-tight text-ink dark:text-white">Staff</h1>
            <p className="text-[13px] text-ink3 dark:text-white/45 mt-0.5">Manage team members</p>
          </div>
          <button
            type="button"
            onClick={() => openStaff('new')}
            className="shrink-0 inline-flex items-center gap-2 h-8 px-3.5 rounded-xl bg-brand text-white text-[13px] min-[420px]:text-[13px] font-semibold hover:bg-brand/90 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Add staff
          </button>
        </div>
      )}
      <StaffMembersSection detailId={detailId} onOpen={openStaff} onClose={closeStaff} backLabel="Staff" />
    </div>
  )
}
