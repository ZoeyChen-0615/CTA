-- Per-vehicle position snapshots so the frontend can draw trails on the map.
-- Worker inserts one row per active vehicle per tick and prunes rows older than
-- ~15 minutes; clients fetch the last 10 minutes on demand.
create table if not exists public.transit_vehicle_history (
  vehicle_id  text        not null,
  route_id    text        not null references public.transit_routes(route_id) on delete cascade,
  lat         numeric     not null,
  lon         numeric     not null,
  recorded_at timestamptz not null default now(),
  primary key (vehicle_id, recorded_at)
);

create index if not exists transit_vehicle_history_route_ts_idx
  on public.transit_vehicle_history (route_id, recorded_at desc);

alter table public.transit_vehicle_history enable row level security;

drop policy if exists "transit_vehicle_history readable by all" on public.transit_vehicle_history;
create policy "transit_vehicle_history readable by all"
  on public.transit_vehicle_history for select
  using (true);

-- Drop the earlier per-route sparkline table — replaced by the map trails toggle.
-- (ALTER PUBLICATION doesn't support IF EXISTS, so guard with a DO block.)
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'transit_route_history'
  ) then
    execute 'alter publication supabase_realtime drop table public.transit_route_history';
  end if;
end $$;

drop table if exists public.transit_route_history;
