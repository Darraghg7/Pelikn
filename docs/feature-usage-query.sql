-- Pelikn: side-feature usage per venue (READ-ONLY — safe to run in the Supabase SQL editor).
-- One row per venue × feature that has data: how many rows, and when the latest was made.
-- Missing tables or columns are skipped rather than erroring.
with feats(feature, tbl) as (values
  ('Fitness to work',        'fitness_declarations'),
  ('Recall & withdrawal',    'recall_logs'),
  ('Recall procedure',       'recall_procedures'),
  ('Complaints',             'food_complaints'),
  ('Mock EHO inspection',    'mock_inspections'),
  ('Equipment maintenance',  'equipment_maintenance_logs'),
  ('Date labelling',         'date_labelling_logs'),
  ('HACCP plan',             'haccp_plans'),
  ('Tips',                   'tip_splits'),
  ('Noticeboard',            'noticeboard_posts'),
  ('Waste',                  'waste_logs'),
  ('Supplier orders',        'supplier_orders'),
  ('Suppliers',              'suppliers'),
  ('Pest control',           'pest_control_logs'),
  ('Cooling logs',           'cooling_logs'),
  ('Probe calibration',      'probe_calibrations'),
  ('PPDS labels',            'ppds_items'),
  ('Corrective actions',     'corrective_actions'),
  ('Documents',              'documents'),
  ('Incidents',              'incidents')
),
usage as (
  select f.feature,
         (xpath('/row/venue_id/text()', r))[1]::text          as venue_id,
         (xpath('/row/n/text()', r))[1]::text::bigint          as row_count,
         (xpath('/row/latest/text()', r))[1]::text::timestamptz as latest
  from feats f
  cross join lateral unnest(xpath('/table/row', query_to_xml(
    case when to_regclass('public.' || f.tbl) is not null then format(
      $q$select to_jsonb(t)->>'venue_id' as venue_id, count(*) as n,
                max(coalesce(to_jsonb(t)->>'created_at', to_jsonb(t)->>'logged_at',
                             to_jsonb(t)->>'recorded_at', to_jsonb(t)->>'reported_at', to_jsonb(t)->>'updated_at')::timestamptz) as latest
         from public.%I t group by 1$q$, f.tbl)
    else 'select null::text as venue_id, 0::bigint as n, null::timestamptz as latest where false' end,
    false, false, ''))) r
)
select coalesce(v.name, '(no venue)') as venue,
       v.slug,
       u.feature,
       u.row_count,
       u.latest::date as latest_entry,
       (select s.value from public.app_settings s
         where s.venue_id::text = u.venue_id and s.key = 'features') as current_module_settings
from usage u
left join public.venues v on v.id::text = u.venue_id
order by venue, u.feature;
