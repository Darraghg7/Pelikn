import StaffMembersSection from '../settings/StaffMembersSection'

export default function StaffPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-charcoal dark:text-white">Staff</h1>
        <p className="text-sm text-charcoal/45 dark:text-white/40 mt-0.5">Manage team members</p>
      </div>
      <StaffMembersSection />
    </div>
  )
}
