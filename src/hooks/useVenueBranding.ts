import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

interface VenueBranding {
  venueName: string
  logoUrl: string
}

const DEFAULT_BRANDING: VenueBranding = { venueName: '', logoUrl: '' }

async function fetchBranding(venueId: string): Promise<VenueBranding> {
  const { data } = await supabase
    .from('app_settings')
    .select('key, value')
    .eq('venue_id', venueId)
    .in('key', ['venue_name', 'logo_url'])

  if (!data) return DEFAULT_BRANDING
  const map = Object.fromEntries((data as { key: string; value: string }[]).map(r => [r.key, r.value]))
  return {
    venueName: map.venue_name ?? '',
    logoUrl:   map.logo_url   ?? '',
  }
}

/**
 * Returns { venueName, logoUrl } for the given venueId.
 * Fetches from app_settings once and caches for 5 minutes via TanStack Query.
 * Safe to call from multiple components — only one DB request fires.
 */
export function useVenueBranding(venueId: string): VenueBranding {
  const { data } = useQuery({
    queryKey: ['venue-branding', venueId],
    queryFn: () => fetchBranding(venueId),
    enabled: !!venueId,
    placeholderData: DEFAULT_BRANDING,
    staleTime: 5 * 60_000,
  })

  return data ?? DEFAULT_BRANDING
}
