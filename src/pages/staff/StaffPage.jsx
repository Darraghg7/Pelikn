import { useSearchParams } from 'react-router-dom'
import StaffMembersSection from '../settings/StaffMembersSection'
import Button from '../../components/ui/Button'

/** Team → Staff: the one place people are added and edited (Settings → Team setup holds only invite code, departments and duties). */
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
            <h1 className="text-title leading-tight font-bold tracking-tight text-ink dark:text-white">Staff</h1>
            <p className="text-body-sm text-ink3 dark:text-white/45 mt-0.5">Manage team members</p>
          </div>
          <Button
            size="sm"
            onClick={() => openStaff('new')}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Add staff
          </Button>
        </div>
      )}
      <StaffMembersSection detailId={detailId} onOpen={openStaff} onClose={closeStaff} />
    </div>
  )
}
