/**
 * Role targeting for staff-facing lists — deliberately fails open.
 *
 * Originally this matched on `staff.job_role`, a plain string that pointed at
 * a venue-configured string list — renaming or removing an entry there
 * stranded the old value on staff rows and on existing records, and an
 * exact-match filter then hid those records from every staff member while
 * managers — who skip the filter entirely — still saw them. That read as the
 * module being switched off for staff even though it was enabled.
 *
 * `venue_roles` (a proper table, many-to-many with staff via
 * `staff_role_assignments`) replaced that free-text system so a role can be
 * renamed without stranding anything, but the same failure shape is still
 * possible any time a `role_id` gets deleted (ON DELETE SET NULL on the
 * record) or a staff member has zero role assignments — so the same rule
 * applies: a role the record or the viewer doesn't recognisably hold is
 * treated as "untargeted" rather than as "nobody holds it."
 *
 * @param viewerRoleIds the staff member's assigned role_ids, or null for managers
 * @param knownRoleIds  role_ids that currently exist for the venue
 * @returns a predicate for a record's assigned role_id
 */
export function roleMatcher(
  viewerRoleIds: readonly string[] | null | undefined,
  knownRoleIds: readonly string[],
): (recordRoleId: string | null | undefined) => boolean {
  const known = new Set(knownRoleIds)
  const viewer = new Set((viewerRoleIds ?? []).filter((id) => known.has(id)))

  // No roles assigned, or none the venue still recognises — nothing
  // meaningful to filter against, so show everything. This also covers the
  // first render before roles/role assignments have loaded, where erring
  // towards showing is right.
  if (viewer.size === 0) return () => true

  return (recordRoleId) =>
    !recordRoleId ||
    viewer.has(recordRoleId) ||
    !known.has(recordRoleId)
}
