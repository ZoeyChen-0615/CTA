-- Row-level security for Transit Tracker tables.
-- Service role (used by the Railway worker) bypasses RLS automatically.

alter table public.transit_routes    enable row level security;
alter table public.transit_vehicles  enable row level security;
alter table public.transit_favorites enable row level security;

-- Routes: public read (so the map is shareable), no client writes.
drop policy if exists "transit_routes readable by all" on public.transit_routes;
create policy "transit_routes readable by all"
  on public.transit_routes for select
  using (true);

-- Vehicles: public read, no client writes.
drop policy if exists "transit_vehicles readable by all" on public.transit_vehicles;
create policy "transit_vehicles readable by all"
  on public.transit_vehicles for select
  using (true);

-- Favorites: users can only see + mutate their own rows.
drop policy if exists "transit_favorites select own" on public.transit_favorites;
create policy "transit_favorites select own"
  on public.transit_favorites for select
  using (auth.uid() = user_id);

drop policy if exists "transit_favorites insert own" on public.transit_favorites;
create policy "transit_favorites insert own"
  on public.transit_favorites for insert
  with check (auth.uid() = user_id);

drop policy if exists "transit_favorites delete own" on public.transit_favorites;
create policy "transit_favorites delete own"
  on public.transit_favorites for delete
  using (auth.uid() = user_id);
