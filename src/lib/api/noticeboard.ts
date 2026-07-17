import { supabase } from '../supabase'

export interface Notice {
  id: string
  title: string
  body: string
  pinned: boolean
  created_at: string
  created_by_name?: string | null
  [key: string]: unknown
}

export async function fetchNotices(venueId: string): Promise<Notice[]> {
  const { data } = await supabase
    .from('noticeboard_posts')
    .select('id, title, body, pinned, created_at, created_by_name')
    .eq('venue_id', venueId)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as Notice[]
}

export function insertNotice(payload: Record<string, unknown>) {
  return supabase.from('noticeboard_posts').insert(payload)
}

export function deleteNotice(id: string) {
  return supabase.from('noticeboard_posts').delete().eq('id', id)
}
