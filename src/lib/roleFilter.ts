/**
 * Role targeting for staff-facing lists — deliberately fails open.
 *
 * `staff.job_role` and a record's assigned role are plain strings that both
 * point at Settings → Roles. Renaming or removing a role there strands the old
 * value on staff rows and on existing records, and an exact-match filter then
 * hides those records from every staff member while managers — who skip the
 * filter entirely — still see them. That reads as the module being switched
 * off for staff even though it's enabled.
 *
 * So a role the venue no longer configures is treated as "untargeted" rather
 * than as a role nobody holds. This mirrors the manager-side bucketing in
 * TasksPage, which already folds unrecognised roles into "All Roles".
 *
 * @param viewerRole  the staff member's job_role, or null for managers
 * @param knownRoles  role values currently configured for the venue
 * @returns a predicate for a record's assigned role
 */
export function roleMatcher(
  viewerRole: string | null | undefined,
  knownRoles: readonly string[],
): (recordRole: string | null | undefined) => boolean {
  const known = new Set(knownRoles)

  // No role set, or a role the venue no longer has — nothing meaningful to
  // filter against, so show everything. This also covers the first render
  // before app_settings has loaded, where erring towards showing is right.
  if (!viewerRole || !known.has(viewerRole)) return () => true

  return (recordRole) =>
    !recordRole ||
    recordRole === 'all' ||
    recordRole === viewerRole ||
    !known.has(recordRole)
}
