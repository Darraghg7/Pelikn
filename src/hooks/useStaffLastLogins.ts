import { useQuery } from '@tanstack/react-query'
import { useSession } from '../contexts/SessionContext'
import { fetchStaffLastLogins } from '../lib/api/analytics'

export default function useStaffLastLogins() {
  // SessionContext is created with a `null` default and lives in a .jsx file,
  // so TS infers the context value as `null`. Same narrowing as useDuties.ts /
  // useEmployeeRecord.ts — without it this file fails `tsc --noEmit`.
  const { session } = (useSession() ?? {}) as { session?: { token?: string; venueId?: string } | null }
  const token = session?.token

  const { data, isLoading } = useQuery({
    queryKey: ['staff-last-logins', session?.venueId],
    queryFn: () => fetchStaffLastLogins(token!),
    enabled: !!token,
    staleTime: 60_000,
  })

  return { rows: data?.data ?? [], error: data?.error, loading: isLoading }
}
