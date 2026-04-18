import StaffMembersSection from '../settings/StaffMembersSection'

export default function StaffPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-serif text-3xl text-brand dark:text-white">Staff</h1>
      <StaffMembersSection />
    </div>
  )
}
