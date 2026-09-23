-- 115 — give the last five staff writes a way through RLS, loudly.
--
-- 091 dropped every policy on `staff` and replaced them with a single SELECT
-- policy, noting "writes via SECURITY DEFINER RPCs only". Most writes were
-- converted (deactivate/reactivate/restrict/link/unlink/create/update/pin),
-- but five kept writing to the table directly:
--
--   updateStaffPhotoUrl      updateStaffExtraFields   updateStaffContractType
--   updateStaffSortOrder     deleteStaffRow
--
-- With RLS on and no INSERT/UPDATE/DELETE policy, those are all denied. A
-- denied UPDATE/DELETE does not error — it matches zero rows, and PostgREST
-- returns 204/200. So the app showed "Staff member updated" and "<name>
-- permanently deleted" while the database ignored it. Managers have been
-- losing edits, and deletion requests have not actually been honoured.
--
-- This adds the three missing RPCs. Every one of them RAISES rather than
-- returning quietly when it changes nothing, so this class of bug cannot
-- come back silently.
--
-- Policy: managers and owners only. Staff cannot edit their own record.

-- ── Shared auth: resolve the caller's venue, or refuse ───────────────────────
-- Same check deactivate_staff_member already uses: a live session token
-- belonging to an active manager/owner. Factored out so the three functions
-- below cannot drift apart.
CREATE OR REPLACE FUNCTION manager_venue_for_session(p_session_token uuid)
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_venue_id uuid;
BEGIN
  SELECT ss.venue_id INTO v_venue_id
  FROM staff_sessions ss
  JOIN staff s ON s.id = ss.staff_id
  WHERE ss.token = p_session_token
    AND ss.expires_at > now()
    AND s.role IN ('manager', 'owner')
    AND s.is_active = true;

  IF v_venue_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: manager or owner access required';
  END IF;

  RETURN v_venue_id;
END;
$$;
GRANT EXECUTE ON FUNCTION manager_venue_for_session(uuid) TO anon, authenticated;

-- ── Field updates ───────────────────────────────────────────────────────────
-- Replaces updateStaffExtraFields / updateStaffContractType /
-- updateStaffPhotoUrl, which all did the same thing: patch some columns of
-- one staff row.
--
-- The column list is a whitelist enforced here, not in the client. The old
-- code passed an arbitrary object straight into .update(), so anyone with the
-- anon key could have set role='owner', venue_id, pin_hash or hourly_rate on
-- any row had the policy allowed writes at all.
--
-- An unknown key RAISES rather than being dropped. If someone adds a field to
-- the staff form later and forgets this migration, they get an error — not
-- another field that silently refuses to save.
CREATE OR REPLACE FUNCTION update_staff_fields(
  p_session_token uuid,
  p_staff_id      uuid,
  p_fields        jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_venue_id uuid;
  v_allowed  text[] := ARRAY[
    'is_under_18', 'working_days', 'contracted_hours', 'employment_type',
    'start_date', 'emergency_contact_name', 'emergency_contact_phone',
    'holiday_pay_eligible', 'colour', 'permission_title_id', 'photo_url',
    'sort_order'
  ];
  v_unknown  text[];
BEGIN
  v_venue_id := manager_venue_for_session(p_session_token);

  IF p_fields IS NULL OR jsonb_typeof(p_fields) <> 'object' THEN
    RAISE EXCEPTION 'update_staff_fields: p_fields must be a JSON object';
  END IF;

  SELECT array_agg(k) INTO v_unknown
  FROM jsonb_object_keys(p_fields) AS k
  WHERE k <> ALL (v_allowed);

  IF v_unknown IS NOT NULL THEN
    RAISE EXCEPTION 'update_staff_fields: field(s) not updatable: %',
      array_to_string(v_unknown, ', ');
  END IF;

  -- `p_fields ? key` distinguishes "not supplied" from "supplied as null":
  -- the form legitimately clears contracted_hours, start_date and
  -- permission_title_id by sending an explicit null.
  --
  -- The four NOT NULL columns (is_under_18, working_days, holiday_pay_eligible,
  -- sort_order) fall back to their current value rather than accepting a null
  -- that would abort the statement.
  UPDATE staff s SET
    is_under_18 = CASE WHEN p_fields ? 'is_under_18'
      THEN COALESCE((p_fields->>'is_under_18')::boolean, s.is_under_18) ELSE s.is_under_18 END,

    working_days = CASE WHEN p_fields ? 'working_days' AND jsonb_typeof(p_fields->'working_days') = 'array'
      THEN COALESCE((SELECT array_agg(v::int)
                     FROM jsonb_array_elements_text(p_fields->'working_days') AS v), '{}')
      ELSE s.working_days END,

    contracted_hours = CASE WHEN p_fields ? 'contracted_hours'
      THEN (p_fields->>'contracted_hours')::numeric ELSE s.contracted_hours END,

    employment_type = CASE WHEN p_fields ? 'employment_type'
      THEN p_fields->>'employment_type' ELSE s.employment_type END,

    start_date = CASE WHEN p_fields ? 'start_date'
      THEN (p_fields->>'start_date')::date ELSE s.start_date END,

    emergency_contact_name = CASE WHEN p_fields ? 'emergency_contact_name'
      THEN p_fields->>'emergency_contact_name' ELSE s.emergency_contact_name END,

    emergency_contact_phone = CASE WHEN p_fields ? 'emergency_contact_phone'
      THEN p_fields->>'emergency_contact_phone' ELSE s.emergency_contact_phone END,

    holiday_pay_eligible = CASE WHEN p_fields ? 'holiday_pay_eligible'
      THEN COALESCE((p_fields->>'holiday_pay_eligible')::boolean, s.holiday_pay_eligible)
      ELSE s.holiday_pay_eligible END,

    colour = CASE WHEN p_fields ? 'colour'
      THEN p_fields->>'colour' ELSE s.colour END,

    permission_title_id = CASE WHEN p_fields ? 'permission_title_id'
      THEN (p_fields->>'permission_title_id')::uuid ELSE s.permission_title_id END,

    photo_url = CASE WHEN p_fields ? 'photo_url'
      THEN p_fields->>'photo_url' ELSE s.photo_url END,

    sort_order = CASE WHEN p_fields ? 'sort_order'
      THEN COALESCE((p_fields->>'sort_order')::int, s.sort_order) ELSE s.sort_order END
  WHERE s.id = p_staff_id
    AND s.venue_id = v_venue_id;

  -- The venue_id match above is what stops a manager editing another venue's
  -- staff. Without this check that would be a no-op returning success, which
  -- is the bug being fixed.
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff member not found in this venue';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION update_staff_fields(uuid, uuid, jsonb) TO anon, authenticated;

-- ── Delete ──────────────────────────────────────────────────────────────────
-- Replaces deleteStaffRow. This is the one that matters most: the UI has been
-- claiming "permanently deleted" on rows that were never touched, so a GDPR
-- erasure request could have been reported as done without being done.
CREATE OR REPLACE FUNCTION delete_staff_member(
  p_session_token uuid,
  p_staff_id      uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_venue_id uuid;
BEGIN
  v_venue_id := manager_venue_for_session(p_session_token);

  DELETE FROM staff
  WHERE id = p_staff_id
    AND venue_id = v_venue_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff member not found in this venue';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION delete_staff_member(uuid, uuid) TO anon, authenticated;

-- ── Reorder ─────────────────────────────────────────────────────────────────
-- Replaces updateStaffSortOrder, which the client called once per row on every
-- move — N round trips for one reorder. This takes the whole ordering at once.
--
-- Rows outside the caller's venue are skipped rather than rejected: since 114
-- the staff list can legitimately include cross-venue staff, and a manager
-- reordering their own list should not fail because of someone else's row.
-- The return value is how many rows actually moved, so the caller can tell the
-- difference between "partially applied" and "did nothing".
CREATE OR REPLACE FUNCTION reorder_venue_staff(
  p_session_token uuid,
  p_staff_ids     uuid[]
) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_venue_id uuid;
  v_updated  int;
BEGIN
  v_venue_id := manager_venue_for_session(p_session_token);

  IF p_staff_ids IS NULL OR array_length(p_staff_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'reorder_venue_staff: p_staff_ids must be a non-empty array';
  END IF;

  UPDATE staff s
  SET sort_order = o.ord
  FROM (
    SELECT id, (idx - 1) AS ord
    FROM unnest(p_staff_ids) WITH ORDINALITY AS t(id, idx)
  ) AS o
  WHERE s.id = o.id
    AND s.venue_id = v_venue_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Reorder matched no staff in this venue';
  END IF;

  RETURN v_updated;
END;
$$;
GRANT EXECUTE ON FUNCTION reorder_venue_staff(uuid, uuid[]) TO anon, authenticated;
