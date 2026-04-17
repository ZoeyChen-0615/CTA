-- Transit Tracker — initial schema
-- Tables are prefixed transit_ so they don't collide with other projects in this shared Supabase instance.

create table if not exists public.transit_routes (
  route_id text primary key,
  mode     text not null check (mode in ('train', 'bus')),
  name     text not null,
  color    text not null
);

create table if not exists public.transit_vehicles (
  vehicle_id         text primary key,
  route_id           text not null references public.transit_routes(route_id) on delete cascade,
  mode               text not null check (mode in ('train', 'bus')),
  lat                numeric not null,
  lon                numeric not null,
  heading            integer,
  destination        text,
  speed              numeric,
  delayed            boolean not null default false,
  source_updated_at  timestamptz,
  updated_at         timestamptz not null default now()
);

create index if not exists transit_vehicles_route_id_idx on public.transit_vehicles (route_id);
create index if not exists transit_vehicles_updated_at_idx on public.transit_vehicles (updated_at);

create table if not exists public.transit_favorites (
  user_id    uuid not null references auth.users(id) on delete cascade,
  route_id   text not null references public.transit_routes(route_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, route_id)
);

-- Keep transit_vehicles.updated_at fresh on every upsert.
create or replace function public.transit_vehicles_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists transit_vehicles_touch on public.transit_vehicles;
create trigger transit_vehicles_touch
  before insert or update on public.transit_vehicles
  for each row execute function public.transit_vehicles_touch();
