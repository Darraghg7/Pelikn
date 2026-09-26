/**
 * Department targeting for staff-facing lists — deliberately fails open.
 *
 * People are ticked into the departments they work in, and cleaning tasks,
 * Tasks and checks are assigned to a department (NULL = everyone).
 *
 * This used to match on `staff.job_role`, a plain string pointing at a
 * venue-configured string list. Renaming or removing an entry there stranded
 * the old value on staff rows and records, and an exact-match filter then hid
 * those records from every staff member while managers — who skip the
 * filter — still saw them. That read as the module being switched off for
 * staff even though it was enabled.
 *
 * The same failure shape is still possible with ids: a department gets
 * deleted (ON DELETE SET NULL on the record, but a stale id can sit in a
 * cache), or a person isn't in any department.
 * So the rule stays: anything the viewer or the record doesn't recognisably
 * hold is treated as "untargeted", never as "nobody holds it".
 */

/**
 * @param viewerDepartmentIds the staff member's departments, or null for managers
 * @param knownDepartmentIds  department ids that currently exist for the venue
 * @returns a predicate for a record's department_id
 */
export function departmentMatcher(
  viewerDepartmentIds: readonly string[] | null | undefined,
  knownDepartmentIds: readonly string[],
): (recordDepartmentId: string | null | undefined) => boolean {
  const known = new Set(knownDepartmentIds)
  const viewer = new Set((viewerDepartmentIds ?? []).filter((id) => known.has(id)))

  // No department to go on — the person isn't in one, or only in ones the
  // venue no longer has — so show everything. This also covers the
  // first render before roles/departments have loaded, where erring towards
  // showing is right.
  if (viewer.size === 0) return () => true

  return (recordDepartmentId) =>
    !recordDepartmentId ||
    viewer.has(recordDepartmentId) ||
    !known.has(recordDepartmentId)
}
