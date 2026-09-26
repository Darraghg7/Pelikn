/**
 * The venue role that matches someone's job role (job_role 'foh' → "Front of
 * House"), for defaulting a new shift. Without it the desktop rota fell back
 * to the first role — every new FOH or bar shift defaulted to "Kitchen" — and
 * the mobile rota used the raw code, so no role chip was selected and the
 * shift saved labelled "foh".
 */
const JOB_ROLE_ALIASES = { foh: ['foh', 'front of house', 'front'], kitchen: ['kitchen', 'chef'], bar: ['bar'] }

export function roleForJob(venueRoles, jobRole) {
  if (!jobRole || !venueRoles?.length) return null
  const key = String(jobRole).toLowerCase()
  const aliases = JOB_ROLE_ALIASES[key] ?? [key]
  return venueRoles.find(r => aliases.some(a => r.name?.toLowerCase().includes(a)))?.name ?? null
}
