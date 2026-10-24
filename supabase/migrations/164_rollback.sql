-- Rollback 164: restore update_staff_fields as defined in 115.

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
