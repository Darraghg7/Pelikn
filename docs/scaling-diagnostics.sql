-- Scaling diagnostics. READ-ONLY: every statement is a SELECT (the extension
-- line is the one exception and is harmless). Run each block separately in
-- the Supabase SQL editor and send the results back.
--
-- Best time to run: after a normal busy hour of real use, not first thing in
-- the morning, so the numbers reflect real traffic.

-- 0. Make sure query statistics are on (Supabase has this on by default).
create extension if not exists pg_stat_statements;

-- 1. The 15 queries that cost the most database time overall.
--    total_s = seconds of database time spent; mean_ms = typical run;
--    calls = how often. Fix the top of THIS list first.
select
  round(total_exec_time / 1000)             as total_s,
  calls,
  round(mean_exec_time::numeric, 1)         as mean_ms,
  round(100 * total_exec_time / sum(total_exec_time) over (), 1) as pct_of_all,
  left(regexp_replace(query, '\s+', ' ', 'g'), 160) as query
from pg_stat_statements
where query not ilike '%pg_stat_statements%'
order by total_exec_time desc
limit 15;

-- 2. The 15 most frequently called queries (cheap each, expensive in bulk).
select calls, round(mean_exec_time::numeric, 2) as mean_ms,
       left(regexp_replace(query, '\s+', ' ', 'g'), 160) as query
from pg_stat_statements
where query not ilike '%pg_stat_statements%'
order by calls desc
limit 15;

-- 3. Tables read by scanning every row (missing index?). Large seq_scan counts
--    on a table with many rows is the thing to look for.
select relname as table_name, seq_scan, idx_scan, n_live_tup as rows,
       round(100.0 * idx_scan / nullif(seq_scan + idx_scan, 0)) as pct_index_use
from pg_stat_user_tables
where n_live_tup > 1000
order by seq_scan desc
limit 20;

-- 4. Biggest tables (what will grow with customers).
select relname as table_name, n_live_tup as rows,
       pg_size_pretty(pg_total_relation_size(relid)) as total_size
from pg_stat_user_tables
order by pg_total_relation_size(relid) desc
limit 15;

-- 5. Indexes that are never used (cost writes, give nothing back).
select relname as table_name, indexrelname as index_name,
       pg_size_pretty(pg_relation_size(indexrelid)) as size
from pg_stat_user_indexes
where idx_scan = 0 and pg_relation_size(indexrelid) > 1024 * 1024
order by pg_relation_size(indexrelid) desc
limit 15;

-- 6. Connections right now, by state (the ceiling depends on the compute size).
select state, count(*) from pg_stat_activity group by state order by count desc;

-- 7. Cache hit rate. Should be above 99%. Lower means the working set does not
--    fit in memory (the cause of the 13 Oct outage).
select round(100.0 * sum(heap_blks_hit) / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) as table_cache_hit_pct
from pg_statio_user_tables;
