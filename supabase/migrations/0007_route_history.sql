-- Rolling per-route vehicle count snapshots, one row per route per worker tick.
-- Used to render sidebar sparklines showing "active vehicles on this route" over the last ~30 min.
create table if not exists public.transit_route_history (
  route_id      text        not null references public.transit_routes(route_id) on delete cascade,
  ts            timestamptz not null default now(),
  vehicle_count integer     not null,
  primary key (route_id, ts)
);

create index if not exists transit_route_history_ts_idx on public.transit_route_history (ts);

alter table public.transit_route_history enable row level security;

drop policy if exists "transit_route_history readable by all" on public.transit_route_history;
create policy "transit_route_history readable by all"
  on public.transit_route_history for select
  using (true);

-- Stream new snapshots to subscribed clients.
alter publication supabase_realtime add table public.transit_route_history;
